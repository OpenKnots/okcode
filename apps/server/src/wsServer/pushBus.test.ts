import type { WebSocket } from "ws";
import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { Effect, Ref } from "effect";
import { WS_CHANNELS } from "@okcode/contracts";

import { makeServerPushBus } from "./pushBus";

class MockWebSocket {
  static readonly OPEN = 1;

  readonly OPEN = MockWebSocket.OPEN;
  readyState = MockWebSocket.OPEN;
  readonly sent: string[] = [];
  throwOnSend = false;
  private readonly waiters = new Set<() => void>();

  send(message: string) {
    if (this.throwOnSend) {
      throw new Error("send failed");
    }
    this.sent.push(message);
    for (const waiter of this.waiters) {
      waiter();
    }
  }

  waitForSentCount(count: number): Promise<void> {
    if (this.sent.length >= count) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const check = () => {
        if (this.sent.length < count) {
          return;
        }
        this.waiters.delete(check);
        resolve();
      };

      this.waiters.add(check);
    });
  }
}

describe("makeServerPushBus", () => {
  it.live("waits for the welcome push before a new client joins broadcast delivery", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const client = new MockWebSocket();
        const clients = yield* Ref.make(new Set<WebSocket>());
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: () => {},
          logDeliveryFailure: () => {},
        });

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [{ kind: "keybindings.malformed-config", message: "queued-before-connect" }],
          providers: [],
        });

        const delivered = yield* pushBus.publishClient(
          client as unknown as WebSocket,
          WS_CHANNELS.serverWelcome,
          {
            cwd: "/tmp/project",
            projectName: "project",
          },
        );
        expect(delivered).toBe(true);

        yield* Ref.update(clients, (current) => current.add(client as unknown as WebSocket));

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [],
          providers: [],
        });

        yield* Effect.promise(() => client.waitForSentCount(2));

        const messages = client.sent.map(
          (message) => JSON.parse(message) as { channel: string; data: unknown },
        );

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({
          type: "push",
          sequence: 2,
          channel: WS_CHANNELS.serverWelcome,
          data: {
            cwd: "/tmp/project",
            projectName: "project",
          },
        });
        expect(messages[1]).toEqual({
          type: "push",
          sequence: 3,
          channel: WS_CHANNELS.serverConfigUpdated,
          data: {
            issues: [],
            providers: [],
          },
        });
      }),
    ),
  );

  it.live("continues broadcasting when one client send throws", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const failingClient = new MockWebSocket();
        failingClient.throwOnSend = true;
        const healthyClient = new MockWebSocket();
        const clients = yield* Ref.make(
          new Set<WebSocket>([
            failingClient as unknown as WebSocket,
            healthyClient as unknown as WebSocket,
          ]),
        );
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: () => {},
          logDeliveryFailure: () => {},
        });

        yield* pushBus.publishAll(WS_CHANNELS.serverConfigUpdated, {
          issues: [],
          providers: [],
        });

        yield* Effect.promise(() => healthyClient.waitForSentCount(1));
        expect(healthyClient.sent).toHaveLength(1);
        expect(failingClient.sent).toHaveLength(0);
      }),
    ),
  );

  it.live("returns false when a targeted client send throws", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const client = new MockWebSocket();
        client.throwOnSend = true;
        const clients = yield* Ref.make(new Set<WebSocket>());
        const pushBus = yield* makeServerPushBus({
          clients,
          logOutgoingPush: () => {},
          logDeliveryFailure: () => {},
        });

        const delivered = yield* pushBus.publishClient(
          client as unknown as WebSocket,
          WS_CHANNELS.serverWelcome,
          {
            cwd: "/tmp/project",
            projectName: "project",
          },
        );

        expect(delivered).toBe(false);
      }),
    ),
  );
});
