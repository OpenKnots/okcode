import { WS_CHANNELS } from "@okcode/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WsRequestError, WsTransport } from "./wsTransport";

type WsEventType = "open" | "message" | "close" | "error";
type WsListener = (event?: { data?: unknown }) => void;

const sockets: MockWebSocket[] = [];

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<WsEventType, Set<WsListener>>();

  constructor(_url: string) {
    sockets.push(this);
  }

  addEventListener(type: WsEventType, listener: WsListener) {
    const listeners = this.listeners.get(type) ?? new Set<WsListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close");
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.emit("open");
  }

  serverMessage(data: unknown) {
    this.emit("message", { data });
  }

  private emit(type: WsEventType, event?: { data?: unknown }) {
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  }
}

const originalWebSocket = globalThis.WebSocket;

function getSocket(): MockWebSocket {
  const socket = sockets.at(-1);
  if (!socket) {
    throw new Error("Expected a websocket instance");
  }
  return socket;
}

beforeEach(() => {
  sockets.length = 0;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { hostname: "localhost", port: "3020" },
      desktopBridge: undefined,
    },
  });

  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  vi.restoreAllMocks();
});

describe("WsTransport", () => {
  it("routes valid push envelopes to channel listeners", () => {
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const listener = vi.fn();
    transport.subscribe(WS_CHANNELS.serverConfigUpdated, listener);

    socket.serverMessage(
      JSON.stringify({
        type: "push",
        sequence: 1,
        channel: WS_CHANNELS.serverConfigUpdated,
        data: { issues: [], providers: [] },
      }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      type: "push",
      sequence: 1,
      channel: WS_CHANNELS.serverConfigUpdated,
      data: { issues: [], providers: [] },
    });

    transport.dispose();
  });

  it("resolves pending requests for valid response envelopes", async () => {
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const requestPromise = transport.request("projects.list");
    const sent = socket.sent.at(-1);
    if (!sent) {
      throw new Error("Expected request envelope to be sent");
    }

    const requestEnvelope = JSON.parse(sent) as { id: string };
    socket.serverMessage(
      JSON.stringify({
        id: requestEnvelope.id,
        result: { projects: [] },
      }),
    );

    await expect(requestPromise).resolves.toEqual({ projects: [] });

    transport.dispose();
  });

  it("preserves structured websocket error data on rejected requests", async () => {
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const requestPromise = transport.request("git.runStackedAction", { cwd: "/repo" });
    const sent = socket.sent.at(-1);
    if (!sent) {
      throw new Error("Expected request envelope to be sent");
    }

    const requestEnvelope = JSON.parse(sent) as { id: string };
    socket.serverMessage(
      JSON.stringify({
        id: requestEnvelope.id,
        error: {
          message: "Push failed",
          code: "git_action_failed",
          data: {
            code: "branch_protected",
            phase: "push",
            title: "Protected branch rejected the push",
            summary: "GitHub blocked the push because this branch is protected.",
            detail: "remote: error: GH006",
            nextSteps: ["Create a feature branch.", "Open a pull request."],
          },
        },
      }),
    );

    await expect(requestPromise).rejects.toBeInstanceOf(WsRequestError);
    await expect(requestPromise).rejects.toMatchObject({
      message: "Push failed",
      code: "git_action_failed",
      data: expect.objectContaining({
        code: "branch_protected",
        phase: "push",
      }),
    });

    transport.dispose();
  });

  it("redacts secret-like values from rejected websocket errors", async () => {
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const requestPromise = transport.request("git.runStackedAction", { cwd: "/repo" });
    const sent = socket.sent.at(-1);
    if (!sent) {
      throw new Error("Expected request envelope to be sent");
    }

    const requestEnvelope = JSON.parse(sent) as { id: string };
    socket.serverMessage(
      JSON.stringify({
        id: requestEnvelope.id,
        error: {
          message: "Push failed for sk-proj-secret",
          code: "git_action_failed",
          data: {
            code: "unknown",
            phase: "push",
            title: "Push failed",
            summary: "Push failed for sk-proj-secret",
            detail: "token=abc123 OPENAI_API_KEY=sk-proj-secret",
            nextSteps: ["Unset OPENAI_API_KEY=sk-proj-secret"],
          },
        },
      }),
    );

    await expect(requestPromise).rejects.toMatchObject({
      message: "Push failed for [REDACTED]",
      code: "git_action_failed",
      data: {
        summary: "Push failed for [REDACTED]",
        detail: "token=[REDACTED] OPENAI_API_KEY=[REDACTED]",
        nextSteps: ["Unset OPENAI_API_KEY=[REDACTED]"],
      },
    });

    transport.dispose();
  });

  it("drops malformed envelopes without crashing transport", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const listener = vi.fn();
    transport.subscribe(WS_CHANNELS.serverConfigUpdated, listener);

    socket.serverMessage("{ invalid-json");
    socket.serverMessage(
      JSON.stringify({
        type: "push",
        sequence: 2,
        channel: 42,
        data: { bad: true },
      }),
    );
    socket.serverMessage(
      JSON.stringify({
        type: "push",
        sequence: 3,
        channel: WS_CHANNELS.serverConfigUpdated,
        data: { issues: [], providers: [] },
      }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      type: "push",
      sequence: 3,
      channel: WS_CHANNELS.serverConfigUpdated,
      data: { issues: [], providers: [] },
    });
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(
      1,
      "Dropped inbound WebSocket envelope",
      "SyntaxError: Expected property name or '}' in JSON at position 2 (line 1 column 3)",
    );
    expect(warnSpy).toHaveBeenNthCalledWith(
      2,
      "Dropped inbound WebSocket envelope",
      expect.stringContaining('Expected "server.configUpdated"'),
    );

    transport.dispose();
  });

  it("queues requests until the websocket opens", async () => {
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();

    const requestPromise = transport.request("projects.list");
    expect(socket.sent).toHaveLength(0);

    socket.open();
    expect(socket.sent).toHaveLength(1);
    const requestEnvelope = JSON.parse(socket.sent[0] ?? "{}") as { id: string };
    socket.serverMessage(
      JSON.stringify({
        id: requestEnvelope.id,
        result: { projects: [] },
      }),
    );

    await expect(requestPromise).resolves.toEqual({ projects: [] });
    transport.dispose();
  });

  it("does not create a timeout for requests with timeoutMs null", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const requestPromise = transport.request(
      "git.runStackedAction",
      { cwd: "/repo" },
      { timeoutMs: null },
    );
    const sent = socket.sent.at(-1);
    if (!sent) {
      throw new Error("Expected request envelope to be sent");
    }
    const requestEnvelope = JSON.parse(sent) as { id: string };

    socket.serverMessage(
      JSON.stringify({
        id: requestEnvelope.id,
        result: { ok: true },
      }),
    );

    await expect(requestPromise).resolves.toEqual({ ok: true });
    expect(timeoutSpy.mock.calls.some(([callback]) => typeof callback === "function")).toBe(false);

    transport.dispose();
  });

  it("rejects pending requests when the websocket closes", async () => {
    const transport = new WsTransport("ws://localhost:3020");
    const socket = getSocket();
    socket.open();

    const requestPromise = transport.request(
      "git.runStackedAction",
      { cwd: "/repo" },
      { timeoutMs: null },
    );

    socket.close();

    await expect(requestPromise).rejects.toThrow("WebSocket connection closed.");
    transport.dispose();
  });

  describe("reconnection detection", () => {
    it("fires onReconnected listener on reconnect but not initial connect", () => {
      vi.useFakeTimers();
      const transport = new WsTransport("ws://localhost:3020");
      const reconnectedListener = vi.fn();
      transport.onReconnected(reconnectedListener);

      // Initial connect – should NOT fire onReconnected
      const socket1 = getSocket();
      socket1.open();
      expect(reconnectedListener).not.toHaveBeenCalled();

      // Simulate disconnect
      socket1.close();

      // Advance past reconnect delay
      vi.advanceTimersByTime(1_000);
      const socket2 = getSocket();
      socket2.open();

      // Reconnect – should fire onReconnected
      expect(reconnectedListener).toHaveBeenCalledTimes(1);

      transport.dispose();
      vi.useRealTimers();
    });

    it("unsubscribes onReconnected when returned function is called", () => {
      vi.useFakeTimers();
      const transport = new WsTransport("ws://localhost:3020");
      const listener = vi.fn();
      const unsub = transport.onReconnected(listener);

      const socket1 = getSocket();
      socket1.open();
      socket1.close();
      vi.advanceTimersByTime(1_000);

      unsub();

      const socket2 = getSocket();
      socket2.open();

      expect(listener).not.toHaveBeenCalled();

      transport.dispose();
      vi.useRealTimers();
    });

    it("increments reconnectCount on each reconnection", () => {
      vi.useFakeTimers();
      const transport = new WsTransport("ws://localhost:3020");

      const socket1 = getSocket();
      socket1.open();
      expect(transport.getMetrics().reconnectCount).toBe(0);

      socket1.close();
      vi.advanceTimersByTime(1_000);
      const socket2 = getSocket();
      socket2.open();
      expect(transport.getMetrics().reconnectCount).toBe(1);

      socket2.close();
      vi.advanceTimersByTime(2_000);
      const socket3 = getSocket();
      socket3.open();
      expect(transport.getMetrics().reconnectCount).toBe(2);

      transport.dispose();
      vi.useRealTimers();
    });
  });

  describe("connection metrics", () => {
    it("tracks lastConnectedAt on open", () => {
      vi.useFakeTimers({ now: 1000 });
      const transport = new WsTransport("ws://localhost:3020");
      const socket = getSocket();
      socket.open();

      expect(transport.getMetrics().lastConnectedAt).toBe(1000);

      transport.dispose();
      vi.useRealTimers();
    });

    it("tracks lastDisconnectedAt on close", () => {
      vi.useFakeTimers({ now: 1000 });
      const transport = new WsTransport("ws://localhost:3020");
      const socket = getSocket();
      socket.open();

      vi.setSystemTime(5000);
      socket.close();

      expect(transport.getMetrics().lastDisconnectedAt).toBe(5000);

      transport.dispose();
      vi.useRealTimers();
    });

    it("computes cumulative uptime across connections", () => {
      vi.useFakeTimers({ now: 0 });
      const transport = new WsTransport("ws://localhost:3020");

      const socket1 = getSocket();
      vi.setSystemTime(100);
      socket1.open();

      vi.setSystemTime(1100); // 1000ms connected
      socket1.close();

      expect(transport.getMetrics().uptimeMs).toBe(1000);

      vi.advanceTimersByTime(500); // reconnect delay
      const socket2 = getSocket();
      vi.setSystemTime(2000);
      socket2.open();

      vi.setSystemTime(3000); // 1000ms more connected
      // Live uptime should include the current session
      expect(transport.getMetrics().uptimeMs).toBe(2000);

      transport.dispose();
      vi.useRealTimers();
    });
  });
});
