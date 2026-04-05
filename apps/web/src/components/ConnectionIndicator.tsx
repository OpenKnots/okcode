import { memo } from "react";
import { WifiIcon, WifiOffIcon, RefreshCwIcon } from "lucide-react";

import { useConnectionHealth } from "../hooks/useConnectionHealth";
import { Tooltip, TooltipTrigger, TooltipPopup } from "./ui/tooltip";

function formatLatency(ms: number | null): string {
  if (ms === null) return "--";
  if (ms < 1) return "<1ms";
  return `${Math.round(ms)}ms`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * A compact dot indicator that shows the live WebSocket connection state.
 *
 * - Green pulsing dot: connected
 * - Amber spinning dot: reconnecting
 * - Red dot: disconnected
 * - Blue pulsing dot: initial connect
 *
 * Hover reveals a tooltip with latency, uptime, and reconnect count.
 */
export const ConnectionIndicator = memo(function ConnectionIndicator() {
  const { state, metrics } = useConnectionHealth();

  const config = STATE_DOT_CONFIG[state] ?? STATE_DOT_CONFIG.connecting;

  return (
    <Tooltip>
      <TooltipTrigger
        className="relative flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        aria-label={`Connection: ${config.label}`}
      >
        <span className="relative flex h-2.5 w-2.5 items-center justify-center">
          {config.pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${config.pingColor}`}
            />
          )}
          {config.spin ? (
            <RefreshCwIcon className={`h-2.5 w-2.5 animate-spin ${config.iconColor}`} />
          ) : (
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${config.dotColor}`}
            />
          )}
        </span>
      </TooltipTrigger>
      <TooltipPopup side="bottom" align="end">
        <div className="flex flex-col gap-1 py-0.5">
          <span className="font-medium">{config.label}</span>
          <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
            <span>Latency: {formatLatency(metrics.latencyMs)}</span>
            <span>Uptime: {formatUptime(metrics.uptimeMs)}</span>
            {metrics.reconnectCount > 0 && (
              <span>Reconnects: {metrics.reconnectCount}</span>
            )}
          </div>
        </div>
      </TooltipPopup>
    </Tooltip>
  );
});

interface DotConfig {
  label: string;
  dotColor: string;
  pingColor: string;
  iconColor: string;
  pulse: boolean;
  spin: boolean;
}

const STATE_DOT_CONFIG: Record<string, DotConfig> = {
  open: {
    label: "Connected",
    dotColor: "bg-emerald-500",
    pingColor: "bg-emerald-400",
    iconColor: "",
    pulse: true,
    spin: false,
  },
  reconnecting: {
    label: "Reconnecting...",
    dotColor: "bg-amber-500",
    pingColor: "bg-amber-400",
    iconColor: "text-amber-500",
    pulse: false,
    spin: true,
  },
  closed: {
    label: "Disconnected",
    dotColor: "bg-red-500",
    pingColor: "bg-red-400",
    iconColor: "",
    pulse: false,
    spin: false,
  },
  connecting: {
    label: "Connecting...",
    dotColor: "bg-blue-500",
    pingColor: "bg-blue-400",
    iconColor: "",
    pulse: true,
    spin: false,
  },
  disposed: {
    label: "Closed",
    dotColor: "bg-zinc-400",
    pingColor: "",
    iconColor: "",
    pulse: false,
    spin: false,
  },
};
