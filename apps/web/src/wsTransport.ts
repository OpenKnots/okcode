import {
  type WebSocketError as WebSocketErrorPayload,
  type WsPush,
  type WsPushChannel,
  type WsPushMessage,
  WebSocketResponse,
  type WsResponse as WsResponseMessage,
  WsResponse as WsResponseSchema,
} from "@okcode/contracts";
import { decodeUnknownJsonResult, formatSchemaError } from "@okcode/shared/schemaJson";
import { Result, Schema } from "effect";
import { resolveRuntimeWsUrl } from "./lib/runtimeBridge";

type PushListener<C extends WsPushChannel> = (message: WsPushMessage<C>) => void;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout> | null;
}

interface SubscribeOptions {
  readonly replayLatest?: boolean;
}

interface RequestOptions {
  readonly timeoutMs?: number | null;
}

export type TransportState = "connecting" | "open" | "reconnecting" | "closed" | "disposed";

export interface ConnectionMetrics {
  /** Number of times the transport has reconnected (excludes initial connect). */
  readonly reconnectCount: number;
  /** Timestamp (ms) of the last successful open. */
  readonly lastConnectedAt: number | null;
  /** Timestamp (ms) of the last disconnect. */
  readonly lastDisconnectedAt: number | null;
  /** Round-trip latency from the last heartbeat ping, in ms. */
  readonly latencyMs: number | null;
  /** Cumulative uptime in ms (time spent in "open" state). */
  readonly uptimeMs: number;
}

const REQUEST_TIMEOUT_MS = 60_000;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000];
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const decodeWsResponse = decodeUnknownJsonResult(WsResponseSchema);
const isWebSocketResponseEnvelope = Schema.is(WebSocketResponse);

const isWsPushMessage = (value: WsResponseMessage): value is WsPush =>
  "type" in value && value.type === "push";

interface WsRequestEnvelope {
  id: string;
  body: {
    _tag: string;
    [key: string]: unknown;
  };
}

function asError(value: unknown, fallback: string): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(fallback);
}

export class WsRequestError<T = unknown> extends Error {
  readonly code: string | undefined;
  readonly data: T | undefined;

  constructor(input: WebSocketErrorPayload) {
    super(input.message);
    this.name = "WsRequestError";
    this.code = input.code;
    this.data = input.data as T | undefined;
  }
}

export function isWsRequestError(value: unknown): value is WsRequestError {
  return value instanceof WsRequestError;
}

export class WsTransport {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly listeners = new Map<string, Set<(message: WsPush) => void>>();
  private readonly stateListeners = new Set<(state: TransportState) => void>();
  private readonly reconnectedListeners = new Set<() => void>();
  private readonly latestPushByChannel = new Map<string, WsPush>();
  private readonly outboundQueue: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private state: TransportState = "connecting";
  private hasConnectedOnce = false;
  private readonly url: string;

  // ── Connection metrics ──────────────────────────────────────────────
  private _reconnectCount = 0;
  private _lastConnectedAt: number | null = null;
  private _lastDisconnectedAt: number | null = null;
  private _latencyMs: number | null = null;
  private _uptimeMs = 0;
  private _uptimeAnchor: number | null = null;

  constructor(url?: string) {
    this.url = resolveRuntimeWsUrl(url);
    this.connect();
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    if (typeof method !== "string" || method.length === 0) {
      throw new Error("Request method is required");
    }

    const id = String(this.nextId++);
    const body = params != null ? { ...params, _tag: method } : { _tag: method };
    const message: WsRequestEnvelope = { id, body };
    const encoded = JSON.stringify(message);

    return new Promise<T>((resolve, reject) => {
      const timeoutMs = options?.timeoutMs === undefined ? REQUEST_TIMEOUT_MS : options.timeoutMs;
      const timeout =
        timeoutMs === null
          ? null
          : setTimeout(() => {
              this.pending.delete(id);
              reject(new Error(`Request timed out: ${method}`));
            }, timeoutMs);

      this.pending.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      });

      this.send(encoded);
    });
  }

  subscribe<C extends WsPushChannel>(
    channel: C,
    listener: PushListener<C>,
    options?: SubscribeOptions,
  ): () => void {
    let channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      channelListeners = new Set<(message: WsPush) => void>();
      this.listeners.set(channel, channelListeners);
    }

    const wrappedListener = (message: WsPush) => {
      listener(message as WsPushMessage<C>);
    };
    channelListeners.add(wrappedListener);

    if (options?.replayLatest) {
      const latest = this.latestPushByChannel.get(channel);
      if (latest) {
        wrappedListener(latest);
      }
    }

    return () => {
      channelListeners?.delete(wrappedListener);
      if (channelListeners?.size === 0) {
        this.listeners.delete(channel);
      }
    };
  }

  getLatestPush<C extends WsPushChannel>(channel: C): WsPushMessage<C> | null {
    const latest = this.latestPushByChannel.get(channel);
    return latest ? (latest as WsPushMessage<C>) : null;
  }

  getState(): TransportState {
    return this.state;
  }

  subscribeState(listener: (state: TransportState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to reconnection events. The listener fires each time the
   * transport transitions back to "open" after a prior successful connection.
   * This is the hook for triggering data re-sync after a network interruption.
   */
  onReconnected(listener: () => void): () => void {
    this.reconnectedListeners.add(listener);
    return () => {
      this.reconnectedListeners.delete(listener);
    };
  }

  /**
   * Read-only snapshot of connection health metrics.
   */
  getMetrics(): ConnectionMetrics {
    const liveUptime =
      this._uptimeAnchor !== null
        ? this._uptimeMs + (Date.now() - this._uptimeAnchor)
        : this._uptimeMs;

    return {
      reconnectCount: this._reconnectCount,
      lastConnectedAt: this._lastConnectedAt,
      lastDisconnectedAt: this._lastDisconnectedAt,
      latencyMs: this._latencyMs,
      uptimeMs: liveUptime,
    };
  }

  dispose() {
    this.disposed = true;
    this.stopHeartbeat();
    this.freezeUptime();
    this.setState("disposed");
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const pending of this.pending.values()) {
      if (pending.timeout !== null) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error("Transport disposed"));
    }
    this.pending.clear();
    this.outboundQueue.length = 0;
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    if (this.disposed) {
      return;
    }

    this.setState(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
    const ws = new WebSocket(this.url);

    ws.addEventListener("open", () => {
      this.ws = ws;
      const isReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      this._lastConnectedAt = Date.now();
      this._uptimeAnchor = Date.now();

      if (isReconnect) {
        this._reconnectCount += 1;
      }

      this.setState("open");
      this.reconnectAttempt = 0;
      this.flushQueue();
      this.startHeartbeat();

      if (isReconnect) {
        this.emitReconnected();
      }
    });

    ws.addEventListener("message", (event) => {
      this.handleMessage(event.data);
    });

    ws.addEventListener("close", () => {
      if (this.ws === ws) {
        this.ws = null;
        this.stopHeartbeat();
        this.freezeUptime();
        this._lastDisconnectedAt = Date.now();
        this.outboundQueue.length = 0;
        for (const [id, pending] of this.pending.entries()) {
          if (pending.timeout !== null) {
            clearTimeout(pending.timeout);
          }
          this.pending.delete(id);
          pending.reject(new Error("WebSocket connection closed."));
        }
      }
      if (this.disposed) {
        this.setState("disposed");
        return;
      }
      this.setState("closed");
      this.scheduleReconnect();
    });

    ws.addEventListener("error", (event) => {
      // Log WebSocket errors for debugging (close event will follow)
      console.warn("WebSocket connection error", { type: event.type, url: this.url });
    });
  }

  private handleMessage(raw: unknown) {
    const result = decodeWsResponse(raw);
    if (Result.isFailure(result)) {
      console.warn("Dropped inbound WebSocket envelope", formatSchemaError(result.failure));
      return;
    }

    const message = result.success;
    if (isWsPushMessage(message)) {
      this.latestPushByChannel.set(message.channel, message);
      const channelListeners = this.listeners.get(message.channel);
      if (channelListeners) {
        for (const listener of channelListeners) {
          try {
            listener(message);
          } catch {
            // Swallow listener errors
          }
        }
      }
      return;
    }

    if (!isWebSocketResponseEnvelope(message)) {
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }

    if (pending.timeout !== null) {
      clearTimeout(pending.timeout);
    }
    this.pending.delete(message.id);

    if (message.error) {
      pending.reject(new WsRequestError(message.error));
      return;
    }

    pending.resolve(message.result);
  }

  private send(encodedMessage: string) {
    if (this.disposed) {
      return;
    }

    this.outboundQueue.push(encodedMessage);
    try {
      this.flushQueue();
    } catch {
      // Swallow: flushQueue has queued the message for retry on reconnect
    }
  }

  private flushQueue() {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    while (this.outboundQueue.length > 0) {
      const message = this.outboundQueue.shift();
      if (!message) {
        continue;
      }
      try {
        this.ws.send(message);
      } catch (error) {
        this.outboundQueue.unshift(message);
        throw asError(error, "Failed to send WebSocket request.");
      }
    }
  }

  private scheduleReconnect() {
    if (this.disposed || this.reconnectTimer !== null) {
      return;
    }

    const delay =
      RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ??
      RECONNECT_DELAYS_MS[0]!;

    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private setState(nextState: TransportState) {
    if (this.state === nextState) {
      return;
    }
    this.state = nextState;
    for (const listener of this.stateListeners) {
      try {
        listener(nextState);
      } catch {
        // Swallow listener errors
      }
    }

    // Emit a custom event so the mobile bridge can track connection state
    // without a direct import dependency on the transport.
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("okcode:transport-state", { detail: nextState }));
      } catch {
        // Swallow dispatch errors in non-browser environments.
      }
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────────

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        return;
      }
      const sentAt = Date.now();
      // Use the server.ping RPC method with a tight timeout.
      // If the server doesn't respond within HEARTBEAT_TIMEOUT_MS the
      // pending-request timeout will reject and the normal close/reconnect
      // path takes over.
      this.request<{ pong: boolean; serverTime: number }>("server.ping", undefined, {
        timeoutMs: HEARTBEAT_TIMEOUT_MS,
      })
        .then(() => {
          this._latencyMs = Date.now() - sentAt;
        })
        .catch(() => {
          // Timeout or error – the close handler will schedule reconnection.
          this._latencyMs = null;
        });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeout !== null) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // ── Uptime tracking ───────────────────────────────────────────────

  private freezeUptime() {
    if (this._uptimeAnchor !== null) {
      this._uptimeMs += Date.now() - this._uptimeAnchor;
      this._uptimeAnchor = null;
    }
  }

  // ── Reconnection emit ─────────────────────────────────────────────

  private emitReconnected() {
    for (const listener of this.reconnectedListeners) {
      try {
        listener();
      } catch {
        // Swallow listener errors
      }
    }

    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent("okcode:transport-reconnected"));
      } catch {
        // Swallow dispatch errors in non-browser environments.
      }
    }
  }
}
