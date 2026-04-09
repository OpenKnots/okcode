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

const OPENCLAW_TEST_CONNECT_TIMEOUT_MS = 10_000;
const OPENCLAW_TEST_RPC_TIMEOUT_MS = 10_000;
const OPENCLAW_TEST_HEALTH_TIMEOUT_MS = 2_500;
const OPENCLAW_TEST_LOOKUP_TIMEOUT_MS = 1_500;
const MAX_CAPTURED_NOTIFICATIONS = 5;

type JsonRpcEnvelope = {
  id?: number | string | null;
  method?: string;
  result?: unknown;
  error?: { code: number; message: string };
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
  observedNotifications: string[];
  hints: string[];
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

function buildTimeoutDetail(method: string, diagnostics: TestOpenclawGatewayDiagnostics): string {
  const parts = [`RPC '${method}' timed out after ${OPENCLAW_TEST_RPC_TIMEOUT_MS}ms.`];
  const closeDetail = formatSocketClose(diagnostics.socketCloseCode, diagnostics.socketCloseReason);
  if (closeDetail) {
    parts.push(`Socket closed with ${closeDetail}.`);
  }
  if (diagnostics.socketError) {
    parts.push(`Last socket error: ${diagnostics.socketError}.`);
  }
  if (diagnostics.observedNotifications.length > 0) {
    parts.push(`Observed notifications: ${diagnostics.observedNotifications.join(", ")}.`);
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
  >,
  failedStepName: string | null,
  error: string | undefined,
  passwordProvided: boolean,
): string[] {
  const hints: string[] = [];
  const authFailure = failedStepName === "Authentication";
  const websocketFailure = failedStepName === "WebSocket connect";
  const sessionFailure = failedStepName === "Session create";
  const errorLower = error?.toLowerCase() ?? "";

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

  if (authFailure) {
    hints.push(
      "The WebSocket handshake succeeded, so DNS/TLS/basic routing are working. The missing piece is the gateway’s JSON-RPC auth response.",
    );
    if (errorLower.includes("timed out")) {
      hints.push(
        "A timeout during `auth.authenticate` usually means this URL is not the actual OpenClaw JSON-RPC gateway endpoint, the gateway auth handler is stalled, or a proxy is accepting WebSockets without forwarding gateway traffic correctly.",
      );
      hints.push(
        "A wrong password normally returns an RPC error quickly. A timeout is more consistent with the gateway never replying than with a simple credential mismatch.",
      );
    }
  }

  if (!passwordProvided && sessionFailure) {
    hints.push(
      "No password was provided for this test. If your OpenClaw gateway requires authentication, add the shared secret and test again.",
    );
  }

  if (errorLower.includes("rpc error")) {
    hints.push(
      "The gateway returned an RPC error, which usually means the request reached the OpenClaw service. Re-check the shared secret and any gateway-side auth configuration.",
    );
  }

  if (diagnostics.healthStatus === "fail" && diagnostics.healthUrl) {
    hints.push(
      `The best-effort health probe to ${diagnostics.healthUrl} failed. That often means the gateway is not healthy yet, the path is routed somewhere else, or HTTPS/HTTP is terminating before the OpenClaw service.`,
    );
  }

  if (parsedUrl.protocol === "wss:" && (websocketFailure || authFailure || sessionFailure)) {
    hints.push(
      "Because this uses `wss://`, check any reverse proxy or Tailscale Serve setup too. It must preserve WebSocket upgrades and continue forwarding frames after the initial handshake.",
    );
  }

  if (diagnostics.observedNotifications.length > 0 && authFailure) {
    hints.push(
      "The gateway sent notifications before auth completed. Check the gateway logs around the same time to see why it never answered the `auth.authenticate` request.",
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
      Boolean(input.password),
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

  const sendRpc = (
    socket: NodeWebSocket,
    method: string,
    params?: Record<string, unknown>,
  ): Promise<{ result?: unknown; error?: { code: number; message: string } }> =>
    new Promise((resolve, reject) => {
      const id = rpcId++;
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
        try {
          const message = JSON.parse(bufferToString(data)) as JsonRpcEnvelope;
          if (typeof message.method === "string") {
            pushUnique(diagnostics.observedNotifications, message.method);
          }
          if (message.id === id) {
            settle(() =>
              resolve({
                ...(message.result !== undefined ? { result: message.result } : {}),
                ...(message.error !== undefined ? { error: message.error } : {}),
              }),
            );
          }
        } catch {
          // Ignore non-JSON websocket messages from intermediaries.
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
              `WebSocket closed before RPC '${method}' completed${
                closeDetail ? ` (${closeDetail})` : ""
              }.`,
            ),
          ),
        );
      };

      const onError = (cause: Error) => {
        diagnostics.socketError = toMessage(cause, "WebSocket error.");
        settle(() =>
          reject(new Error(`WebSocket error during RPC '${method}': ${diagnostics.socketError}`)),
        );
      };

      socket.on("message", onMessage);
      socket.on("close", onClose);
      socket.on("error", onError);

      timeout = setTimeout(() => {
        settle(() => reject(new Error(buildTimeoutDetail(method, diagnostics))));
      }, OPENCLAW_TEST_RPC_TIMEOUT_MS);

      try {
        socket.send(
          JSON.stringify({
            jsonrpc: "2.0",
            method,
            ...(params !== undefined ? { params } : {}),
            id,
          }),
        );
      } catch (cause) {
        diagnostics.socketError = toMessage(cause, "WebSocket send failed.");
        settle(() => reject(cause instanceof Error ? cause : new Error(diagnostics.socketError)));
      }
    });

  try {
    const urlStart = Date.now();
    const gatewayUrl = input.gatewayUrl.trim();
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
      ws.on("message", (data: NodeWebSocket.Data) => {
        try {
          const message = JSON.parse(bufferToString(data)) as JsonRpcEnvelope;
          if (typeof message.method === "string") {
            pushUnique(diagnostics.observedNotifications, message.method);
          }
        } catch {
          // Ignore non-JSON websocket messages from intermediaries.
        }
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

    if (input.password) {
      const authStart = Date.now();
      try {
        const authResult = await sendRpc(ws, "auth.authenticate", {
          password: input.password,
        });
        if (authResult.error) {
          const detail = `RPC error ${authResult.error.code}: ${authResult.error.message}`;
          pushStep("Authentication", "fail", Date.now() - authStart, detail);
          return finalize(
            false,
            `Authentication failed: ${authResult.error.message}`,
            "Authentication",
          );
        }
        pushStep("Authentication", "pass", Date.now() - authStart, "Authenticated.");
      } catch (cause) {
        const detail = toMessage(cause, "Authentication request failed.");
        pushStep("Authentication", "fail", Date.now() - authStart, detail);
        return finalize(false, detail, "Authentication");
      }
    }

    const sessionStart = Date.now();
    try {
      const sessionResult = await sendRpc(ws, "session.create");
      if (sessionResult.error) {
        const detail = `RPC error ${sessionResult.error.code}: ${sessionResult.error.message}`;
        pushStep("Session create", "fail", Date.now() - sessionStart, detail);
        return finalize(
          false,
          `Session creation failed: ${sessionResult.error.message}`,
          "Session create",
        );
      }

      const result = (sessionResult.result ?? {}) as Record<string, unknown>;
      const sessionId = typeof result.sessionId === "string" ? result.sessionId : undefined;
      const version = typeof result.version === "string" ? result.version : undefined;
      if (version !== undefined) {
        serverInfo.version = version;
      }
      if (sessionId !== undefined) {
        serverInfo.sessionId = sessionId;
      }
      pushStep(
        "Session create",
        "pass",
        Date.now() - sessionStart,
        sessionId ? `Session ID: ${sessionId}` : "Session created.",
      );
    } catch (cause) {
      const detail = toMessage(cause, "Session creation failed.");
      pushStep("Session create", "fail", Date.now() - sessionStart, detail);
      return finalize(false, detail, "Session create");
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
