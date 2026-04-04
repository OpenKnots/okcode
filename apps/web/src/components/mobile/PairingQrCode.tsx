import { useCallback, useEffect, useState } from "react";

import { resolveServerHttpOrigin } from "../../lib/runtimeBridge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface PairingInfo {
  pairingUrl: string;
  expiresAt: string;
  serverUrl: string;
}

/**
 * PairingLink renders the desktop pairing link used to connect a mobile
 * device. It fetches a short-lived pairing link from the server's
 * `/api/pairing` endpoint and lets the user copy it directly.
 */
export function PairingLink() {
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
        return;
      }
      setPairing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate pairing link.");
      setPairing(null);
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
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">Pair with a mobile device</h3>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
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
      ) : pairing?.pairingUrl ? (
        <>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Copy this link and open it on the mobile app or device you want to pair.
            </p>
            <Input
              value={pairing.pairingUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Pairing link actions">
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
          {expiresIn !== null ? (
            <p className="text-xs text-muted-foreground">
              {expiresIn > 0 ? <>Expires in {formatTime(expiresIn)}</> : <>Refreshing...</>}
            </p>
          ) : null}
        </>
      ) : loading ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-border bg-muted">
          <p className="text-sm text-muted-foreground">Generating...</p>
        </div>
      ) : null}
    </div>
  );
}

export { PairingLink as PairingQrCode };
