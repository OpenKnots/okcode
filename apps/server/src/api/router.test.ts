import http from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { createApiRouter } from "./router";
import { TokenManager } from "../tokenManager";

interface HttpResponse {
  readonly statusCode: number;
  readonly body: string;
}

async function withServer(
  handler: http.RequestListener,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected server address");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

async function request(
  baseUrl: string,
  pathname: string,
  init?: RequestInit,
): Promise<HttpResponse> {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  return {
    statusCode: response.status,
    body: await response.text(),
  };
}

describe("createApiRouter", () => {
  const openServers = new Set<http.Server>();

  afterEach(async () => {
    await Promise.all(
      Array.from(openServers).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error?: Error) => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          }),
      ),
    );
    openServers.clear();
  });

  it("keeps the legacy pairing route working through the auth router seamline", async () => {
    const tokenManager = new TokenManager("server-auth-token");
    const tryHandleApiRequest = createApiRouter({
      authToken: "server-auth-token",
      host: "127.0.0.1",
      port: 31337,
      tokenManager,
    });

    await withServer(
      (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        void tryHandleApiRequest(req, res, url);
      },
      async (baseUrl) => {
        const response = await request(baseUrl, "/api/pairing?ttl=300");
        const body = JSON.parse(response.body) as {
          pairingUrl: string;
          serverUrl: string;
          expiresAt: string;
        };
        expect(response.statusCode).toBe(200);
        expect(body.serverUrl).toBe("http://127.0.0.1:31337");
        expect(body.pairingUrl).toContain("okcode://pair?server=");
        expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      },
    );
  });

  it("proxies Anthropic message requests with the Claude Code envelope", async () => {
    let upstreamHeaders: http.IncomingHttpHeaders | null = null;
    let upstreamBody: Record<string, unknown> | null = null;

    const upstreamServer = http.createServer(async (req, res) => {
      upstreamHeaders = req.headers;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
      }
      upstreamBody = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, proxied: true }));
    });
    openServers.add(upstreamServer);
    await new Promise<void>((resolve, reject) => {
      upstreamServer.listen(0, "127.0.0.1", (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const upstreamAddress = upstreamServer.address();
    if (typeof upstreamAddress !== "object" || upstreamAddress === null) {
      throw new Error("Expected upstream server address");
    }

    const tryHandleApiRequest = createApiRouter({
      authToken: undefined,
      host: "127.0.0.1",
      port: 31337,
      tokenManager: new TokenManager(undefined),
      anthropicBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
    });

    await withServer(
      (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        void tryHandleApiRequest(req, res, url);
      },
      async (baseUrl) => {
        const response = await request(baseUrl, "/api/auth/anthropic/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": "test-key",
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "tools-2024-04-04",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 64,
            system: "Original system prompt",
            messages: [{ role: "user", content: "Hello" }],
            stream: true,
          }),
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.body)).toEqual({ ok: true, proxied: true });
        expect(upstreamHeaders?.["x-api-key"]).toBe("test-key");
        expect(upstreamHeaders?.["anthropic-version"]).toBe("2023-06-01");
        expect(upstreamHeaders?.["anthropic-beta"]).toBe("claude-code-20250219,tools-2024-04-04");
        expect(upstreamBody).toMatchObject({
          model: "claude-sonnet-4-20250514",
          stream: true,
        });
        expect(upstreamBody?.system).toEqual([
          {
            type: "text",
            text: "You are Claude Code, Anthropic's official CLI for Claude.",
          },
          {
            type: "text",
            text: "Original system prompt",
          },
        ]);
      },
    );
  });

  it("returns a JSON 404 for unknown API routes", async () => {
    const tryHandleApiRequest = createApiRouter({
      authToken: undefined,
      host: "127.0.0.1",
      port: 31337,
      tokenManager: new TokenManager(undefined),
    });

    await withServer(
      (req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        void tryHandleApiRequest(req, res, url);
      },
      async (baseUrl) => {
        const response = await request(baseUrl, "/api/unknown");
        expect(response.statusCode).toBe(404);
        expect(JSON.parse(response.body)).toEqual({ error: "Not Found" });
      },
    );
  });
});
