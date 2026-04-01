import type { MobileConnectionState } from "@okcode/contracts";

import { useMobileConnectionState } from "../../hooks/useMobileConnectionState";

const STATE_CONFIG: Record<
  MobileConnectionState,
  { message: string; className: string; visible: boolean }
> = {
  connected: {
    message: "",
    className: "",
    visible: false,
  },
  connecting: {
    message: "Connecting to server...",
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    visible: true,
  },
  reconnecting: {
    message: "Connection lost. Reconnecting...",
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    visible: true,
  },
  disconnected: {
    message: "Disconnected from server. Check your network connection.",
    className:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    visible: true,
  },
};

/**
 * A banner that displays the current connection state when running in
 * the mobile companion shell. Hidden when connected.
 */
export function MobileConnectionBanner() {
  const connectionState = useMobileConnectionState();

  if (!connectionState) return null;

  const config = STATE_CONFIG[connectionState];
  if (!config.visible) return null;

  return (
    <div
      className={`flex items-center justify-center border-b px-4 py-2 text-xs font-medium ${config.className}`}
      role="status"
      aria-live="polite"
    >
      {connectionState === "reconnecting" && (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500 dark:bg-amber-400" />
      )}
      {connectionState === "connecting" && (
        <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500 dark:bg-blue-400" />
      )}
      {connectionState === "disconnected" && (
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
      )}
      {config.message}
    </div>
  );
}
