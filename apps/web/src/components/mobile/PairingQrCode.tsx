import { useCallback, useEffect, useState } from "react";

import { generateQrSvg } from "../../lib/qrCode";
import { resolveServerHttpOrigin } from "../../lib/runtimeBridge";
import { Button } from "../ui/button";

interface PairingInfo {
  pairingUrl: string;
  expiresAt: string;
  serverUrl: string;
}

/**
 * PairingQrCode renders a QR code on the desktop web app that mobile devices
 * can scan to pair. It fetches a short-lived pairing link from the server's
 * `/api/pairing` endpoint and displays it as a scannable QR code.
 *
 * The QR code auto-refreshes when the pairing link expires.
 */
export function PairingQrCode() {
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPairingLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const origin = resolveServerHttpOrigin();
      const response = await fetch(`${origin}/api/pairing?ttl=300`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = (await response.json()) as PairingInfo;
      if ("error" in data) {
        setError(data.error as unknown as string);
        setPairing(null);
        setSvgHtml(null);
        return;
      }
      setPairing(data);
      setSvgHtml(generateQrSvg(data.pairingUrl));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate pairing link.");
      setPairing(null);
      setSvgHtml(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    void fetchPairingLink();
  }, [fetchPairingLink]);

  // Countdown timer
  useEffect(() => {
    if (!pairing?.expiresAt) {
      setExpiresIn(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000),
      );
      setExpiresIn(remaining);
      if (remaining <= 0) {
        // Auto-refresh when expired
        void fetchPairingLink();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pairing?.expiresAt, fetchPairingLink]);

  const handleCopyLink = async () => {
    if (!pairing?.pairingUrl) return;
    try {
      await navigator.clipboard.writeText(pairing.pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text in the details element
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">Scan with OK Code mobile app</h3>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void fetchPairingLink()}
            disabled={loading}
          >
            {loading ? "Generating..." : "Retry"}
          </Button>
        </div>
      ) : svgHtml ? (
        <>
          <div
            className="rounded-xl border border-border bg-white p-3 shadow-sm"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is generated locally, not user input
            dangerouslySetInnerHTML={{ __html: svgHtml }}
            style={{ width: 220, height: 220 }}
          />
          {expiresIn !== null && (
            <p className="text-xs text-muted-foreground">
              {expiresIn > 0 ? <>Expires in {formatTime(expiresIn)}</> : <>Refreshing...</>}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleCopyLink()}>
              {copied ? "Copied!" : "Copy pairing link"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void fetchPairingLink()}
              disabled={loading}
            >
              {loading ? "Generating..." : "Refresh"}
            </Button>
          </div>
          <p className="max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground/70">
            Scan the QR code with your phone camera, or copy the link and paste it in the mobile
            app.
          </p>
        </>
      ) : loading ? (
        <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-border bg-muted">
          <p className="text-sm text-muted-foreground">Generating...</p>
        </div>
      ) : null}
    </div>
  );
}
