import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import { generateOpenclawDeviceIdentity } from "./deviceAuth.ts";
import { OpenclawGatewayClient } from "./GatewayClient.ts";

const servers = new Set<WebSocketServer>();

type GatewayRequestFrame = {
  type?: unknown;
  id?: unknown;
  method?: unknown;
  params?: {
    auth?: {
      password?: unknown;
      token?: unknown;
      deviceToken?: unknown;
    };
  };
};

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

function sendChallenge(socket: WebSocket): void {
  socket.send(
    JSON.stringify({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "nonce-123", ts: Date.now() },
    }),
  );
}

describe("OpenclawGatewayClient", () => {
  it("retries with auth.password when a gateway rejects token-style shared-secret auth", async () => {
    const attemptedAuths: GatewayRequestFrame["params"]["auth"][] = [];
    const gateway = await createGatewayServer((socket) => {
      sendChallenge(socket);
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as GatewayRequestFrame;
        if (message.type === "req" && message.method === "connect") {
          attemptedAuths.push(message.params?.auth);
          if (message.params?.auth?.password === "topsecret") {
            socket.send(
              JSON.stringify({
                type: "res",
                id: message.id,
                ok: true,
                payload: { type: "hello-ok", protocol: 3 },
              }),
            );
            return;
          }

          socket.send(
            JSON.stringify({
              type: "res",
              id: message.id,
              ok: false,
              error: {
                code: "INVALID_REQUEST",
                message: "unauthorized: gateway password missing",
                details: {
                  code: "AUTH_PASSWORD_MISSING",
                  reason: "provide gateway auth password",
                  recommendedNextStep: "update_auth_configuration",
                },
              },
            }),
          );
        }
      });
    });

    const connection = await OpenclawGatewayClient.connect({
      url: gateway.url,
      identity: generateOpenclawDeviceIdentity(),
      sharedSecret: "topsecret",
      clientId: "okcode",
      clientVersion: "test",
      clientPlatform: "macos",
      clientMode: "operator",
      locale: "en-US",
      userAgent: "okcode/test",
      role: "operator",
      scopes: ["operator.read", "operator.write"],
    });

    expect(attemptedAuths.some((auth) => auth?.password === "topsecret")).toBe(true);
    await connection.client.close();
  });
});
