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
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export const OPENCLAW_GATEWAY_CLIENT_IDS = {
  WEBCHAT_UI: "webchat-ui",
  CONTROL_UI: "openclaw-control-ui",
  TUI: "openclaw-tui",
  WEBCHAT: "webchat",
  CLI: "cli",
  GATEWAY_CLIENT: "gateway-client",
  MACOS_APP: "openclaw-macos",
  IOS_APP: "openclaw-ios",
  ANDROID_APP: "openclaw-android",
  NODE_HOST: "node-host",
  TEST: "test",
  FINGERPRINT: "fingerprint",
  PROBE: "openclaw-probe",
} as const;

export type OpenClawGatewayClientId =
  (typeof OPENCLAW_GATEWAY_CLIENT_IDS)[keyof typeof OPENCLAW_GATEWAY_CLIENT_IDS];

export const OPENCLAW_GATEWAY_CLIENT_MODES = {
  WEBCHAT: "webchat",
  CLI: "cli",
  UI: "ui",
  BACKEND: "backend",
  NODE: "node",
  PROBE: "probe",
  TEST: "test",
} as const;

export type OpenClawGatewayClientMode =
  (typeof OPENCLAW_GATEWAY_CLIENT_MODES)[keyof typeof OPENCLAW_GATEWAY_CLIENT_MODES];

export interface OpenClawGatewayClientInfo {
  readonly id: OpenClawGatewayClientId;
  readonly displayName?: string | undefined;
  readonly version: string;
  readonly platform: string;
  readonly deviceFamily?: string | undefined;
  readonly modelIdentifier?: string | undefined;
  readonly mode: OpenClawGatewayClientMode;
  readonly instanceId?: string | undefined;
}

export interface OpenClawGatewayConnectOptions {
  readonly gatewayUrl: string;
  readonly stateDir?: string | undefined;
  readonly sessionKey?: string | undefined;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly client: OpenClawGatewayClientInfo;
  readonly userAgent: string;
  readonly locale?: string | undefined;
  readonly caps?: ReadonlyArray<string> | undefined;
  readonly commands?: ReadonlyArray<string> | undefined;
  readonly permissions?: Record<string, boolean> | undefined;
  readonly password?: string | undefined;
  readonly deviceToken?: string | undefined;
  readonly onEvent?: ((event: OpenClawGatewayEvent) => void) | undefined;
  readonly connectTimeoutMs?: number | undefined;
  readonly requestTimeoutMs?: number | undefined;
}

export interface OpenClawGatewayEvent {
  readonly event: string;
  readonly payload?: unknown;
  readonly seq?: number;
  readonly stateVersion?: number;
}

export interface OpenClawGatewayError {
  readonly code?: string | undefined;
  readonly message: string;
  readonly details?: Record<string, unknown> | undefined;
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

type OpenClawConnectionStage = "websocket" | "handshake";

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
  readonly seq?: unknown;
  readonly stateVersion?: unknown;
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

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const publicKey = createPublicKey(publicKeyPem);
  const spki = publicKey.export({ format: "der", type: "spki" }) as Buffer;
  if (
    spki.length === ED25519_SPKI_PREFIX.length + 32 &&
    spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
  ) {
    return spki.subarray(ED25519_SPKI_PREFIX.length);
  }
  return spki;
}

function publicKeyRawBase64UrlFromPem(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

function fingerprintPublicKey(publicKeyPem: string): string {
  return createHash("sha256").update(derivePublicKeyRaw(publicKeyPem)).digest("hex");
}

function makeDeviceIdentity(): OpenClawDeviceIdentity {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = exportPrivateKeyPem(privateKey);
  const publicKeyPem = exportPublicKeyPem(publicKey);
  const deviceId = fingerprintPublicKey(publicKeyPem);
  return {
    id: deviceId,
    privateKeyPem,
    publicKeyPem,
  };
}

function normalizeDeviceMetadataForAuth(value?: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed.replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 32));
}

function buildDeviceAuthPayloadV3(input: {
  readonly deviceId: string;
  readonly client: OpenClawGatewayClientInfo;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly signedAtMs: number;
  readonly token?: string | undefined;
  readonly nonce: string;
}): string {
  return [
    "v3",
    input.deviceId,
    input.client.id,
    input.client.mode,
    input.role,
    input.scopes.join(","),
    String(input.signedAtMs),
    input.token ?? "",
    input.nonce,
    normalizeDeviceMetadataForAuth(input.client.platform),
    normalizeDeviceMetadataForAuth(input.client.deviceFamily),
  ].join("|");
}

function signDevicePayload(
  identity: OpenClawDeviceIdentity,
  input: Parameters<typeof buildDeviceAuthPayloadV3>[0],
): string {
  const privateKey = createPrivateKey(identity.privateKeyPem);
  const signature = cryptoSign(
    null,
    Buffer.from(buildDeviceAuthPayloadV3(input), "utf8"),
    privateKey,
  );
  return base64UrlEncode(signature);
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
      ) as Record<string, string>,
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

function normalizePersistedAuthState(
  state: PersistedOpenClawGatewayAuthState,
): PersistedOpenClawGatewayAuthState {
  try {
    const normalizedDeviceId = fingerprintPublicKey(state.device.publicKeyPem);
    if (normalizedDeviceId === state.device.id) {
      return state;
    }
    return {
      ...state,
      device: {
        ...state.device,
        id: normalizedDeviceId,
      },
    };
  } catch {
    return state;
  }
}

class OpenClawGatewayAuthStore {
  private cachedState: PersistedOpenClawGatewayAuthState | undefined;

  constructor(private readonly stateDir: string) {}

  private async loadState(): Promise<PersistedOpenClawGatewayAuthState> {
    if (this.cachedState !== undefined) {
      return this.cachedState;
    }

    const storedState = await readAuthState(this.stateDir);
    const loaded: PersistedOpenClawGatewayAuthState =
      storedState !== null
        ? normalizePersistedAuthState(storedState)
        : {
            version: 1 as const,
            device: makeDeviceIdentity(),
            deviceTokens: {},
          };
    this.cachedState = loaded;
    if (storedState === null || storedState.device.id !== loaded.device.id) {
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

function withConnectionStage<T extends Error>(
  error: T,
  stage: OpenClawConnectionStage,
): T & { openClawConnectionStage: OpenClawConnectionStage } {
  return Object.assign(error, { openClawConnectionStage: stage });
}

function toGatewayError(frameError: unknown): OpenClawGatewayError {
  if (!isObject(frameError)) {
    return { message: "Gateway request failed." };
  }
  const details = isObject(frameError.details) ? frameError.details : undefined;
  const code = readString(frameError.code);
  return {
    message: readString(frameError.message) ?? "Gateway request failed.",
    ...(code !== undefined ? { code } : {}),
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
  readonly locale?: string | undefined;
  readonly caps?: ReadonlyArray<string> | undefined;
  readonly commands?: ReadonlyArray<string> | undefined;
  readonly permissions?: Record<string, boolean> | undefined;
}): Record<string, unknown> {
  const signedAtMs = Date.now();
  const auth =
    input.auth.kind === "password"
      ? {
          token: input.auth.value,
        }
      : input.auth.kind === "deviceToken"
        ? {
            // Legacy compatibility: device-token auth keeps `token` populated too.
            token: input.auth.value,
            deviceToken: input.auth.value,
          }
        : undefined;
  const signatureToken = input.auth.kind === "deviceToken" ? input.auth.value : undefined;
  return {
    minProtocol: OPENCLAW_PROTOCOL_VERSION,
    maxProtocol: OPENCLAW_PROTOCOL_VERSION,
    client: {
      id: input.client.id,
      ...(input.client.displayName ? { displayName: input.client.displayName } : {}),
      version: input.client.version,
      platform: input.client.platform,
      ...(input.client.deviceFamily ? { deviceFamily: input.client.deviceFamily } : {}),
      ...(input.client.modelIdentifier ? { modelIdentifier: input.client.modelIdentifier } : {}),
      mode: input.client.mode,
      ...(input.client.instanceId ? { instanceId: input.client.instanceId } : {}),
    },
    role: input.role,
    scopes: [...input.scopes],
    caps: [...(input.caps ?? [])],
    commands: [...(input.commands ?? [])],
    permissions: { ...input.permissions },
    ...(auth ? { auth } : {}),
    locale: input.locale ?? (Intl.DateTimeFormat().resolvedOptions().locale || "en-US"),
    userAgent: input.userAgent,
    device: {
      id: input.deviceIdentity.id,
      publicKey: publicKeyRawBase64UrlFromPem(input.deviceIdentity.publicKeyPem),
      signature: signDevicePayload(input.deviceIdentity, {
        deviceId: input.deviceIdentity.id,
        client: input.client,
        role: input.role,
        scopes: input.scopes,
        signedAtMs,
        ...(signatureToken !== undefined ? { token: signatureToken } : {}),
        nonce: input.challengeNonce,
      }),
      signedAt: signedAtMs,
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
    if (auth === undefined) {
      continue;
    }
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
  readonly onEvent?: ((event: OpenClawGatewayEvent) => void) | undefined;
  readonly client: OpenClawGatewayClientInfo;
  readonly role: "operator" | "node";
  readonly scopes: ReadonlyArray<string>;
  readonly userAgent: string;
  readonly locale?: string | undefined;
  readonly caps?: ReadonlyArray<string> | undefined;
  readonly commands?: ReadonlyArray<string> | undefined;
  readonly permissions?: Record<string, boolean> | undefined;
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
    let socketOpened = false;
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
      const stagedReason = withConnectionStage(reason, socketOpened ? "handshake" : "websocket");
      rejectChallenge?.(stagedReason);
      cleanup();
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
      reject(stagedReason);
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
          input.onEvent?.({
            event: eventName,
            ...(frame.payload !== undefined ? { payload: frame.payload } : {}),
            ...(typeof frame.seq === "number" ? { seq: frame.seq } : {}),
            ...(typeof frame.stateVersion === "number" ? { stateVersion: frame.stateVersion } : {}),
          });
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
      socketOpened = true;
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
              }),
            }),
          );
          const response = await requestResult;
          clearTimeout(connectTimeout);
          handshakeSettled = true;
          if (!response.ok) {
            const error = withConnectionStage(
              new Error(response.error?.message ?? "Gateway connect failed."),
              "handshake",
            ) as Error & {
              gatewayError?: OpenClawGatewayError | undefined;
            };
            error.gatewayError = response.error;
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
