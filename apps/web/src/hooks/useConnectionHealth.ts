import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { createWsNativeApi, getTransportMetrics, onTransportStateChange } from "../wsNativeApi";
import type { ConnectionMetrics, TransportState } from "../wsTransport";

export interface ConnectionHealth {
  /** Current transport state. */
  readonly state: TransportState;
  /** True when the WebSocket is fully open and usable. */
  readonly isConnected: boolean;
  /** True when the transport has lost its connection and is retrying. */
  readonly isReconnecting: boolean;
  /** Latest connection metrics snapshot. */
  readonly metrics: ConnectionMetrics;
}

const METRICS_POLL_INTERVAL_MS = 5_000;

const DEFAULT_METRICS: ConnectionMetrics = {
  reconnectCount: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  latencyMs: null,
  uptimeMs: 0,
};

/**
 * Returns a reactive snapshot of the WebSocket connection health.
 * The transport state updates synchronously; metrics are polled at
 * a comfortable 5-second interval to avoid unnecessary re-renders.
 */
export function useConnectionHealth(): ConnectionHealth {
  const state = useSyncExternalStore(
    (callback) => {
      createWsNativeApi();
      return onTransportStateChange(() => callback());
    },
    () => {
      let current: TransportState = "connecting";
      const unsub = onTransportStateChange((next) => {
        current = next;
      });
      unsub();
      return current;
    },
    () => "connecting" as TransportState,
  );

  const [metrics, setMetrics] = useState<ConnectionMetrics>(DEFAULT_METRICS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = () => {
      const m = getTransportMetrics();
      if (m) setMetrics(m);
    };

    poll();
    intervalRef.current = setInterval(poll, METRICS_POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Also poll immediately on state change so reconnect count is fresh.
  useEffect(() => {
    const m = getTransportMetrics();
    if (m) setMetrics(m);
  }, [state]);

  return {
    state,
    isConnected: state === "open",
    isReconnecting: state === "reconnecting",
    metrics,
  };
}
