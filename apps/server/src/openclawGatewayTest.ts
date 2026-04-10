import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  TestOpenclawGatewayDiagnostics,
  TestOpenclawGatewayHostKind,
  TestOpenclawGatewayInput,
  TestOpenclawGatewayResult,
  TestOpenclawGatewayStep,
  TestOpenclawGatewayStepStatus,
} from "@okcode/contracts";
import NodeWebSocket from "ws";
import { serverBuildInfo } from "./buildInfo.ts";

const OPENCLAW_TEST_CONNECT_TIMEOUT_MS = 10_000;
const OPENCLAW_TEST_RPC_TIMEOUT_MS = 10_000;
const OPENCLAW_TEST_HEALTH_TIMEOUT_MS = 2_500;
const OPENCLAW_TEST_LOOKUP_TIMEOUT_MS = 1_500;
const MAX_CAPTURED_NOTIFICATIONS = 5;
const OPENCLAW_PROTOCOL_VERSION = 3;
const OPENCLAW_OPERATOR_SCOPES = ["operator.read", "operator.write"] as const;

type GatewayEnvelope = {
  type?: unknown;
  id?: unknown;
  ok?: unknown;
  event?: unknown;
  payload?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

interface GatewayHealthProbe {
  status: TestOpenclawGatewayStepStatus;
  url?: string;
  detail?: string;
}

interface MutableGatewayDiagnostics {
  normalizedUrl?: string;
  host?: string;
  pathname?: string;
  hostKind?: TestOpenclawGatewayHostKind;
  resolvedAddresses: string[];
  healthUrl?: string;
  healthStatus: TestOpenclawGatewayStepStatus;
  healthDetail?: string;
  socketCloseCode?: number;
  socketCloseReason?: string;
  socketError?: string;
  gatewayErrorCode?: string;
  gatewayErrorDetailCode?: string;
  gatewayErrorDetailReason?: string;
  gatewayRecommendedNextStep?: string;
  gatewayCanRetryWithDeviceToken?: boolean;
  observedNotifications: string[];
  hints: string[];
}

interface ParsedGatewayError {
  message: string;
  code?: string;
  detailCode?: string;
  detailReason?: string;
  recommendedNextStep?: string;
  canRetryWithDeviceToken?: boolean;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(fallback), timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      () => {
        clearTimeout(timeout);
        resolve(fallback);
      },
    );
  });
}

function toMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return fallback;
}

function bufferToString(data: NodeWebSocket.Data): string {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return data.toString("utf8");
}

function parseGatewayEnvelope(data: NodeWebSocket.Data): GatewayEnvelope | null {
  try {
    const parsed = JSON.parse(bufferToString(data));
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as GatewayEnvelope;
    }
  } catch {
    // Ignore non-JSON websocket messages from intermediaries.
  }
  return null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function parseGatewayError(error: GatewayEnvelope["error"]): ParsedGatewayError {
  const details =
    typeof error?.details === "object" && error.details !== null
      ? (error.details as Record<string, unknown>)
      : undefined;
  const parsed: ParsedGatewayError = {
    message: readString(error?.message) ?? "Gateway request failed.",
  };
  const code =
    typeof error?.code === "string" || typeof error?.code === "number"
      ? String(error.code)
      : undefined;
  const detailCode = readString(details?.code);
  const detailReason = readString(details?.reason);
  const recommendedNextStep = readString(details?.recommendedNextStep);
  const canRetryWithDeviceToken = readBoolean(details?.canRetryWithDeviceToken);

  if (code) {
    parsed.code = code;
  }
  if (detailCode) {
    parsed.detailCode = detailCode;
  }
  if (detailReason) {
    parsed.detailReason = detailReason;
  }
  if (recommendedNextStep) {
    parsed.recommendedNextStep = recommendedNextStep;
  }
  if (canRetryWithDeviceToken !== undefined) {
    parsed.canRetryWithDeviceToken = canRetryWithDeviceToken;
  }

  return parsed;
}

function recordGatewayError(
  diagnostics: MutableGatewayDiagnostics,
  error: ParsedGatewayError | undefined,
): void {
  if (error?.code) {
    diagnostics.gatewayErrorCode = error.code;
  } else {
    delete diagnostics.gatewayErrorCode;
  }
  if (error?.detailCode) {
    diagnostics.gatewayErrorDetailCode = error.detailCode;
  } else {
    delete diagnostics.gatewayErrorDetailCode;
  }
  if (error?.detailReason) {
    diagnostics.gatewayErrorDetailReason = error.detailReason;
  } else {
    delete diagnostics.gatewayErrorDetailReason;
  }
  if (error?.recommendedNextStep) {
    diagnostics.gatewayRecommendedNextStep = error.recommendedNextStep;
  } else {
    delete diagnostics.gatewayRecommendedNextStep;
  }
  if (error?.canRetryWithDeviceToken !== undefined) {
    diagnostics.gatewayCanRetryWithDeviceToken = error.canRetryWithDeviceToken;
  } else {
    delete diagnostics.gatewayCanRetryWithDeviceToken;
  }
}

function formatGatewayError(error: ParsedGatewayError): string {
  const detailParts = [
    error.code ? `code ${error.code}` : null,
    error.detailCode ? `detail ${error.detailCode}` : null,
    error.detailReason ? `reason ${error.detailReason}` : null,
    error.recommendedNextStep ? `next ${error.recommendedNextStep}` : null,
    error.canRetryWithDeviceToken ? "device-token retry available" : null,
  ].filter((part): part is string => part !== null);

  return detailParts.length > 0 ? `${error.message} (${detailParts.join(", ")})` : error.message;
}

function pushUnique(items: string[], value: string): void {
  if (items.includes(value) || items.length >= MAX_CAPTURED_NOTIFICATIONS) return;
  items.push(value);
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

function isTailscaleIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  return first === 100 && second >= 64 && second <= 127;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const first = parts[0] ?? -1;
  const second = parts[1] ?? -1;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;
  return false;
}

function isLoopbackIp(address: string): boolean {
  if (address === "::1") return true;
  return address.startsWith("127.");
}

function isTailscaleIpv6(address: string): boolean {
  return address.toLowerCase().startsWith("fd7a:115c:a1e0:");
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8");
}

function isPrivateAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    return isPrivateIpv4(address);
  }
  if (kind === 6) {
    return isPrivateIpv6(address);
  }
  return false;
}

function classifyGatewayHost(
  host: string,
  resolvedAddresses: ReadonlyArray<string>,
): TestOpenclawGatewayHostKind {
  const normalized = host.toLowerCase();
  if (isLoopbackHost(normalized) || resolvedAddresses.some(isLoopbackIp)) {
    return "loopback";
  }
  if (
    normalized.endsWith(".ts.net") ||
    resolvedAddresses.some((address) => isTailscaleIpv4(address) || isTailscaleIpv6(address))
  ) {
    return "tailscale";
  }
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) {
      return "private";
    }
    return "public";
  }
  if (resolvedAddresses.some(isPrivateAddress)) {
    return "private";
  }
  if (resolvedAddresses.length > 0) {
    return "public";
  }
  return "unknown";
}

async function resolveAddresses(host: string): Promise<string[]> {
  if (isIP(host) !== 0) {
    return [host];
  }
  const results = await lookup(host, { all: true, verbatim: true });
  return [...new Set(results.map((result) => result.address))];
}

function buildHealthUrl(parsedUrl: URL): string | null {
  if (parsedUrl.pathname.length > 1 && parsedUrl.pathname !== "/") {
    return null;
  }
  const healthUrl = new URL(parsedUrl.toString());
  healthUrl.protocol = parsedUrl.protocol === "wss:" ? "https:" : "http:";
  healthUrl.pathname = "/health";
  healthUrl.search = "";
  healthUrl.hash = "";
  return healthUrl.toString();
}

async function probeHealth(parsedUrl: URL): Promise<GatewayHealthProbe> {
  const healthUrl = buildHealthUrl(parsedUrl);
  if (!healthUrl) {
    return {
      status: "skip",
      detail: "Skipped best-effort /health probe because the gateway URL uses a non-root path.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENCLAW_TEST_HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(healthUrl, { signal: controller.signal });
    if (response.ok) {
      return {
        status: "pass",
        url: healthUrl,
        detail: `HTTP ${response.status}`,
      };
    }
    return {
      status: "fail",
      url: healthUrl,
      detail: `HTTP ${response.status}`,
    };
  } catch (cause) {
    return {
      status: "fail",
      url: healthUrl,
      detail: toMessage(cause, "Health probe failed."),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatSocketClose(code: number | undefined, reason: string | undefined): string | null {
  if (code === undefined) return null;
  return reason && reason.length > 0 ? `code ${code}: ${reason}` : `code ${code}`;
}

function buildTimeoutDetail(subject: string, diagnostics: TestOpenclawGatewayDiagnostics): string {
  const parts = [`${subject} timed out after ${OPENCLAW_TEST_RPC_TIMEOUT_MS}ms.`];
  const closeDetail = formatSocketClose(diagnostics.socketCloseCode, diagnostics.socketCloseReason);
  if (closeDetail) {
    parts.push(`Socket closed with ${closeDetail}.`);
  }
  if (diagnostics.socketError) {
    parts.push(`Last socket error: ${diagnostics.socketError}.`);
  }
  if (diagnostics.observedNotifications.length > 0) {
    parts.push(`Observed gateway events: ${diagnostics.observedNotifications.join(", ")}.`);
  }
  return parts.join(" ");
}

function buildHints(
  parsedUrl: URL,
  diagnostics: Pick<
    MutableGatewayDiagnostics,
    | "healthStatus"
    | "healthUrl"
    | "hostKind"
    | "observedNotifications"
    | "hints"
    | "resolvedAddresses"
    | "gatewayErrorCode"
    | "gatewayErrorDetailCode"
    | "gatewayErrorDetailReason"
    | "gatewayRecommendedNextStep"
    | "gatewayCanRetryWithDeviceToken"
  >,
  failedStepName: string | null,
  error: string | undefined,
  sharedSecretProvided: boolean,
): string[] {
  const hints: string[] = [];
  const handshakeFailure = failedStepName === "Gateway handshake";
  const websocketFailure = failedStepName === "WebSocket connect";
  const errorLower = error?.toLowerCase() ?? "";
  const detailCode = diagnostics.gatewayErrorDetailCode;
  const gatewayRecommendedNextStep = diagnostics.gatewayRecommendedNextStep;

  if (diagnostics.hostKind === "loopback") {
    hints.push(
      "This gateway host is loopback-only. `localhost`, `127.0.0.1`, and `::1` only work when OK Code and the OpenClaw gateway run on the same machine.",
    );
  }

  if (diagnostics.hostKind === "private") {
    hints.push(
      "This host looks like a LAN/private address. Make sure the gateway is listening on that interface or on `0.0.0.0`, and confirm local firewalls allow inbound TCP on the gateway port.",
    );
  }

  if (diagnostics.hostKind === "tailscale") {
    hints.push(
      "This host looks like Tailscale. Confirm both devices are on the same tailnet, MagicDNS is resolving the hostname correctly, and the gateway is bound to the Tailnet IP or `0.0.0.0` rather than only `127.0.0.1`.",
    );
  }

  if (websocketFailure) {
    hints.push(
      "The WebSocket handshake did not complete. Double-check the hostname, port, firewall rules, and whether the OpenClaw gateway is actually running at this URL.",
    );
  }

  if (handshakeFailure) {
    hints.push(
      "The WebSocket handshake succeeded, so DNS/TLS/basic routing are working. The remaining failure is inside the OpenClaw `connect` handshake.",
    );
    if (errorLower.includes("connect.challenge")) {
      hints.push(
        "Modern OpenClaw gateways send `connect.challenge` before they will accept any client request. If that event never arrived, this URL may point at the wrong WebSocket service or an intermediary is swallowing frames.",
      );
    }
    if (errorLower.includes("timed out")) {
      hints.push(
        "A timeout during the `connect.challenge`/`connect` exchange usually means this URL is not the actual OpenClaw WebSocket gateway endpoint, or a proxy/Tailscale Serve setup upgraded the socket but did not keep forwarding frames.",
      );
    }
  }

  if (
    !sharedSecretProvided &&
    (detailCode === "AUTH_TOKEN_MISSING" || errorLower.includes("auth_token_missing"))
  ) {
    hints.push(
      "No shared secret was provided for this test. If your OpenClaw gateway uses token/password auth, add the configured secret and test again.",
    );
  }

  if (
    sharedSecretProvided &&
    (detailCode === "AUTH_TOKEN_MISMATCH" ||
      detailCode === "AUTH_DEVICE_TOKEN_MISMATCH" ||
      errorLower.includes("auth_token_mismatch"))
  ) {
    hints.push(
      "The gateway rejected the provided auth material. Re-check the configured shared secret and confirm whether this gateway expects token auth, password auth, or a paired device token.",
    );
  }

  if (diagnostics.healthStatus === "fail" && diagnostics.healthUrl) {
    hints.push(
      `The best-effort health probe to ${diagnostics.healthUrl} failed. That often means the gateway is not healthy yet, the path is routed somewhere else, or HTTPS/HTTP is terminating before the OpenClaw service.`,
    );
  }

  if (detailCode === "PAIRING_REQUIRED") {
    hints.push(
      "The gateway is asking for device pairing approval. Approve the pending device with `openclaw devices list` and `openclaw devices approve <requestId>`, then retry.",
    );
  }

  if (
    detailCode?.startsWith("DEVICE_AUTH_") ||
    errorLower.includes("device identity required") ||
    errorLower.includes("device nonce") ||
    errorLower.includes("device signature")
  ) {
    hints.push(
      "This gateway requires challenge-based device auth. Modern OpenClaw connections must wait for `connect.challenge`, sign it with a device identity, and send that identity back in `connect.params.device`.",
    );
  }

  if (
    diagnostics.hostKind === "tailscale" &&
    (detailCode === "PAIRING_REQUIRED" ||
      detailCode?.startsWith("DEVICE_AUTH_") ||
      errorLower.includes("device identity"))
  ) {
    hints.push(
      "OpenClaw treats tailnet and LAN connects as remote for pairing/device auth. Even on the same physical machine, a `*.ts.net` connection usually needs an approved device identity unless the gateway is explicitly configured for a trusted proxy flow.",
    );
  }

  if (gatewayRecommendedNextStep) {
    hints.push(`Gateway recommended next step: \`${gatewayRecommendedNextStep}\`.`);
  }

  if (diagnostics.gatewayCanRetryWithDeviceToken) {
    hints.push(
      "The gateway reported that a retry with a cached device token could work. That only helps after the device has already been paired and a token was persisted.",
    );
  }

  if (parsedUrl.protocol === "wss:" && (websocketFailure || handshakeFailure)) {
    hints.push(
      "Because this uses `wss://`, check any reverse proxy or Tailscale Serve setup too. It must preserve WebSocket upgrades and continue forwarding frames after the initial handshake.",
    );
  }

  if (diagnostics.observedNotifications.length > 0 && handshakeFailure) {
    hints.push(
      "The gateway sent events before `connect` completed. Check the gateway logs around the same time to see why it never answered the handshake successfully.",
    );
  }

  return [...new Set(hints)];
}

function createDiagnostics(): MutableGatewayDiagnostics {
  return {
    resolvedAddresses: [],
    healthStatus: "skip",
    observedNotifications: [],
    hints: [],
  };
}

export async function runOpenclawGatewayTest(
  input: TestOpenclawGatewayInput,
): Promise<TestOpenclawGatewayResult> {
  const overallStart = Date.now();
  const steps: TestOpenclawGatewayStep[] = [];
  let ws: NodeWebSocket | null = null;
  let rpcId = 1;
  const serverInfo: { version?: string; sessionId?: string } = {};
  const diagnostics: MutableGatewayDiagnostics = createDiagnostics();
  const earlyGatewayEvents: GatewayEnvelope[] = [];
  let captureEarlyGatewayEvents = true;

  const pushStep = (
    name: string,
    status: TestOpenclawGatewayStepStatus,
    durationMs: number,
    detail?: string,
  ) => {
    steps.push({ name, status, durationMs, ...(detail ? { detail } : {}) });
  };

  const applyHealthProbe = (healthProbe: GatewayHealthProbe) => {
    diagnostics.healthStatus = healthProbe.status;
    if (healthProbe.url !== undefined) {
      diagnostics.healthUrl = healthProbe.url;
    }
    if (healthProbe.detail !== undefined) {
      diagnostics.healthDetail = healthProbe.detail;
    }
  };

  const finalize = (
    success: boolean,
    error?: string,
    failedStepName: string | null = null,
  ): TestOpenclawGatewayResult => {
    const hints = buildHints(
      parsedUrlForHints ?? new URL("ws://localhost"),
      diagnostics,
      failedStepName,
      error,
      Boolean(input.password?.trim()),
    );
    const diagnosticsResult: TestOpenclawGatewayDiagnostics = {
      ...diagnostics,
      resolvedAddresses: [...diagnostics.resolvedAddresses],
      observedNotifications: [...diagnostics.observedNotifications],
      hints,
    };
    return {
      success,
      steps,
      totalDurationMs: Date.now() - overallStart,
      ...(Object.keys(serverInfo).length > 0 ? { serverInfo } : {}),
      diagnostics: diagnosticsResult,
      ...(error ? { error } : {}),
    };
  };

  let parsedUrlForHints: URL | null = null;

  const waitForGatewayEvent = (
    socket: NodeWebSocket,
    eventName: string,
  ): Promise<Record<string, unknown> | undefined> =>
    new Promise((resolve, reject) => {
      const bufferedIndex = earlyGatewayEvents.findIndex(
        (message) => message.type === "event" && message.event === eventName,
      );
      if (bufferedIndex >= 0) {
        const [message] = earlyGatewayEvents.splice(bufferedIndex, 1);
        resolve(
          typeof message?.payload === "object" && message.payload !== null
            ? (message.payload as Record<string, unknown>)
            : undefined,
        );
        return;
      }

      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        socket.off("message", onMessage);
        socket.off("close", onClose);
        socket.off("error", onError);
      };

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const onMessage = (data: NodeWebSocket.Data) => {
        const message = parseGatewayEnvelope(data);
        if (!message) {
          return;
        }
        if (message.type === "event" && typeof message.event === "string") {
          pushUnique(diagnostics.observedNotifications, message.event);
          if (message.event === eventName) {
            settle(() =>
              resolve(
                typeof message.payload === "object" && message.payload !== null
                  ? (message.payload as Record<string, unknown>)
                  : undefined,
              ),
            );
          }
        }
      };

      const onClose = (code: number, reasonBuffer: Buffer) => {
        diagnostics.socketCloseCode = code;
        const reason = reasonBuffer.toString("utf8");
        if (reason.length > 0) {
          diagnostics.socketCloseReason = reason;
        }
        const closeDetail = formatSocketClose(code, reason);
        settle(() =>
          reject(
            new Error(
              `WebSocket closed before gateway event '${eventName}' arrived${
                closeDetail ? ` (${closeDetail})` : ""
              }.`,
            ),
          ),
        );
      };

      const onError = (cause: Error) => {
        diagnostics.socketError = toMessage(cause, "WebSocket error.");
        settle(() =>
          reject(
            new Error(
              `WebSocket error while waiting for gateway event '${eventName}': ${diagnostics.socketError}`,
            ),
          ),
        );
      };

      socket.on("message", onMessage);
      socket.on("close", onClose);
      socket.on("error", onError);

      timeout = setTimeout(() => {
        settle(() =>
          reject(new Error(buildTimeoutDetail(`Gateway event '${eventName}'`, diagnostics))),
        );
      }, OPENCLAW_TEST_RPC_TIMEOUT_MS);
    });

  const sendGatewayRequest = (
    socket: NodeWebSocket,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<{ payload?: unknown; error?: ParsedGatewayError }> =>
    new Promise((resolve, reject) => {
      const id = String(rpcId++);
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        socket.off("message", onMessage);
        socket.off("close", onClose);
        socket.off("error", onError);
      };

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback();
      };

      const onMessage = (data: NodeWebSocket.Data) => {
        const message = parseGatewayEnvelope(data);
        if (!message) {
          return;
        }
        if (message.type === "event" && typeof message.event === "string") {
          pushUnique(diagnostics.observedNotifications, message.event);
          return;
        }
        if (message.type === "res" && message.id === id) {
          if (message.ok === true) {
            recordGatewayError(diagnostics, undefined);
            settle(() =>
              resolve(
                message.payload !== undefined
                  ? { payload: message.payload }
                  : { payload: undefined },
              ),
            );
            return;
          }

          const parsedError = parseGatewayError(message.error);
          recordGatewayError(diagnostics, parsedError);
          settle(() => resolve({ error: parsedError }));
        }
      };

      const onClose = (code: number, reasonBuffer: Buffer) => {
        diagnostics.socketCloseCode = code;
        const reason = reasonBuffer.toString("utf8");
        if (reason.length > 0) {
          diagnostics.socketCloseReason = reason;
        }
        const closeDetail = formatSocketClose(code, reason);
        settle(() =>
          reject(
            new Error(
              `WebSocket closed before gateway request '${method}' completed${
                closeDetail ? ` (${closeDetail})` : ""
              }.`,
            ),
          ),
        );
      };

      const onError = (cause: Error) => {
        diagnostics.socketError = toMessage(cause, "WebSocket error.");
        settle(() =>
          reject(
            new Error(
              `WebSocket error during gateway request '${method}': ${diagnostics.socketError}`,
            ),
          ),
        );
      };

      socket.on("message", onMessage);
      socket.on("close", onClose);
      socket.on("error", onError);

      timeout = setTimeout(() => {
        settle(() =>
          reject(new Error(buildTimeoutDetail(`Gateway request '${method}'`, diagnostics))),
        );
      }, OPENCLAW_TEST_RPC_TIMEOUT_MS);

      try {
        socket.send(
          JSON.stringify({
            type: "req",
            id,
            method,
            ...(params !== undefined ? { params } : {}),
          }),
        );
      } catch (cause) {
        diagnostics.socketError = toMessage(cause, "WebSocket send failed.");
        settle(() => reject(cause instanceof Error ? cause : new Error(diagnostics.socketError)));
      }
    });

  const buildConnectParams = (sharedSecret: string | undefined): Record<string, unknown> => ({
    minProtocol: OPENCLAW_PROTOCOL_VERSION,
    maxProtocol: OPENCLAW_PROTOCOL_VERSION,
    client: {
      id: "okcode",
      version: serverBuildInfo.version,
      platform:
        process.platform === "darwin"
          ? "macos"
          : process.platform === "win32"
            ? "windows"
            : process.platform,
      mode: "operator",
    },
    role: "operator",
    scopes: [...OPENCLAW_OPERATOR_SCOPES],
    caps: [],
    commands: [],
    permissions: {},
    locale: Intl.DateTimeFormat().resolvedOptions().locale || "en-US",
    userAgent: `okcode/${serverBuildInfo.version}`,
    ...(sharedSecret ? { auth: { password: sharedSecret } } : {}),
  });

  try {
    const urlStart = Date.now();
    const gatewayUrl = input.gatewayUrl?.trim() ?? "";
    const sharedSecret = input.password?.trim() || undefined;
    if (!gatewayUrl) {
      pushStep("URL validation", "fail", Date.now() - urlStart, "Gateway URL is empty.");
      return finalize(false, "Gateway URL is empty.", "URL validation");
    }

    const parsedUrl = URL.canParse(gatewayUrl) ? new URL(gatewayUrl) : null;
    if (!parsedUrl) {
      pushStep("URL validation", "fail", Date.now() - urlStart, "Malformed URL.");
      return finalize(false, "Malformed URL.", "URL validation");
    }

    parsedUrlForHints = parsedUrl;
    diagnostics.normalizedUrl = parsedUrl.toString();
    diagnostics.host = parsedUrl.hostname;
    diagnostics.pathname = parsedUrl.pathname;

    if (!["ws:", "wss:"].includes(parsedUrl.protocol)) {
      const detail = `Invalid protocol "${parsedUrl.protocol}". Expected ws: or wss:.`;
      pushStep("URL validation", "fail", Date.now() - urlStart, detail);
      return finalize(false, detail, "URL validation");
    }

    const resolutionPromise = withTimeout(
      resolveAddresses(parsedUrl.hostname),
      OPENCLAW_TEST_LOOKUP_TIMEOUT_MS,
      [],
    );
    const healthPromise = probeHealth(parsedUrl);

    pushStep(
      "URL validation",
      "pass",
      Date.now() - urlStart,
      `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`,
    );

    diagnostics.resolvedAddresses = await resolutionPromise;
    diagnostics.hostKind = classifyGatewayHost(parsedUrl.hostname, diagnostics.resolvedAddresses);

    const connectStart = Date.now();
    try {
      ws = await new Promise<NodeWebSocket>((resolve, reject) => {
        const socket = new NodeWebSocket(gatewayUrl);
        socket.on("message", (data: NodeWebSocket.Data) => {
          const message = parseGatewayEnvelope(data);
          if (!message) {
            return;
          }
          if (message.type === "event" && typeof message.event === "string") {
            pushUnique(diagnostics.observedNotifications, message.event);
          }
          if (captureEarlyGatewayEvents) {
            earlyGatewayEvents.push(message);
          }
        });
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error(`Connection timed out after ${OPENCLAW_TEST_CONNECT_TIMEOUT_MS}ms`));
        }, OPENCLAW_TEST_CONNECT_TIMEOUT_MS);

        socket.on("open", () => {
          clearTimeout(timeout);
          resolve(socket);
        });
        socket.on("error", (cause) => {
          clearTimeout(timeout);
          reject(cause);
        });
      });
      ws.on("close", (code: number, reasonBuffer: Buffer) => {
        diagnostics.socketCloseCode = code;
        const reason = reasonBuffer.toString("utf8");
        if (reason.length > 0) {
          diagnostics.socketCloseReason = reason;
        }
      });
      ws.on("error", (cause: Error) => {
        diagnostics.socketError = toMessage(cause, "WebSocket error.");
      });
      pushStep(
        "WebSocket connect",
        "pass",
        Date.now() - connectStart,
        `Connected in ${Date.now() - connectStart}ms`,
      );
    } catch (cause) {
      const detail = toMessage(cause, "Connection failed.");
      pushStep("WebSocket connect", "fail", Date.now() - connectStart, detail);
      applyHealthProbe(await healthPromise);
      return finalize(false, detail, "WebSocket connect");
    }

    applyHealthProbe(await healthPromise);

    const handshakeStart = Date.now();
    try {
      await waitForGatewayEvent(ws, "connect.challenge");
      captureEarlyGatewayEvents = false;
      earlyGatewayEvents.length = 0;
      const connectResult = await sendGatewayRequest(
        ws,
        "connect",
        buildConnectParams(sharedSecret),
      );
      if (connectResult.error) {
        const detail = formatGatewayError(connectResult.error);
        pushStep("Gateway handshake", "fail", Date.now() - handshakeStart, detail);
        return finalize(false, detail, "Gateway handshake");
      }
      pushStep("Gateway handshake", "pass", Date.now() - handshakeStart, "Connected.");
    } catch (cause) {
      const detail = toMessage(cause, "Gateway handshake failed.");
      pushStep("Gateway handshake", "fail", Date.now() - handshakeStart, detail);
      return finalize(false, detail, "Gateway handshake");
    }

    return finalize(true);
  } finally {
    if (ws && ws.readyState === NodeWebSocket.OPEN) {
      ws.close();
    }
  }
}

export const OpenclawGatewayTestInternals = {
  buildHealthUrl,
  buildHints,
  classifyGatewayHost,
};
