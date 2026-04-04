import { useCallback, useEffect, useRef, useState } from "react";

import { resolveServerHttpOrigin } from "../../lib/runtimeBridge";
import { Button } from "../ui/button";

interface PairingInfo {
  pairingUrl: string;
  expiresAt: string;
  serverUrl: string;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * PairingLink fetches a short-lived pairing link from the server's
 * `/api/pairing` endpoint and exposes it through a copy button.
 *
 * The link auto-refreshes when it expires so the desktop page stays usable
 * without requiring a manual refresh action.
 */
export function PairingLink() {
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const refreshRequestedRef = useRef(false);

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

  useEffect(() => {
    void fetchPairingLink();
  }, [fetchPairingLink]);

  useEffect(() => {
    if (!pairing?.expiresAt) {
      setExpiresIn(null);
      refreshRequestedRef.current = false;
      return;
    }

    refreshRequestedRef.current = false;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(pairing.expiresAt).getTime() - Date.now()) / 1000),
      );
      setExpiresIn(remaining);
      if (remaining <= 0 && !refreshRequestedRef.current) {
        refreshRequestedRef.current = true;
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
      // Clipboard access can fail in some browsers or shells; leave the button available.
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Pair with the OK Code mobile app
      </h3>

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
      ) : pairing ? (
        <>
          {expiresIn !== null ? (
            <p className="text-xs text-muted-foreground">
              {expiresIn > 0 ? <>Expires in {formatTime(expiresIn)}</> : <>Refreshing...</>}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void handleCopyLink()}>
              {copied ? "Copied!" : "Copy pairing link"}
            </Button>
          </div>
          <p className="max-w-xs text-center text-[11px] leading-relaxed text-muted-foreground/70">
            Copy the pairing link and paste it into the mobile app.
          </p>
        </>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Generating pairing link...</p>
      ) : null}
    </div>
  );
}
