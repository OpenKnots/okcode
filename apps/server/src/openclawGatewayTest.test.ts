import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer, type WebSocket } from "ws";

import { OpenclawGatewayTestInternals, runOpenclawGatewayTest } from "./openclawGatewayTest.ts";

const servers = new Set<WebSocketServer>();

type GatewayRequestFrame = {
  type?: unknown;
  id?: unknown;
  method?: unknown;
  params?: {
    client?: {
      id?: unknown;
      displayName?: unknown;
      mode?: unknown;
      deviceFamily?: unknown;
    };
    auth?: {
      password?: unknown;
      token?: unknown;
      deviceToken?: unknown;
    };
    device?: {
      id?: unknown;
      publicKey?: unknown;
      signature?: unknown;
      signedAt?: unknown;
      nonce?: unknown;
    };
  };
};

function isBase64Url(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value);
}

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

describe("runOpenclawGatewayTest", () => {
  it("captures Tailscale-oriented hints for modern handshake timeouts", () => {
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
        observedNotifications: ["connect.challenge"],
        hints: [],
      },
      "Gateway handshake",
      "Gateway request 'connect' timed out after 10000ms.",
      true,
    );

    expect(hints.some((hint) => hint.includes("Tailscale"))).toBe(true);
    expect(hints.some((hint) => hint.includes("actual OpenClaw WebSocket gateway endpoint"))).toBe(
      true,
    );
    expect(hints.some((hint) => hint.includes("reverse proxy"))).toBe(true);
  });

  it("passes when the modern connect handshake succeeds", async () => {
    let connectParams: GatewayRequestFrame["params"];

    const gateway = await createGatewayServer((socket) => {
      sendChallenge(socket);
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as GatewayRequestFrame;
        if (message.type === "req" && message.method === "connect") {
          connectParams = message.params;
          socket.send(
            JSON.stringify({
              type: "res",
              id: message.id,
              ok: true,
              payload: { type: "hello-ok", protocol: 3 },
            }),
          );
        }
      });
    });

    const result = await runOpenclawGatewayTest({
      gatewayUrl: gateway.url,
      password: "topsecret",
    });

    expect(result.success).toBe(true);
    expect(result.steps.find((step) => step.name === "WebSocket connect")?.status).toBe("pass");
    expect(result.steps.find((step) => step.name === "Gateway handshake")?.status).toBe("pass");
    expect(result.diagnostics?.observedNotifications).toContain("connect.challenge");

    expect(connectParams?.client?.id).toBe("gateway-client");
    expect(connectParams?.client?.mode).toBe("backend");
    expect(connectParams?.client?.displayName).toBe("OK Code gateway test");
    expect(connectParams?.client?.deviceFamily).toBe("server");
    expect(connectParams?.auth?.token).toBe("topsecret");
    expect(connectParams?.auth?.password).toBeUndefined();
    expect(connectParams?.auth?.deviceToken).toBeUndefined();
    expect(connectParams?.device?.id).toMatch(/^[a-f0-9]{64}$/);
    expect(connectParams?.device?.id).not.toMatch(/^device_/);
    expect(isBase64Url(connectParams?.device?.publicKey)).toBe(true);
    expect(String(connectParams?.device?.publicKey)).not.toContain("BEGIN");
    expect(isBase64Url(connectParams?.device?.signature)).toBe(true);
    expect(connectParams?.device?.nonce).toBe("nonce-123");
    expect(typeof connectParams?.device?.signedAt).toBe("number");
  });

  it("reports pairing-required detail codes from the connect handshake", async () => {
    const gateway = await createGatewayServer((socket) => {
      sendChallenge(socket);
      socket.on("message", (data) => {
        const message = JSON.parse(data.toString()) as GatewayRequestFrame;
        if (message.type === "req" && message.method === "connect") {
          socket.send(
            JSON.stringify({
              type: "res",
              id: message.id,
              ok: false,
              error: {
                message: "device is not approved",
                details: {
                  code: "PAIRING_REQUIRED",
                  reason: "pairing-required",
                  recommendedNextStep: "approve_device",
                },
              },
            }),
          );
        }
      });
    });

    const result = await runOpenclawGatewayTest({
      gatewayUrl: gateway.url,
      password: "topsecret",
    });

    expect(result.success).toBe(false);
    expect(result.steps.find((step) => step.name === "WebSocket connect")?.status).toBe("pass");

    const handshakeStep = result.steps.find((step) => step.name === "Gateway handshake");
    expect(handshakeStep?.status).toBe("fail");
    expect(handshakeStep?.detail).toContain("PAIRING_REQUIRED");

    expect(result.diagnostics?.gatewayErrorDetailCode).toBe("PAIRING_REQUIRED");
    expect(result.diagnostics?.gatewayErrorDetailReason).toBe("pairing-required");
    expect(result.diagnostics?.gatewayRecommendedNextStep).toBe("approve_device");
    expect(result.diagnostics?.hints.some((hint) => hint.includes("pairing approval"))).toBe(true);
  });
});
