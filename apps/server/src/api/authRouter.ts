import http from "node:http";
import type { TokenManager } from "../tokenManager.ts";

const PAIRING_PATHS = new Set(["/api/pairing", "/api/auth/pairing"]);
const ANTHROPIC_PROXY_PREFIX = "/api/auth/anthropic";
const ANTHROPIC_MESSAGES_PATH_PREFIX = `${ANTHROPIC_PROXY_PREFIX}/v1/messages`;
const CLAUDE_CODE_BETA = "claude-code-20250219";
const CLAUDE_CODE_SYSTEM_PROMPT = "You are Claude Code, Anthropic's official CLI for Claude.";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";

interface AuthApiRouterOptions {
  readonly authToken: string | undefined;
  readonly host: string | undefined;
  readonly port: number;
  readonly tokenManager: TokenManager;
  readonly fetchImpl?: typeof fetch;
  readonly anthropicBaseUrl?: string;
}

function respondJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
  headers?: Record<string, string>,
): void {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  });
  res.end(JSON.stringify(body));
}

function buildServerUrl(host: string | undefined, port: number): string {
  const effectiveHost =
    !host || host === "0.0.0.0" || host === "::" || host === "[::]" ? "localhost" : host;
  const formattedHost =
    effectiveHost.includes(":") && !effectiveHost.startsWith("[")
      ? `[${effectiveHost}]`
      : effectiveHost;
  return `http://${formattedHost}:${port}`;
}

function mergeAnthropicBetaHeader(value: string | null): string {
  const parts = (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.includes(CLAUDE_CODE_BETA)) {
    parts.unshift(CLAUDE_CODE_BETA);
  }
  return parts.join(",");
}

async function readJsonRequestBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return null;
  }

  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

function injectClaudeCodeSystemPrompt(body: Record<string, unknown>): Record<string, unknown> {
  const systemBlock = { type: "text", text: CLAUDE_CODE_SYSTEM_PROMPT };
  const existingSystem = body.system;

  if (existingSystem === undefined) {
    return {
      ...body,
      system: [systemBlock],
    };
  }

  if (typeof existingSystem === "string") {
    return {
      ...body,
      system: [systemBlock, { type: "text", text: existingSystem }],
    };
  }

  if (Array.isArray(existingSystem)) {
    return {
      ...body,
      system: [systemBlock, ...existingSystem],
    };
  }

  return {
    ...body,
    system: [systemBlock],
  };
}

export function createAuthApiRouter(options: AuthApiRouterOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const anthropicBaseUrl = new URL(options.anthropicBaseUrl ?? DEFAULT_ANTHROPIC_BASE_URL);
  const serverUrl = buildServerUrl(options.host, options.port);
  let requestCount = 0;

  return async function tryHandleAuthApiRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<boolean> {
    if (PAIRING_PATHS.has(url.pathname) && req.method === "GET") {
      if (!options.authToken) {
        respondJson(
          res,
          200,
          { error: "Auth is not enabled on this server." },
          { "Access-Control-Allow-Origin": "*" },
        );
        return true;
      }

      const ttlParam = url.searchParams.get("ttl");
      const ttlSeconds = ttlParam ? Math.min(Math.max(Number(ttlParam), 30), 3600) : 300;
      const record = options.tokenManager.generatePairingToken({ ttlSeconds, label: "http-api" });
      const pairingUrl = `okcode://pair?server=${encodeURIComponent(serverUrl)}&token=${encodeURIComponent(record.tokenValue)}`;
      respondJson(
        res,
        200,
        {
          pairingUrl,
          expiresAt: record.expiresAt,
          serverUrl,
        },
        { "Access-Control-Allow-Origin": "*" },
      );
      return true;
    }

    if (url.pathname === `${ANTHROPIC_PROXY_PREFIX}/health` && req.method === "GET") {
      respondJson(res, 200, {
        status: "ok",
        proxy: "anthropic",
        upstreamOrigin: anthropicBaseUrl.origin,
      });
      return true;
    }

    if (url.pathname === `${ANTHROPIC_PROXY_PREFIX}/status` && req.method === "GET") {
      respondJson(res, 200, {
        status: "running",
        proxy: "anthropic",
        upstreamOrigin: anthropicBaseUrl.origin,
        requestsServed: requestCount,
      });
      return true;
    }

    if (req.method !== "POST" || !url.pathname.startsWith(ANTHROPIC_MESSAGES_PATH_PREFIX)) {
      return false;
    }

    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      respondJson(res, 401, { error: "Missing x-api-key header." });
      return true;
    }

    let body: Record<string, unknown> | null;
    try {
      body = await readJsonRequestBody(req);
    } catch {
      respondJson(res, 400, { error: "Invalid JSON body." });
      return true;
    }

    if (!body) {
      respondJson(res, 400, { error: "Request body must be a JSON object." });
      return true;
    }

    const proxiedBody = injectClaudeCodeSystemPrompt(body);
    const upstreamPath = `${url.pathname.slice(ANTHROPIC_PROXY_PREFIX.length)}${url.search}`;
    const upstreamUrl = new URL(upstreamPath, anthropicBaseUrl);
    const payload = JSON.stringify(proxiedBody);
    const headers = new Headers({
      "content-type": "application/json",
      "anthropic-version":
        typeof req.headers["anthropic-version"] === "string"
          ? req.headers["anthropic-version"]
          : DEFAULT_ANTHROPIC_VERSION,
      "anthropic-beta": mergeAnthropicBetaHeader(
        typeof req.headers["anthropic-beta"] === "string" ? req.headers["anthropic-beta"] : null,
      ),
      "x-api-key": apiKey,
    });
    if (typeof req.headers.accept === "string" && req.headers.accept.length > 0) {
      headers.set("accept", req.headers.accept);
    }
    if (
      typeof req.headers["anthropic-dangerous-direct-browser-access-control"] === "string" &&
      req.headers["anthropic-dangerous-direct-browser-access-control"].length > 0
    ) {
      headers.set(
        "anthropic-dangerous-direct-browser-access-control",
        req.headers["anthropic-dangerous-direct-browser-access-control"],
      );
    }

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetchImpl(upstreamUrl, {
        method: "POST",
        headers,
        body: payload,
      });
      requestCount += 1;
    } catch (error) {
      respondJson(res, 502, {
        error: `Upstream error: ${error instanceof Error ? error.message : String(error)}`,
      });
      return true;
    }

    const responseHeaders = Object.fromEntries(upstreamResponse.headers.entries());
    res.writeHead(upstreamResponse.status, responseHeaders);
    if (!upstreamResponse.body) {
      res.end();
      return true;
    }

    try {
      const reader = upstreamResponse.body.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) {
          break;
        }
        if (!res.writableEnded) {
          res.write(next.value);
        }
      }
      if (!res.writableEnded) {
        res.end();
      }
    } catch {
      if (!res.destroyed) {
        res.destroy();
      }
    }
    return true;
  };
}
