import { Effect, Fiber } from "effect";
import { describe, expect, it } from "vitest";

import { makeServerReadiness } from "./readiness";

describe("makeServerReadiness", () => {
  it("stays pending until all readiness markers complete", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readiness = yield* makeServerReadiness;
        const readyFiber = yield* readiness.awaitServerReady.pipe(Effect.forkScoped);

        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markHttpListening;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markPushBusReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markKeybindingsReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markTerminalSubscriptionsReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markOrchestrationSubscriptionsReady;
        yield* Fiber.join(readyFiber);

        expect(readyFiber.pollUnsafe()).not.toBeUndefined();
      }).pipe(Effect.scoped),
    );
  });

  it("resolves regardless of the order markers complete", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const readiness = yield* makeServerReadiness;
        const readyFiber = yield* readiness.awaitServerReady.pipe(Effect.forkScoped);

        yield* readiness.markOrchestrationSubscriptionsReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markTerminalSubscriptionsReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markKeybindingsReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markPushBusReady;
        expect(readyFiber.pollUnsafe()).toBeUndefined();

        yield* readiness.markHttpListening;
        yield* Fiber.join(readyFiber);

        expect(readyFiber.pollUnsafe()).not.toBeUndefined();
      }).pipe(Effect.scoped),
    );
  });
});
