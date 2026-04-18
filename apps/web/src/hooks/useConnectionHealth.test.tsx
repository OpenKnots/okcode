import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { ConnectionMetrics, TransportState } from "../wsTransport";
import { type ConnectionHealth, useConnectionHealth } from "./useConnectionHealth";

const {
  createWsNativeApiMock,
  getTransportMetricsMock,
  getTransportStateSnapshotMock,
  onTransportStateChangeMock,
} = vi.hoisted(() => ({
  createWsNativeApiMock: vi.fn(),
  getTransportMetricsMock: vi.fn(),
  getTransportStateSnapshotMock: vi.fn(),
  onTransportStateChangeMock: vi.fn(),
}));

vi.mock("../wsNativeApi", () => ({
  createWsNativeApi: createWsNativeApiMock,
  getTransportMetrics: getTransportMetricsMock,
  getTransportStateSnapshot: getTransportStateSnapshotMock,
  onTransportStateChange: onTransportStateChangeMock,
}));

const DEFAULT_METRICS: ConnectionMetrics = {
  reconnectCount: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  latencyMs: null,
  uptimeMs: 0,
};

const transportStateListeners = new Set<(state: TransportState) => void>();

let currentState: TransportState = "connecting";
let currentMetrics: ConnectionMetrics | null = DEFAULT_METRICS;
let renderer: ReactTestRenderer | null = null;
let latestHealth: ConnectionHealth | null = null;
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;
const originalConsoleError = console.error;

function HookHarness() {
  latestHealth = useConnectionHealth();
  return null;
}

function emitTransportState(nextState: TransportState) {
  currentState = nextState;
  for (const listener of new Set(transportStateListeners)) {
    listener(nextState);
  }
}

async function mountHook() {
  await act(async () => {
    renderer = create(<HookHarness />);
  });
}

async function unmountHook() {
  if (!renderer) {
    return;
  }

  await act(async () => {
    renderer?.unmount();
  });
  renderer = null;
}

async function advanceTime(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (typeof message === "string" && message.includes("react-test-renderer is deprecated")) {
      return;
    }
    originalConsoleError.call(console, message, ...args);
  });

  currentState = "connecting";
  currentMetrics = { ...DEFAULT_METRICS };
  latestHealth = null;
  renderer = null;
  transportStateListeners.clear();

  createWsNativeApiMock.mockReset();
  getTransportMetricsMock.mockReset().mockImplementation(() => currentMetrics);
  getTransportStateSnapshotMock.mockReset().mockImplementation(() => currentState);
  onTransportStateChangeMock.mockReset().mockImplementation((listener) => {
    transportStateListeners.add(listener);
    listener(currentState);
    return () => {
      transportStateListeners.delete(listener);
    };
  });
});

afterEach(async () => {
  await unmountHook();
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
  transportStateListeners.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useConnectionHealth", () => {
  it("refreshes metrics immediately on state changes and every five seconds", async () => {
    const initialMetrics: ConnectionMetrics = {
      reconnectCount: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      latencyMs: 42,
      uptimeMs: 2_000,
    };
    currentMetrics = initialMetrics;

    await mountHook();

    expect(createWsNativeApiMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(getTransportStateSnapshotMock.mock.calls.length).toBeGreaterThan(0);
    expect(onTransportStateChangeMock).toHaveBeenCalledTimes(1);
    expect(latestHealth).toEqual({
      state: "connecting",
      isConnected: false,
      isReconnecting: false,
      metrics: initialMetrics,
    });

    const refreshedMetrics: ConnectionMetrics = {
      reconnectCount: 1,
      lastConnectedAt: Date.parse("2026-04-09T20:00:00.000Z"),
      lastDisconnectedAt: Date.parse("2026-04-09T19:59:00.000Z"),
      latencyMs: 9,
      uptimeMs: 8_000,
    };
    currentMetrics = refreshedMetrics;

    await act(async () => {
      emitTransportState("open");
    });

    expect(latestHealth).toEqual({
      state: "open",
      isConnected: true,
      isReconnecting: false,
      metrics: refreshedMetrics,
    });

    const polledMetrics: ConnectionMetrics = {
      reconnectCount: 2,
      lastConnectedAt: Date.parse("2026-04-09T20:05:00.000Z"),
      lastDisconnectedAt: Date.parse("2026-04-09T20:04:30.000Z"),
      latencyMs: 4,
      uptimeMs: 13_000,
    };
    currentMetrics = polledMetrics;

    await advanceTime(4_999);
    expect(latestHealth?.metrics).toEqual(refreshedMetrics);

    await advanceTime(1);
    expect(latestHealth?.metrics).toEqual(polledMetrics);
  });

  it("keeps default metrics until snapshots become available and tracks reconnecting state", async () => {
    currentMetrics = null;

    await mountHook();

    expect(latestHealth).toEqual({
      state: "connecting",
      isConnected: false,
      isReconnecting: false,
      metrics: DEFAULT_METRICS,
    });

    const reconnectingMetrics: ConnectionMetrics = {
      reconnectCount: 3,
      lastConnectedAt: Date.parse("2026-04-09T20:10:00.000Z"),
      lastDisconnectedAt: Date.parse("2026-04-09T20:10:05.000Z"),
      latencyMs: null,
      uptimeMs: 0,
    };
    currentMetrics = reconnectingMetrics;

    await act(async () => {
      emitTransportState("reconnecting");
    });

    expect(latestHealth).toEqual({
      state: "reconnecting",
      isConnected: false,
      isReconnecting: true,
      metrics: reconnectingMetrics,
    });
  });
});
