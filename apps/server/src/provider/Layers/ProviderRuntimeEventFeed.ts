import type { ProviderRuntimeEvent } from "@okcode/contracts";
import { Effect, Layer, Queue, Ref, Scope, Stream } from "effect";
import * as Semaphore from "effect/Semaphore";

import {
  ProviderRuntimeEventFeed,
  type ProviderRuntimeEventFeedShape,
} from "../Services/ProviderRuntimeEventFeed.ts";

const PROVIDER_RUNTIME_EVENT_REPLAY_CAPACITY = 256;

interface FeedState {
  readonly buffer: ReadonlyArray<ProviderRuntimeEvent>;
  readonly subscribers: ReadonlySet<Queue.Queue<ProviderRuntimeEvent>>;
}

const appendToReplayBuffer = (
  buffer: ReadonlyArray<ProviderRuntimeEvent>,
  event: ProviderRuntimeEvent,
): ReadonlyArray<ProviderRuntimeEvent> => {
  if (buffer.length < PROVIDER_RUNTIME_EVENT_REPLAY_CAPACITY) {
    return [...buffer, event];
  }
  return [...buffer.slice(1), event];
};

const makeProviderRuntimeEventFeed = Effect.gen(function* () {
  const stateRef = yield* Ref.make<FeedState>({
    buffer: [],
    subscribers: new Set<Queue.Queue<ProviderRuntimeEvent>>(),
  });
  const mutex = yield* Semaphore.make(1);

  const publish: ProviderRuntimeEventFeedShape["publish"] = (event) =>
    mutex.withPermits(1)(
      Effect.gen(function* () {
        const subscribers = yield* Ref.modify(stateRef, (state) => {
          const nextState: FeedState = {
            buffer: appendToReplayBuffer(state.buffer, event),
            subscribers: state.subscribers,
          };
          return [Array.from(state.subscribers), nextState] as const;
        });
        yield* Effect.forEach(subscribers, (subscriber) => Queue.offer(subscriber, event), {
          discard: true,
        });
      }),
    );

  const subscribeWithReplay: ProviderRuntimeEventFeedShape["subscribeWithReplay"] = () =>
    Stream.unwrap(
      Effect.gen(function* () {
        const scope = yield* Effect.scope;
        const subscriber = yield* Queue.unbounded<ProviderRuntimeEvent>();
        const replay = yield* mutex.withPermits(1)(
          Ref.modify(stateRef, (state) => {
            const subscribers = new Set(state.subscribers);
            subscribers.add(subscriber);
            return [
              state.buffer,
              {
                buffer: state.buffer,
                subscribers,
              } satisfies FeedState,
            ] as const;
          }),
        );

        yield* Effect.forEach(replay, (event) => Queue.offer(subscriber, event), {
          discard: true,
        });

        yield* Scope.addFinalizer(
          scope,
          mutex.withPermits(1)(
            Ref.update(stateRef, (state) => {
              const subscribers = new Set(state.subscribers);
              subscribers.delete(subscriber);
              return {
                buffer: state.buffer,
                subscribers,
              } satisfies FeedState;
            }),
          ),
        );

        return Stream.fromQueue(subscriber);
      }),
    );

  return {
    publish,
    subscribeWithReplay,
  } satisfies ProviderRuntimeEventFeedShape;
});

export const ProviderRuntimeEventFeedLive = Layer.effect(
  ProviderRuntimeEventFeed,
  makeProviderRuntimeEventFeed,
);
