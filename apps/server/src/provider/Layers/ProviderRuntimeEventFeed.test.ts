import { EventId, ThreadId, TurnId, type ProviderRuntimeEvent } from "@okcode/contracts";
import { it } from "@effect/vitest";
import { describe, expect } from "vitest";
import { Effect, Layer, Stream } from "effect";

import { ProviderRuntimeEventFeedLive } from "./ProviderRuntimeEventFeed.ts";
import { ProviderRuntimeEventFeed } from "../Services/ProviderRuntimeEventFeed.ts";

function makeTurnStartedEvent(id: string): ProviderRuntimeEvent {
  return {
    type: "turn.started",
    eventId: EventId.makeUnsafe(id),
    provider: "codex",
    threadId: ThreadId.makeUnsafe("thread-1"),
    turnId: TurnId.makeUnsafe(`turn-${id}`),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("ProviderRuntimeEventFeedLive", () => {
  it.effect("replays buffered events to late subscribers before live delivery", () =>
    Effect.gen(function* () {
      const feed = yield* ProviderRuntimeEventFeed;

      yield* feed.publish(makeTurnStartedEvent("evt-1"));
      yield* feed.publish(makeTurnStartedEvent("evt-2"));

      const events = yield* Stream.take(feed.subscribeWithReplay(), 3).pipe(
        Stream.runCollect,
        Effect.fork,
      );

      yield* feed.publish(makeTurnStartedEvent("evt-3"));

      const collected = yield* Effect.fromFiber(events);
      expect(Array.from(collected).map((event) => event.eventId)).toEqual([
        "evt-1",
        "evt-2",
        "evt-3",
      ]);
    }).pipe(Effect.provide(Layer.mergeAll(ProviderRuntimeEventFeedLive))),
  );
});
