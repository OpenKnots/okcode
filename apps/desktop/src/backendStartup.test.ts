import * as Net from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { waitForTcpServer } from "./backendStartup";

const servers = new Set<Net.Server>();

async function listenOnLoopback(delayMs = 0): Promise<{ server: Net.Server; port: number }> {
  const server = Net.createServer();
  servers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    setTimeout(() => {
      server.listen(0, "127.0.0.1", () => {
        resolve();
      });
    }, delayMs);
  });

  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { server, port };
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  servers.clear();
});

describe("waitForTcpServer", () => {
  it("resolves when the server is already listening", async () => {
    const { port } = await listenOnLoopback();

    await expect(waitForTcpServer({ host: "127.0.0.1", port, timeoutMs: 500 })).resolves.toBe(
      undefined,
    );
  });

  it("waits for a delayed server startup", async () => {
    let attempts = 0;

    await expect(
      waitForTcpServer({
        host: "127.0.0.1",
        port: 3773,
        timeoutMs: 1_000,
        retryDelayMs: 20,
        tryConnect: async () => {
          attempts += 1;
          return attempts >= 4;
        },
      }),
    ).resolves.toBe(undefined);
    expect(attempts).toBe(4);
  });

  it("fails when the server never starts", async () => {
    const probe = Net.createServer();
    await new Promise<void>((resolve) => {
      probe.listen(0, "127.0.0.1", () => resolve());
    });
    const address = probe.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    await new Promise<void>((resolve) => probe.close(() => resolve()));

    await expect(
      waitForTcpServer({ host: "127.0.0.1", port, timeoutMs: 120, retryDelayMs: 20 }),
    ).rejects.toThrow(`Timed out waiting for backend on 127.0.0.1:${port}`);
  });
});
