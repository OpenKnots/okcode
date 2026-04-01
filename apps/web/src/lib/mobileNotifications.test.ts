import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock runtimeBridge before the module under test is imported.
vi.mock("./runtimeBridge", () => ({
  readMobileBridge: vi.fn(),
}));

import type { MobileBridge, MobileNotificationEvent } from "@okcode/contracts";
import { readMobileBridge } from "./runtimeBridge";
import { initMobileNotifications } from "./mobileNotifications";

const mockReadMobileBridge = vi.mocked(readMobileBridge);

function createMockBridge(): MobileBridge & {
  _firedNotifications: MobileNotificationEvent[];
} {
  const fired: MobileNotificationEvent[] = [];
  return {
    getWsUrl: () => null,
    getPairingState: async () => ({
      paired: false,
      serverUrl: null,
      tokenPresent: false,
      lastError: null,
    }),
    applyPairingUrl: async () => ({
      paired: false,
      serverUrl: null,
      tokenPresent: false,
      lastError: null,
    }),
    clearPairing: async () => ({
      paired: false,
      serverUrl: null,
      tokenPresent: false,
      lastError: null,
    }),
    openExternal: async () => true,
    onPairingState: () => () => {},
    getConnectionState: () => "connected",
    onConnectionState: () => () => {},
    registerNotifications: vi.fn(async () => true),
    fireNotification: vi.fn(async (event: MobileNotificationEvent) => {
      fired.push(event);
    }),
    _firedNotifications: fired,
  };
}

type PushListener = (push: { data: unknown }) => void;

function createMockTransport() {
  const listeners = new Map<string, Set<PushListener>>();
  return {
    subscribe: vi.fn((channel: string, listener: PushListener) => {
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
      };
    }),
    _emit(channel: string, data: unknown) {
      for (const listener of listeners.get(channel) ?? []) {
        listener({ data });
      }
    },
  };
}

// Stub `document` for the test environment (Node.js has no DOM by default).
let mockVisibilityState = "visible";

beforeEach(() => {
  mockVisibilityState = "visible";
  if (typeof globalThis.document === "undefined") {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get visibilityState() {
          return mockVisibilityState;
        },
      },
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setBackgrounded(hidden: boolean) {
  mockVisibilityState = hidden ? "hidden" : "visible";
}

describe("mobileNotifications", () => {
  it("does not fire notifications when the app is in the foreground", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(false);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "thread.approval-response-requested",
      eventId: "evt-1",
      occurredAt: "2026-04-01T00:00:00Z",
      payload: { threadId: "t1" },
    });

    expect(bridge.fireNotification).not.toHaveBeenCalled();
    cleanup();
  });

  it("fires a notification for approval-requested when backgrounded", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(true);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "thread.approval-response-requested",
      eventId: "evt-2",
      occurredAt: "2026-04-01T00:00:00Z",
      payload: { threadId: "t2" },
    });

    expect(bridge.fireNotification).toHaveBeenCalledOnce();
    expect(bridge._firedNotifications[0]).toMatchObject({
      category: "approval-requested",
      title: "Approval Requested",
      threadId: "t2",
    });
    cleanup();
  });

  it("fires a notification for user-input-requested when backgrounded", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(true);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "thread.user-input-response-requested",
      eventId: "evt-3",
      occurredAt: "2026-04-01T00:00:00Z",
      payload: { threadId: "t3" },
    });

    expect(bridge._firedNotifications[0]).toMatchObject({
      category: "user-input-requested",
      title: "Input Needed",
    });
    cleanup();
  });

  it("fires a notification for turn-completed when backgrounded", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(true);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "thread.turn-diff-completed",
      eventId: "evt-4",
      occurredAt: "2026-04-01T00:00:00Z",
      payload: { threadId: "t4" },
    });

    expect(bridge._firedNotifications[0]).toMatchObject({
      category: "turn-completed",
      title: "Turn Completed",
    });
    cleanup();
  });

  it("fires a session-error notification for error status", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(true);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "thread.session-set",
      eventId: "evt-5",
      occurredAt: "2026-04-01T00:00:00Z",
      payload: { threadId: "t5", status: { status: "error" } },
    });

    expect(bridge._firedNotifications[0]).toMatchObject({
      category: "session-error",
      title: "Session Error",
    });
    cleanup();
  });

  it("ignores session-set events that are not errors", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(true);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "thread.session-set",
      eventId: "evt-6",
      occurredAt: "2026-04-01T00:00:00Z",
      payload: { threadId: "t6", status: { status: "running" } },
    });

    expect(bridge.fireNotification).not.toHaveBeenCalled();
    cleanup();
  });

  it("ignores unrelated orchestration events", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    setBackgrounded(true);
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    transport._emit("orchestration.domainEvent", {
      type: "project.created",
      eventId: "evt-7",
      occurredAt: "2026-04-01T00:00:00Z",
    });

    expect(bridge.fireNotification).not.toHaveBeenCalled();
    cleanup();
  });

  it("returns a no-op when no mobile bridge is available", () => {
    mockReadMobileBridge.mockReturnValue(undefined);
    const transport = createMockTransport();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);
    expect(typeof cleanup).toBe("function");
    expect(transport.subscribe).not.toHaveBeenCalled();
    cleanup();
  });

  it("eagerly registers notification permissions", () => {
    const bridge = createMockBridge();
    mockReadMobileBridge.mockReturnValue(bridge);
    const transport = createMockTransport();

    // biome-ignore lint/suspicious/noExplicitAny: test mock
    const cleanup = initMobileNotifications(transport as any);

    expect(bridge.registerNotifications).toHaveBeenCalledOnce();
    cleanup();
  });
});
