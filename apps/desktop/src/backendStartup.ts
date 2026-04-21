import * as Net from "node:net";

export interface WaitForTcpServerInput {
  readonly host: string;
  readonly port: number;
  readonly timeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly tryConnect?: (host: string, port: number) => Promise<boolean>;
}

export async function waitForTcpServer(input: WaitForTcpServerInput): Promise<void> {
  const timeoutMs = input.timeoutMs ?? 15_000;
  const retryDelayMs = input.retryDelayMs ?? 100;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const connected = await (input.tryConnect ?? tryConnect)(input.host, input.port);
    if (connected) {
      return;
    }
    await delay(retryDelayMs);
  }

  throw new Error(`Timed out waiting for backend on ${input.host}:${input.port}`);
}

function tryConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = Net.createConnection({ host, port });
    let settled = false;

    const settle = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(500, () => {
      settle(false);
    });
    socket.once("connect", () => {
      settle(true);
    });
    socket.once("error", () => {
      settle(false);
    });
    socket.once("close", () => {
      settle(false);
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
