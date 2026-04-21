import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { TransportState } from "../wsTransport";
import { useTransportState } from "./useTransportState";

const { createWsNativeApiMock, getTransportStateSnapshotMock, onTransportStateChangeMock } =
  vi.hoisted(() => ({
    createWsNativeApiMock: vi.fn(),
    getTransportStateSnapshotMock: vi.fn(),
    onTransportStateChangeMock: vi.fn(),
  }));

vi.mock("../wsNativeApi", () => ({
  createWsNativeApi: createWsNativeApiMock,
  getTransportStateSnapshot: getTransportStateSnapshotMock,
  onTransportStateChange: onTransportStateChangeMock,
}));

const transportStateListeners = new Set<(state: TransportState) => void>();

let currentState: TransportState = "connecting";
let latestState: TransportState | null = null;
let renderer: ReactTestRenderer | null = null;
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;
const originalConsoleError = console.error;

function HookHarness() {
  latestState = useTransportState();
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

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (typeof message === "string" && message.includes("react-test-renderer is deprecated")) {
      return;
    }
    originalConsoleError.call(console, message, ...args);
  });

  currentState = "connecting";
  latestState = null;
  renderer = null;
  transportStateListeners.clear();

  createWsNativeApiMock.mockReset();
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
  vi.restoreAllMocks();
});

describe("useTransportState", () => {
  it("reads the current state from a pure snapshot and subscribes once", async () => {
    await mountHook();

    expect(createWsNativeApiMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(getTransportStateSnapshotMock.mock.calls.length).toBeGreaterThan(0);
    expect(onTransportStateChangeMock).toHaveBeenCalledTimes(1);
    expect(latestState).toBe("connecting");
  });

  it("updates when the transport emits a new state", async () => {
    await mountHook();

    await act(async () => {
      emitTransportState("open");
    });

    expect(latestState).toBe("open");
  });
});
