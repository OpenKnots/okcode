import NodeWebSocket from "ws";

import type { OpenclawDeviceIdentity } from "./deviceAuth.ts";
import { signOpenclawDeviceChallenge } from "./deviceAuth.ts";
import {
  assertRequiredMethods,
  extractHelloMethods,
  extractHelloPayload,
  formatGatewayError,
  OPENCLAW_OPERATOR_SCOPES,
  OPENCLAW_PROTOCOL_VERSION,
  parseGatewayError,
  parseGatewayFrame,
  readString,
  type GatewayFrame,
  type OpenclawHelloAuth,
  type OpenclawHelloPayload,
  type ParsedGatewayError,
} from "./protocol.ts";

const WS_CONNECT_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

export interface OpenclawGatewayClientOptions {
  readonly url: string;
  readonly identity: OpenclawDeviceIdentity;
  readonly sharedSecret?: string;
  readonly deviceToken?: string;
  readonly deviceTokenRole?: string;
  readonly deviceTokenScopes?: ReadonlyArray<string>;
  readonly clientId: string;
  readonly clientVersion: string;
  readonly clientPlatform: string;
  readonly clientMode: string;
  readonly locale: string;
  readonly userAgent: string;
  readonly role?: string;
  readonly scopes?: ReadonlyArray<string>;
  readonly requiredMethods?: ReadonlyArray<string>;
}

export interface OpenclawGatewayConnectResult {
  readonly hello: OpenclawHelloPayload | undefined;
  readonly auth: OpenclawHelloAuth | undefined;
  readonly methods: Set<string>;
  readonly usedStoredDeviceToken: boolean;
}

interface PendingRequest {
  readonly method: string;
  readonly resolve: (payload: unknown) => void;
  readonly reject: (error: unknown) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

interface PendingEventWaiter {
  readonly eventName: string;
  readonly resolve: (payload: Record<string, unknown> | undefined) => void;
  readonly reject: (error: unknown) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export class OpenclawGatewayClientError extends Error {
  readonly gatewayError: ParsedGatewayError | undefined;
  readonly socketCloseCode: number | undefined;
  readonly socketCloseReason: string | undefined;

  constructor(
    message: string,
    options?: {
      readonly gatewayError?: ParsedGatewayError;
      readonly socketCloseCode?: number;
      readonly socketCloseReason?: string;
      readonly cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "OpenclawGatewayClientError";
    this.gatewayError = options?.gatewayError;
    this.socketCloseCode = options?.socketCloseCode;
    this.socketCloseReason = options?.socketCloseReason;
  }
}

function uniqueScopes(scopes: ReadonlyArray<string> | undefined): string[] {
  const values = new Set<string>();
  for (const scope of scopes ?? []) {
    const trimmed = scope.trim();
    if (trimmed.length > 0) {
      values.add(trimmed);
    }
  }
  return [...values];
}

function isPasswordAuthError(error: ParsedGatewayError | undefined): boolean {
  return (
    error?.detailCode === "AUTH_PASSWORD_MISSING" || error?.detailCode === "AUTH_PASSWORD_MISMATCH"
  );
}

function closeDetail(code: number | undefined, reason: string | undefined): string {
  if (code === undefined) {
    return "";
  }
  return reason && reason.length > 0 ? ` (code ${code}: ${reason})` : ` (code ${code})`;
}

function clientErrorOptions(input: {
  readonly gatewayError: ParsedGatewayError | undefined;
  readonly socketCloseCode: number | undefined;
  readonly socketCloseReason: string | undefined;
  readonly cause: unknown;
}) {
  return {
    ...(input.gatewayError !== undefined ? { gatewayError: input.gatewayError } : {}),
    ...(input.socketCloseCode !== undefined ? { socketCloseCode: input.socketCloseCode } : {}),
    ...(input.socketCloseReason !== undefined
      ? { socketCloseReason: input.socketCloseReason }
      : {}),
    ...(input.cause !== undefined ? { cause: input.cause } : {}),
  };
}

export class OpenclawGatewayClient {
  static async connect(options: OpenclawGatewayClientOptions): Promise<{
    client: OpenclawGatewayClient;
    connect: OpenclawGatewayConnectResult;
  }> {
    const client = new OpenclawGatewayClient(options);
    try {
      const connectResult = await client.connectInternal();
      return { client, connect: connectResult };
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  private readonly options: OpenclawGatewayClientOptions;
  private ws: NodeWebSocket | null = null;
  private nextRequestId = 1;
  private closed = false;
  private closeCode: number | undefined = undefined;
  private closeReason: string | undefined = undefined;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private readonly pendingEventWaiters = new Set<PendingEventWaiter>();
  private readonly bufferedEvents: GatewayFrame[] = [];
  private readonly eventListeners = new Set<(event: GatewayFrame) => void>();
  private readonly closeListeners = new Set<(error?: OpenclawGatewayClientError) => void>();

  readonly methods = new Set<string>();
  hello: OpenclawHelloPayload | undefined = undefined;
  auth: OpenclawHelloAuth | undefined = undefined;

  private constructor(options: OpenclawGatewayClientOptions) {
    this.options = options;
  }

  onEvent(listener: (event: GatewayFrame) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  onClose(listener: (error?: OpenclawGatewayClientError) => void): () => void {
    this.closeListeners.add(listener);
    return () => {
      this.closeListeners.delete(listener);
    };
  }

  async request(method: string, params?: Record<string, unknown>, timeoutMs = REQUEST_TIMEOUT_MS) {
    const socket = this.ws;
    if (!socket || socket.readyState !== NodeWebSocket.OPEN) {
      throw new OpenclawGatewayClientError(`WebSocket is not open for request '${method}'.`, {
        ...clientErrorOptions({
          gatewayError: undefined,
          socketCloseCode: this.closeCode,
          socketCloseReason: this.closeReason,
          cause: undefined,
        }),
      });
    }

    const id = String(this.nextRequestId++);
    const payload = JSON.stringify({
      type: "req",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    });

    return await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new OpenclawGatewayClientError(
            `Gateway request '${method}' timed out after ${timeoutMs}ms.`,
            clientErrorOptions({
              gatewayError: undefined,
              socketCloseCode: this.closeCode,
              socketCloseReason: this.closeReason,
              cause: undefined,
            }),
          ),
        );
      }, timeoutMs);

      this.pendingRequests.set(id, {
        method,
        resolve,
        reject,
        timeout,
      });

      try {
        socket.send(payload);
      } catch (cause) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(
          new OpenclawGatewayClientError(`Failed to send gateway request '${method}'.`, {
            ...clientErrorOptions({
              gatewayError: undefined,
              cause,
              socketCloseCode: this.closeCode,
              socketCloseReason: this.closeReason,
            }),
          }),
        );
      }
    });
  }

  async waitForEvent(eventName: string, timeoutMs = REQUEST_TIMEOUT_MS) {
    const bufferedIndex = this.bufferedEvents.findIndex(
      (event) => event.type === "event" && event.event === eventName,
    );
    if (bufferedIndex >= 0) {
      const [event] = this.bufferedEvents.splice(bufferedIndex, 1);
      if (event) {
        return this.framePayload(event);
      }
    }

    return await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingEventWaiters.delete(waiter);
        reject(
          new OpenclawGatewayClientError(
            `Gateway event '${eventName}' timed out after ${timeoutMs}ms.`,
            clientErrorOptions({
              gatewayError: undefined,
              socketCloseCode: this.closeCode,
              socketCloseReason: this.closeReason,
              cause: undefined,
            }),
          ),
        );
      }, timeoutMs);

      const waiter: PendingEventWaiter = {
        eventName,
        resolve: (payload) => {
          clearTimeout(timeout);
          resolve(payload);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
      };
      this.pendingEventWaiters.add(waiter);
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    const socket = this.ws;
    this.ws = null;
    if (!socket) {
      return;
    }
    if (socket.readyState === NodeWebSocket.CLOSED || socket.readyState === NodeWebSocket.CLOSING) {
      return;
    }
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  private async connectInternal(): Promise<OpenclawGatewayConnectResult> {
    const canUseStoredDeviceToken =
      typeof this.options.deviceToken === "string" && this.options.deviceToken.length > 0;

    try {
      return await this.performConnectAttempt("sharedToken");
    } catch (caughtError) {
      let error = caughtError;
      let parsedError =
        error instanceof OpenclawGatewayClientError ? error.gatewayError : undefined;

      if (this.options.sharedSecret !== undefined && isPasswordAuthError(parsedError)) {
        await this.closeCurrentSocket();
        try {
          return await this.performConnectAttempt("sharedPassword");
        } catch (passwordError) {
          error = passwordError;
          parsedError =
            passwordError instanceof OpenclawGatewayClientError
              ? passwordError.gatewayError
              : undefined;
        }
      }

      const shouldRetryWithDeviceToken =
        canUseStoredDeviceToken &&
        parsedError?.canRetryWithDeviceToken === true &&
        this.options.sharedSecret !== undefined;
      if (shouldRetryWithDeviceToken) {
        await this.closeCurrentSocket();
        return await this.performConnectAttempt("deviceToken");
      }

      throw error;
    }
  }

  private async performConnectAttempt(
    authMode: "sharedToken" | "sharedPassword" | "deviceToken",
  ): Promise<OpenclawGatewayConnectResult> {
    await this.openSocket();
    const challenge = await this.waitForEvent("connect.challenge");
    const nonce = readString(challenge?.nonce);
    if (!nonce) {
      throw new OpenclawGatewayClientError("Gateway challenge did not include a nonce.");
    }

    const signedAt =
      typeof challenge?.ts === "number" && Number.isFinite(challenge.ts)
        ? challenge.ts
        : Date.now();
    const role = this.options.role ?? "operator";
    const scopes =
      authMode === "deviceToken" && uniqueScopes(this.options.deviceTokenScopes).length > 0
        ? uniqueScopes(this.options.deviceTokenScopes)
        : uniqueScopes(this.options.scopes ?? OPENCLAW_OPERATOR_SCOPES);
    const authToken =
      authMode === "deviceToken"
        ? (this.options.deviceToken ?? "")
        : authMode === "sharedToken"
          ? (this.options.sharedSecret ?? "")
          : "";
    const authPassword = authMode === "sharedPassword" ? (this.options.sharedSecret ?? "") : "";
    const signedDevice = signOpenclawDeviceChallenge(this.options.identity, {
      clientId: this.options.clientId,
      clientMode: this.options.clientMode,
      role,
      scopes,
      token: authToken,
      nonce,
      signedAt,
    });

    const helloPayload = await this.request("connect", {
      minProtocol: OPENCLAW_PROTOCOL_VERSION,
      maxProtocol: OPENCLAW_PROTOCOL_VERSION,
      client: {
        id: this.options.clientId,
        version: this.options.clientVersion,
        platform: this.options.clientPlatform,
        mode: this.options.clientMode,
      },
      role,
      scopes,
      caps: [],
      commands: [],
      permissions: {},
      ...(authMode === "sharedToken" && authToken.length > 0 ? { auth: { token: authToken } } : {}),
      ...(authMode === "sharedPassword" && authPassword.length > 0
        ? { auth: { password: authPassword } }
        : {}),
      ...(authMode === "deviceToken" && authToken.length > 0
        ? { auth: { deviceToken: authToken } }
        : {}),
      locale: this.options.locale,
      userAgent: this.options.userAgent,
      device: signedDevice,
    });

    const hello = extractHelloPayload(helloPayload);
    const methods = extractHelloMethods(hello);
    if (this.options.requiredMethods && this.options.requiredMethods.length > 0) {
      assertRequiredMethods(methods, this.options.requiredMethods);
    }

    this.hello = hello;
    this.auth = hello?.auth;
    this.methods.clear();
    for (const method of methods) {
      this.methods.add(method);
    }

    return {
      hello,
      auth: hello?.auth,
      methods,
      usedStoredDeviceToken: authMode === "deviceToken",
    };
  }

  private framePayload(frame: GatewayFrame): Record<string, unknown> | undefined {
    return typeof frame.payload === "object" && frame.payload !== null
      ? (frame.payload as Record<string, unknown>)
      : undefined;
  }

  private async openSocket(): Promise<void> {
    await this.closeCurrentSocket();
    this.closeCode = undefined;
    this.closeReason = undefined;
    this.closed = false;

    this.ws = await new Promise<NodeWebSocket>((resolve, reject) => {
      const socket = new NodeWebSocket(this.options.url);
      const timeout = setTimeout(() => {
        socket.close();
        reject(
          new OpenclawGatewayClientError(
            `WebSocket connection to ${this.options.url} timed out after ${WS_CONNECT_TIMEOUT_MS}ms.`,
          ),
        );
      }, WS_CONNECT_TIMEOUT_MS);

      socket.on("open", () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      socket.on("error", (cause) => {
        clearTimeout(timeout);
        reject(
          new OpenclawGatewayClientError(
            `WebSocket connection to ${this.options.url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            clientErrorOptions({
              gatewayError: undefined,
              socketCloseCode: undefined,
              socketCloseReason: undefined,
              cause,
            }),
          ),
        );
      });
      this.attachSocketHandlers(socket);
    });
  }

  private attachSocketHandlers(socket: NodeWebSocket) {
    socket.on("message", (data) => {
      const frame = parseGatewayFrame(data);
      if (!frame) {
        return;
      }

      if (frame.type === "res" && frame.id !== undefined && frame.id !== null) {
        const pending = this.pendingRequests.get(String(frame.id));
        if (!pending) {
          return;
        }
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(String(frame.id));
        if (frame.ok === true) {
          pending.resolve(frame.payload);
          return;
        }
        const gatewayError = parseGatewayError(frame.error);
        pending.reject(
          new OpenclawGatewayClientError(
            formatGatewayError(gatewayError),
            clientErrorOptions({
              gatewayError,
              socketCloseCode: this.closeCode,
              socketCloseReason: this.closeReason,
              cause: undefined,
            }),
          ),
        );
        return;
      }

      if (frame.type === "event" && typeof frame.event === "string") {
        let matchedWaiter = false;
        for (const waiter of this.pendingEventWaiters) {
          if (waiter.eventName === frame.event) {
            matchedWaiter = true;
            this.pendingEventWaiters.delete(waiter);
            waiter.resolve(this.framePayload(frame));
          }
        }
        if (!matchedWaiter) {
          this.bufferedEvents.push(frame);
        }
      }

      for (const listener of this.eventListeners) {
        listener(frame);
      }
    });

    socket.on("close", (code, reasonBuffer) => {
      this.closeCode = code;
      const reason = reasonBuffer.toString("utf8");
      this.closeReason = reason.length > 0 ? reason : undefined;
      const error =
        this.closed || (code === 1000 && !this.closeReason)
          ? undefined
          : new OpenclawGatewayClientError(
              `WebSocket closed before the gateway exchange completed${closeDetail(code, this.closeReason)}.`,
              clientErrorOptions({
                gatewayError: undefined,
                socketCloseCode: code,
                socketCloseReason: this.closeReason,
                cause: undefined,
              }),
            );

      for (const [, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(
          error ??
            new OpenclawGatewayClientError(`Gateway request '${pending.method}' was interrupted.`),
        );
      }
      this.pendingRequests.clear();

      for (const waiter of this.pendingEventWaiters) {
        clearTimeout(waiter.timeout);
        waiter.reject(
          error ??
            new OpenclawGatewayClientError(
              `Gateway event '${waiter.eventName}' was interrupted.`,
              clientErrorOptions({
                gatewayError: undefined,
                socketCloseCode: code,
                socketCloseReason: this.closeReason,
                cause: undefined,
              }),
            ),
        );
      }
      this.pendingEventWaiters.clear();

      for (const listener of this.closeListeners) {
        listener(error);
      }
    });
  }

  private async closeCurrentSocket() {
    if (!this.ws) {
      return;
    }
    const socket = this.ws;
    this.ws = null;
    await new Promise<void>((resolve) => {
      if (
        socket.readyState === NodeWebSocket.CLOSED ||
        socket.readyState === NodeWebSocket.CLOSING
      ) {
        resolve();
        return;
      }
      socket.once("close", () => resolve());
      socket.close();
    });
  }
}
