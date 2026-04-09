import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import { OpenclawGatewayTestInternals, runOpenclawGatewayTest } from "./openclawGatewayTest.ts";

const servers = new Set<WebSocketServer>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve) => {
          for (const client of server.clients) {
            client.terminate();
          }
          server.close(() => resolve());
        }),
    ),
  );
  servers.clear();
});

async function createGatewayServer(
  onConnection: (socket: WebSocket) => void,
): Promise<{ url: string }> {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  servers.add(server);
  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });
  server.on("connection", onConnection);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address for the test websocket server.");
  }
  return { url: `ws://127.0.0.1:${address.port}` };
}

describe("runOpenclawGatewayTest", () => {
  it("captures Tailscale-oriented hints for auth timeouts", () => {
    const hostKind = OpenclawGatewayTestInternals.classifyGatewayHost("vals-mini.example.ts.net", [
      "100.90.12.34",
    ]);

    expect(hostKind).toBe("tailscale");

    const hints = OpenclawGatewayTestInternals.buildHints(
      new URL("wss://vals-mini.example.ts.net"),
      {
        resolvedAddresses: ["100.90.12.34"],
        hostKind,
        healthStatus: "skip",
        observedNotifications: [],
        hints: [],
      },
      "Authentication",
      "RPC 'auth.authenticate' timed out after 10000ms.",
      true,
    );

    expect(hints.some((hint) => hint.includes("Tailscale"))).toBe(true);
    expect(hints.some((hint) => hint.includes("actual OpenClaw JSON-RPC gateway endpoint"))).toBe(
      true,
    );
    expect(hints.some((hint) => hint.includes("reverse proxy"))).toBe(true);
  });

  it("reports socket-close details when auth fails mid-handshake", async () => {
    const gateway = await createGatewayServer((socket) => {
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as { method?: string };
        if (message.method === "auth.authenticate") {
          socket.close(4401, "gateway auth unavailable");
        }
      });
    });

    const result = await runOpenclawGatewayTest({
      gatewayUrl: gateway.url,
      password: "topsecret",
    });

    expect(result.success).toBe(false);
    expect(result.steps.find((step) => step.name === "WebSocket connect")?.status).toBe("pass");

    const authStep = result.steps.find((step) => step.name === "Authentication");
    expect(authStep?.status).toBe("fail");
    expect(authStep?.detail).toContain("WebSocket closed before RPC 'auth.authenticate' completed");

    expect(result.diagnostics?.socketCloseCode).toBe(4401);
    expect(result.diagnostics?.socketCloseReason).toBe("gateway auth unavailable");
    expect(result.diagnostics?.hints.some((hint) => hint.includes("loopback-only"))).toBe(true);
  });
});
