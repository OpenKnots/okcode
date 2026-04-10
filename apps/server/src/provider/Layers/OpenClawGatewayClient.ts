import {
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  createPrivateKey,
  createPublicKey,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import WebSocket from "ws";

const OPENCLAW_PROTOCOL_VERSION = 3;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const AUTH_STATE_FILE_NAME = "openclaw-gateway-auth.json";

export interface OpenClawGatewayClientInfo {
  readonly id: string;
  readonly version: string;
  readonly platform: string;
  readonly mode: "operator" | "node";
}

export interface OpenClawGatewayConnectOptions {
  readonly gatewayUrl: string;
  readonly stateDir?: string;
  readonly sessionKey?: string;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly client: OpenClawGatewayClientInfo;
  readonly userAgent: string;
  readonly locale?: string;
  readonly caps?: ReadonlyArray<string>;
  readonly commands?: ReadonlyArray<string>;
  readonly permissions?: Record<string, boolean>;
  readonly password?: string;
  readonly deviceToken?: string;
  readonly onEvent?: (event: OpenClawGatewayEvent) => void;
  readonly connectTimeoutMs?: number;
  readonly requestTimeoutMs?: number;
}

export interface OpenClawGatewayEvent {
  readonly event: string;
  readonly payload?: unknown;
  readonly seq?: number;
  readonly stateVersion?: number;
}

export interface OpenClawGatewayError {
  readonly code?: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export interface OpenClawGatewayRequestResult<T = unknown> {
  readonly ok: boolean;
  readonly payload?: T;
  readonly error?: OpenClawGatewayError;
}

export interface OpenClawGatewayConnection {
  readonly origin: string;
  readonly sessionKey: string;
  readonly deviceId: string;
  request<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<OpenClawGatewayRequestResult<T>>;
  close(): Promise<void>;
}

interface PersistedOpenClawGatewayAuthState {
  readonly version: 1;
  readonly device: {
    readonly id: string;
    readonly privateKeyPem: string;
    readonly publicKeyPem: string;
  };
  readonly deviceTokens: Record<string, string>;
}

interface OpenClawDeviceIdentity {
  readonly id: string;
  readonly privateKeyPem: string;
  readonly publicKeyPem: string;
}

interface GatewayFrame {
  readonly type?: unknown;
  readonly id?: unknown;
  readonly ok?: unknown;
  readonly method?: unknown;
  readonly event?: unknown;
  readonly params?: unknown;
  readonly payload?: unknown;
  readonly error?: unknown;
}

interface GatewayChallengePayload {
  readonly nonce?: unknown;
  readonly ts?: unknown;
}

interface GatewayConnectPayload {
  readonly type?: unknown;
  readonly protocol?: unknown;
  readonly auth?: {
    readonly deviceToken?: unknown;
  };
}

type OpenClawGatewayAuthSelection =
  | { readonly kind: "password"; readonly value: string }
  | { readonly kind: "deviceToken"; readonly value: string }
  | { readonly kind: "none" };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizePathSegments(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-");
}

function getDefaultStateDir(): string {
  return join(os.tmpdir(), "okcode-openclaw-gateway");
}

function getAuthStatePath(stateDir: string): string {
  return join(stateDir, "openclaw", AUTH_STATE_FILE_NAME);
}

function exportPublicKeyPem(publicKey: ReturnType<typeof createPublicKey>): string {
  return publicKey.export({ format: "pem", type: "spki" }).toString();
}

function exportPrivateKeyPem(privateKey: ReturnType<typeof createPrivateKey>): string {
  return privateKey.export({ format: "pem", type: "pkcs8" }).toString();
}

function fingerprintPublicKey(publicKeyPem: string): string {
  const publicKey = createPublicKey(publicKeyPem);
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  return createHash("sha256").update(publicKeyDer).digest("hex");
}

function makeDeviceIdentity(): OpenClawDeviceIdentity {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = exportPrivateKeyPem(privateKey);
  const publicKeyPem = exportPublicKeyPem(publicKey);
  const deviceId = `device_${fingerprintPublicKey(publicKeyPem)}`;
  return {
    id: deviceId,
    privateKeyPem,
    publicKeyPem,
  };
}

function buildSignaturePayload(input: {
  readonly nonce: string;
  readonly signedAt: number;
  readonly client: OpenClawGatewayClientInfo;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly authValue: string | undefined;
  readonly deviceFamily: string;
}): string {
  return JSON.stringify({
    version: 3,
    nonce: input.nonce,
    signedAt: input.signedAt,
    client: input.client,
    role: input.role,
    scopes: input.scopes,
    authValue: input.authValue ?? null,
    deviceFamily: input.deviceFamily,
  });
}

function signChallenge(
  identity: OpenClawDeviceIdentity,
  input: Parameters<typeof buildSignaturePayload>[0],
): string {
  const privateKey = createPrivateKey(identity.privateKeyPem);
  const signature = cryptoSign(null, Buffer.from(buildSignaturePayload(input)), privateKey);
  return signature.toString("base64");
}

async function readAuthState(stateDir: string): Promise<PersistedOpenClawGatewayAuthState | null> {
  try {
    const raw = await readFile(getAuthStatePath(stateDir), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (
      !isObject(parsed) ||
      parsed.version !== 1 ||
      !isObject(parsed.device) ||
      typeof parsed.device.id !== "string" ||
      typeof parsed.device.privateKeyPem !== "string" ||
      typeof parsed.device.publicKeyPem !== "string" ||
      !isObject(parsed.deviceTokens)
    ) {
      return null;
    }
    return {
      version: 1,
      device: {
        id: parsed.device.id,
        privateKeyPem: parsed.device.privateKeyPem,
        publicKeyPem: parsed.device.publicKeyPem,
      },
      deviceTokens: Object.fromEntries(
        Object.entries(parsed.deviceTokens).filter(
          ([origin, token]) => typeof origin === "string" && typeof token === "string",
        ),
      ),
    };
  } catch {
    return null;
  }
}

async function writeAuthState(
  stateDir: string,
  state: PersistedOpenClawGatewayAuthState,
): Promise<void> {
  await mkdir(join(stateDir, "openclaw"), { recursive: true });
  await writeFile(getAuthStatePath(stateDir), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

class OpenClawGatewayAuthStore {
  private cachedState: PersistedOpenClawGatewayAuthState | undefined;

  constructor(private readonly stateDir: string) {}

  private async loadState(): Promise<PersistedOpenClawGatewayAuthState> {
    if (this.cachedState !== undefined) {
      return this.cachedState;
    }

    const loaded = (await readAuthState(this.stateDir)) ?? {
      version: 1,
      device: makeDeviceIdentity(),
      deviceTokens: {},
    };
    this.cachedState = loaded;
    if ((await readAuthState(this.stateDir)) === null) {
      await writeAuthState(this.stateDir, loaded);
    }
    return loaded;
  }

  async getDeviceIdentity(): Promise<OpenClawDeviceIdentity> {
    const state = await this.loadState();
    return state.device;
  }

  async getDeviceToken(origin: string): Promise<string | undefined> {
    const state = await this.loadState();
    return state.deviceTokens[origin];
  }

  async persistDeviceToken(origin: string, token: string): Promise<void> {
    const state = await this.loadState();
    if (state.deviceTokens[origin] === token) {
      return;
    }
    this.cachedState = {
      ...state,
      deviceTokens: {
        ...state.deviceTokens,
        [origin]: token,
      },
    };
    await writeAuthState(this.stateDir, this.cachedState);
  }
}

function parseFrame(data: WebSocket.Data): GatewayFrame | null {
  try {
    const raw =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString("utf8")
          : Array.isArray(data)
            ? Buffer.concat(data).toString("utf8")
            : data.toString("utf8");
    const parsed = JSON.parse(raw) as unknown;
    return isObject(parsed) ? (parsed as GatewayFrame) : null;
  } catch {
    return null;
  }
}

function makeRequestError(message: string): Error {
  return new Error(message);
}

function toGatewayError(frameError: unknown): OpenClawGatewayError {
  if (!isObject(frameError)) {
    return { message: "Gateway request failed." };
  }
  const details = isObject(frameError.details) ? frameError.details : undefined;
  return {
    message: readString(frameError.message) ?? "Gateway request failed.",
    ...(readString(frameError.code) ? { code: readString(frameError.code) } : {}),
    ...(details ? { details } : {}),
  };
}

function buildConnectParams(input: {
  readonly client: OpenClawGatewayClientInfo;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly auth: OpenClawGatewayAuthSelection;
  readonly challengeNonce: string;
  readonly deviceIdentity: OpenClawDeviceIdentity;
  readonly userAgent: string;
  readonly locale?: string;
  readonly caps?: ReadonlyArray<string>;
  readonly commands?: ReadonlyArray<string>;
  readonly permissions?: Record<string, boolean>;
  readonly deviceFamily: string;
}): Record<string, unknown> {
  const signedAt = Date.now();
  return {
    minProtocol: OPENCLAW_PROTOCOL_VERSION,
    maxProtocol: OPENCLAW_PROTOCOL_VERSION,
    client: input.client,
    role: input.role,
    scopes: [...input.scopes],
    caps: [...(input.caps ?? [])],
    commands: [...(input.commands ?? [])],
    permissions: { ...(input.permissions ?? {}) },
    ...(input.auth.kind === "password"
      ? {
          auth: {
            password: input.auth.value,
          },
        }
      : input.auth.kind === "deviceToken"
        ? {
            auth: {
              deviceToken: input.auth.value,
            },
          }
        : {}),
    locale: input.locale ?? (Intl.DateTimeFormat().resolvedOptions().locale || "en-US"),
    userAgent: input.userAgent,
    device: {
      id: input.deviceIdentity.id,
      publicKey: input.deviceIdentity.publicKeyPem,
      signature: signChallenge(input.deviceIdentity, {
        nonce: input.challengeNonce,
        signedAt,
        client: input.client,
        role: input.role,
        scopes: input.scopes,
        authValue: input.authValue,
        deviceFamily: input.deviceFamily,
      }),
      signedAt,
      nonce: input.challengeNonce,
    },
  };
}

function isDeviceTokenError(error: OpenClawGatewayError | undefined): boolean {
  const code =
    error?.details && isObject(error.details) ? readString(error.details.code) : undefined;
  return (
    code === "AUTH_TOKEN_MISMATCH" ||
    code === "AUTH_DEVICE_TOKEN_MISMATCH" ||
    code?.startsWith("DEVICE_AUTH_") === true ||
    error?.message.toLowerCase().includes("auth_token_mismatch") === true
  );
}

export function createOpenClawIdempotencyKey(parts: ReadonlyArray<string>): string {
  return `okcode-${createHash("sha256").update(parts.join("\u0000")).digest("hex")}`;
}

export async function connectOpenClawGateway(
  options: OpenClawGatewayConnectOptions,
): Promise<OpenClawGatewayConnection> {
  const parsedUrl = new URL(options.gatewayUrl);
  const origin = parsedUrl.origin;
  const stateDir = options.stateDir ?? getDefaultStateDir();
  const authStore = new OpenClawGatewayAuthStore(stateDir);
  const deviceIdentity = await authStore.getDeviceIdentity();
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const deviceFamily = "server";

  const candidateAuthSelections: OpenClawGatewayAuthSelection[] = [];
  if (options.password && options.password.length > 0) {
    candidateAuthSelections.push({ kind: "password", value: options.password });
  }
  if (options.deviceToken && options.deviceToken.length > 0) {
    candidateAuthSelections.push({ kind: "deviceToken", value: options.deviceToken });
  }
  const cachedDeviceToken = await authStore.getDeviceToken(origin);
  if (cachedDeviceToken) {
    candidateAuthSelections.push({ kind: "deviceToken", value: cachedDeviceToken });
  }
  if (candidateAuthSelections.length === 0) {
    candidateAuthSelections.push({ kind: "none" });
  }

  let lastError: Error | undefined;

  for (let index = 0; index < candidateAuthSelections.length; index += 1) {
    const auth = candidateAuthSelections[index];
    try {
      const connection = await connectOnce({
        gatewayUrl: options.gatewayUrl,
        origin,
        authStore,
        deviceIdentity,
        auth,
        connectTimeoutMs,
        requestTimeoutMs,
        onEvent: options.onEvent,
        client: options.client,
        role: options.role,
        scopes: options.scopes,
        userAgent: options.userAgent,
        locale: options.locale,
        caps: options.caps,
        commands: options.commands,
        permissions: options.permissions,
        deviceFamily,
        sessionKey: options.sessionKey ?? `okcode:${normalizePathSegments(options.client.id)}`,
      });
      return connection;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      lastError = error;
      const parsedError = error as Error & { readonly gatewayError?: OpenClawGatewayError };
      const gatewayError = parsedError.gatewayError;
      const usedExplicitPassword = options.password !== undefined && options.password.length > 0;
      const canRetryWithCachedToken =
        usedExplicitPassword &&
        cachedDeviceToken !== undefined &&
        auth.kind === "password" &&
        isDeviceTokenError(gatewayError);

      if (!canRetryWithCachedToken || index + 1 >= candidateAuthSelections.length) {
        break;
      }
    }
  }

  throw lastError ?? new Error("OpenClaw gateway connect failed.");
}

async function connectOnce(input: {
  readonly gatewayUrl: string;
  readonly origin: string;
  readonly authStore: OpenClawGatewayAuthStore;
  readonly deviceIdentity: OpenClawDeviceIdentity;
  readonly auth: OpenClawGatewayAuthSelection;
  readonly connectTimeoutMs: number;
  readonly requestTimeoutMs: number;
  readonly onEvent?: (event: OpenClawGatewayEvent) => void;
  readonly client: OpenClawGatewayClientInfo;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly userAgent: string;
  readonly locale?: string;
  readonly caps?: ReadonlyArray<string>;
  readonly commands?: ReadonlyArray<string>;
  readonly permissions?: Record<string, boolean>;
  readonly deviceFamily: string;
  readonly sessionKey: string;
}): Promise<OpenClawGatewayConnection> {
  return await new Promise<OpenClawGatewayConnection>((resolve, reject) => {
    const ws = new WebSocket(input.gatewayUrl);
    const pendingRequests = new Map<
      string,
      {
        readonly resolve: (value: OpenClawGatewayRequestResult) => void;
        readonly reject: (reason: unknown) => void;
      }
    >();
    const bufferedEvents: OpenClawGatewayEvent[] = [];
    let connected = false;
    let closed = false;
    let handshakeSettled = false;
    let nextRequestId = 1;
    let challengeNonce: string | undefined;
    let challengeResolved = false;
    let resolveChallenge:
      | ((value: { readonly nonce: string; readonly ts?: number }) => void)
      | undefined;
    let rejectChallenge: ((reason: Error) => void) | undefined;
    const challengePromise = new Promise<{ readonly nonce: string; readonly ts?: number }>(
      (resolveChallengePromise, rejectChallengePromise) => {
        resolveChallenge = resolveChallengePromise;
        rejectChallenge = rejectChallengePromise;
      },
    );

    const cleanup = (): void => {
      ws.off("message", onMessage);
      ws.off("close", onClose);
      ws.off("error", onError);
    };

    const rejectAllPending = (reason: unknown): void => {
      for (const [, pending] of pendingRequests) {
        pending.reject(reason);
      }
      pendingRequests.clear();
    };

    const settleHandshakeFailure = (reason: Error): void => {
      if (handshakeSettled) {
        return;
      }
      handshakeSettled = true;
      closed = true;
      rejectChallenge?.(reason);
      cleanup();
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
      reject(reason);
    };

    const deliverBufferedEvents = (): void => {
      if (bufferedEvents.length === 0) {
        return;
      }
      for (const event of bufferedEvents.splice(0)) {
        input.onEvent?.(event);
      }
    };

    const onClose = (code: number, reasonBuffer: Buffer): void => {
      closed = true;
      const reasonText = reasonBuffer.toString("utf8");
      const closeError = new Error(
        reasonText.length > 0
          ? `WebSocket closed with code ${code}: ${reasonText}`
          : `WebSocket closed with code ${code}`,
      );
      rejectAllPending(closeError);
      if (!challengeResolved) {
        rejectChallenge?.(closeError);
      }
      if (!handshakeSettled) {
        settleHandshakeFailure(closeError);
      }
    };

    const onError = (cause: Error): void => {
      if (!handshakeSettled) {
        settleHandshakeFailure(cause);
        return;
      }
      rejectAllPending(cause);
      if (!challengeResolved) {
        rejectChallenge?.(cause);
      }
    };

    const onMessage = (data: WebSocket.Data): void => {
      const frame = parseFrame(data);
      if (!frame || closed) {
        return;
      }

      if (frame.type === "event") {
        const eventName = readString(frame.event);
        if (!eventName) {
          return;
        }
        if (eventName === "connect.challenge") {
          const payload = isObject(frame.payload)
            ? (frame.payload as GatewayChallengePayload)
            : undefined;
          const nonce = readString(payload?.nonce);
          if (nonce && !challengeNonce) {
            challengeNonce = nonce;
            challengeResolved = true;
            resolveChallenge?.({
              nonce,
              ...(typeof payload?.ts === "number" ? { ts: payload.ts } : {}),
            });
          }
          return;
        }
        const event: OpenClawGatewayEvent = {
          event: eventName,
          ...(frame.payload !== undefined ? { payload: frame.payload } : {}),
          ...(typeof frame.seq === "number" ? { seq: frame.seq } : {}),
          ...(typeof frame.stateVersion === "number" ? { stateVersion: frame.stateVersion } : {}),
        };
        if (!connected) {
          bufferedEvents.push(event);
          return;
        }
        input.onEvent?.(event);
        return;
      }

      if (frame.type !== "res") {
        return;
      }

      const id = readString(frame.id);
      if (id === undefined) {
        return;
      }
      const pending = pendingRequests.get(id);
      if (pending === undefined) {
        return;
      }
      pendingRequests.delete(id);
      if (frame.ok === true) {
        const payload = frame.payload as GatewayConnectPayload | undefined;
        if (payload && isObject(payload) && payload.type === "hello-ok") {
          const auth = isObject(payload.auth) ? payload.auth : undefined;
          const token = readString(auth?.deviceToken);
          if (token) {
            void input.authStore.persistDeviceToken(input.origin, token);
          }
        }
        pending.resolve({
          ok: true,
          ...(frame.payload !== undefined ? { payload: frame.payload } : {}),
        });
        return;
      }
      const gatewayError = toGatewayError(frame.error);
      pending.resolve({ ok: false, error: gatewayError });
    };

    ws.on("message", onMessage);
    ws.on("close", onClose);
    ws.on("error", onError);

    const connectTimeout = setTimeout(() => {
      settleHandshakeFailure(
        makeRequestError(
          `Connection to ${input.gatewayUrl} timed out after ${input.connectTimeoutMs}ms.`,
        ),
      );
    }, input.connectTimeoutMs);

    ws.once("open", () => {
      void (async () => {
        try {
          const challenge = await challengePromise;
          challengeNonce = challenge.nonce;
          const requestId = `connect-${nextRequestId++}`;
          const requestResult = new Promise<OpenClawGatewayRequestResult>((resolve, reject) => {
            pendingRequests.set(requestId, { resolve, reject });
          });
          ws.send(
            JSON.stringify({
              type: "req",
              id: requestId,
              method: "connect",
              params: buildConnectParams({
                client: input.client,
                role: input.role,
                scopes: input.scopes,
                auth: input.auth,
                challengeNonce,
                deviceIdentity: input.deviceIdentity,
                userAgent: input.userAgent,
                locale: input.locale,
                caps: input.caps,
                commands: input.commands,
                permissions: input.permissions,
                deviceFamily: input.deviceFamily,
              }),
            }),
          );
          const response = await requestResult;
          clearTimeout(connectTimeout);
          handshakeSettled = true;
          if (!response.ok) {
            const error = new Error(response.error?.message ?? "Gateway connect failed.");
            (error as Error & { readonly gatewayError?: OpenClawGatewayError }).gatewayError =
              response.error;
            cleanup();
            try {
              ws.close();
            } catch {
              // ignore close errors
            }
            reject(error);
            return;
          }
          connected = true;
          deliverBufferedEvents();
          resolve({
            origin: input.origin,
            sessionKey: input.sessionKey,
            deviceId: input.deviceIdentity.id,
            request<T = unknown>(
              method: string,
              params?: Record<string, unknown>,
              timeoutMs?: number,
            ) {
              if (closed) {
                return Promise.reject(makeRequestError("Gateway connection is closed."));
              }
              const id = `req-${nextRequestId++}`;
              const deadlineMs = timeoutMs ?? input.requestTimeoutMs;
              return new Promise<OpenClawGatewayRequestResult<T>>(
                (resolveRequest, rejectRequest) => {
                  const timer = setTimeout(() => {
                    pendingRequests.delete(id);
                    rejectRequest(
                      makeRequestError(`RPC call '${method}' timed out after ${deadlineMs}ms.`),
                    );
                  }, deadlineMs);

                  pendingRequests.set(id, {
                    resolve: (result) => {
                      clearTimeout(timer);
                      resolveRequest(result as OpenClawGatewayRequestResult<T>);
                    },
                    reject: (reason) => {
                      clearTimeout(timer);
                      rejectRequest(reason);
                    },
                  });

                  try {
                    ws.send(
                      JSON.stringify({
                        type: "req",
                        id,
                        method,
                        ...(params !== undefined ? { params } : {}),
                      }),
                    );
                  } catch (cause) {
                    clearTimeout(timer);
                    pendingRequests.delete(id);
                    rejectRequest(cause);
                  }
                },
              );
            },
            close: async () => {
              closed = true;
              clearTimeout(connectTimeout);
              rejectAllPending(makeRequestError("Gateway connection closed."));
              cleanup();
              try {
                ws.close();
              } catch {
                // ignore close errors
              }
            },
          });
        } catch (cause) {
          clearTimeout(connectTimeout);
          const error = cause instanceof Error ? cause : new Error(String(cause));
          settleHandshakeFailure(error);
        }
      })();
    });
  });
}
