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
import { serverBuildInfo } from "./buildInfo.ts";
import {
  OPENCLAW_GATEWAY_CLIENT_IDS,
  OPENCLAW_GATEWAY_CLIENT_MODES,
  connectOpenClawGateway,
} from "./provider/Layers/OpenClawGatewayClient.ts";

const OPENCLAW_TEST_CONNECT_TIMEOUT_MS = 10_000;
const OPENCLAW_TEST_RPC_TIMEOUT_MS = 10_000;
const OPENCLAW_TEST_HEALTH_TIMEOUT_MS = 2_500;
const OPENCLAW_TEST_LOOKUP_TIMEOUT_MS = 1_500;
const MAX_CAPTURED_NOTIFICATIONS = 5;
const OPENCLAW_OPERATOR_SCOPES = ["operator.read", "operator.write"] as const;

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

interface RunOpenclawGatewayTestOptions {
  readonly stateDir?: string | undefined;
}

interface OpenClawGatewayErrorLike {
  readonly message: string;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
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

function applyGatewayError(
  diagnostics: MutableGatewayDiagnostics,
  error: OpenClawGatewayErrorLike | undefined,
): void {
  if (!error) {
    return;
  }

  if (typeof error.code === "string") {
    diagnostics.gatewayErrorCode = error.code;
  }
  const details = error.details ?? {};
  if (typeof details.code === "string") {
    diagnostics.gatewayErrorDetailCode = details.code;
  }
  if (typeof details.reason === "string") {
    diagnostics.gatewayErrorDetailReason = details.reason;
  }
  if (typeof details.recommendedNextStep === "string") {
    diagnostics.gatewayRecommendedNextStep = details.recommendedNextStep;
  }
  if (typeof details.canRetryWithDeviceToken === "boolean") {
    diagnostics.gatewayCanRetryWithDeviceToken = details.canRetryWithDeviceToken;
  }
}

function pushUnique(items: string[], value: string): void {
  if (items.includes(value) || items.length >= MAX_CAPTURED_NOTIFICATIONS) return;
  items.push(value);
}

function formatGatewayFailureDetail(
  detail: string,
  diagnostics: Pick<MutableGatewayDiagnostics, "gatewayErrorDetailCode">,
): string {
  const code = diagnostics.gatewayErrorDetailCode;
  if (!code || detail.includes(code)) {
    return detail;
  }
  return `${detail} (${code})`;
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
    errorLower.includes("/client/id") ||
    errorLower.includes("/client/mode") ||
    errorLower.includes("client id") ||
    errorLower.includes("client mode")
  ) {
    hints.push(
      "The gateway rejected the advertised client identity. That usually means the gateway expects a newer OpenClaw `connect.params.client` allowlist than this OK Code build is using.",
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
  options?: RunOpenclawGatewayTestOptions,
): Promise<TestOpenclawGatewayResult> {
  const overallStart = Date.now();
  const steps: TestOpenclawGatewayStep[] = [];
  const diagnostics: MutableGatewayDiagnostics = createDiagnostics();
  let parsedUrlForHints: URL | null = null;
  let connection: Awaited<ReturnType<typeof connectOpenClawGateway>> | undefined;

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
      diagnostics: diagnosticsResult,
      ...(error ? { error } : {}),
    };
  };

  try {
    const urlStart = Date.now();
    const gatewayUrl = input.gatewayUrl.trim();
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
      connection = await connectOpenClawGateway({
        gatewayUrl,
        sessionKey: "okcode:gateway-test",
        role: "operator",
        scopes: [...OPENCLAW_OPERATOR_SCOPES],
        client: {
          id: OPENCLAW_GATEWAY_CLIENT_IDS.GATEWAY_CLIENT,
          displayName: "OK Code gateway test",
          version: serverBuildInfo.version,
          platform:
            process.platform === "darwin"
              ? "macos"
              : process.platform === "win32"
                ? "windows"
                : process.platform,
          deviceFamily: "server",
          mode: OPENCLAW_GATEWAY_CLIENT_MODES.BACKEND,
        },
        userAgent: `okcode/${serverBuildInfo.version}`,
        locale: Intl.DateTimeFormat().resolvedOptions().locale || "en-US",
        ...(options?.stateDir ? { stateDir: options.stateDir } : {}),
        ...(sharedSecret ? { password: sharedSecret } : {}),
        onEvent: (event) => {
          pushUnique(diagnostics.observedNotifications, event.event);
        },
        connectTimeoutMs: OPENCLAW_TEST_CONNECT_TIMEOUT_MS,
        requestTimeoutMs: OPENCLAW_TEST_RPC_TIMEOUT_MS,
      });
      pushStep(
        "WebSocket connect",
        "pass",
        Date.now() - connectStart,
        `Connected in ${Date.now() - connectStart}ms`,
      );
    } catch (cause) {
      const gatewayError =
        cause instanceof Error
          ? (cause as Error & { readonly gatewayError?: OpenClawGatewayErrorLike }).gatewayError
          : undefined;
      const connectionStage =
        cause instanceof Error
          ? (cause as Error & { readonly openClawConnectionStage?: "websocket" | "handshake" })
              .openClawConnectionStage
          : undefined;
      applyGatewayError(diagnostics, gatewayError);
      const detail = formatGatewayFailureDetail(
        toMessage(cause, "Connection failed."),
        diagnostics,
      );
      if (connectionStage === "handshake") {
        pushStep(
          "WebSocket connect",
          "pass",
          Date.now() - connectStart,
          `Connected in ${Date.now() - connectStart}ms`,
        );
        applyHealthProbe(await healthPromise);
        pushStep("Gateway handshake", "fail", 0, detail);
        return finalize(false, detail, "Gateway handshake");
      }
      pushStep("WebSocket connect", "fail", Date.now() - connectStart, detail);
      applyHealthProbe(await healthPromise);
      return finalize(false, detail, "WebSocket connect");
    }

    applyHealthProbe(await healthPromise);

    const handshakeStart = Date.now();
    pushStep("Gateway handshake", "pass", Date.now() - handshakeStart, "Connected.");
    return finalize(true);
  } finally {
    try {
      await connection?.close();
    } catch {
      // ignore close errors during cleanup
    }
  }
}

export const OpenclawGatewayTestInternals = {
  buildHealthUrl,
  buildHints,
  classifyGatewayHost,
};
