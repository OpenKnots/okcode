import { ORCHESTRATION_WS_METHODS } from "@okcode/contracts";
import { Effect, Stream } from "effect";
import { clamp } from "effect/Number";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createOrchestrationRouteHandlers(input: {
  projectionReadModelQuery: {
    getSnapshot: () => Effect.Effect<any, unknown, never>;
  };
  normalizeDispatchCommand: (input: { command: unknown }) => Effect.Effect<any, unknown, never>;
  orchestrationEngine: {
    dispatch: (command: unknown) => Effect.Effect<unknown, unknown, never>;
    readEvents: (fromSequenceExclusive: number) => Stream.Stream<any, unknown, never>;
  };
  checkpointDiffQuery: {
    getTurnDiff: (input: unknown) => Effect.Effect<unknown, unknown, never>;
    getFullThreadDiff: (input: unknown) => Effect.Effect<unknown, unknown, never>;
  };
}): WebSocketRouteRegistry {
  return {
    [ORCHESTRATION_WS_METHODS.getSnapshot]: () => input.projectionReadModelQuery.getSnapshot(),

    [ORCHESTRATION_WS_METHODS.getThreadDetail]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any);
        return yield* input.projectionReadModelQuery
          .getSnapshot()
          .pipe(
            Effect.map(
              (snapshot) =>
                snapshot.threads.find((thread: any) => thread.id === body.threadId) ?? null,
            ),
          );
      }),

    [ORCHESTRATION_WS_METHODS.dispatchCommand]: (_ws, request) =>
      Effect.gen(function* () {
        const { command } = request.body as any;
        const normalizedCommand = yield* input.normalizeDispatchCommand({ command });
        return yield* input.orchestrationEngine.dispatch(normalizedCommand);
      }),

    [ORCHESTRATION_WS_METHODS.getTurnDiff]: (_ws, request) =>
      input.checkpointDiffQuery.getTurnDiff(stripTaggedBody(request.body as any)),

    [ORCHESTRATION_WS_METHODS.getFullThreadDiff]: (_ws, request) =>
      input.checkpointDiffQuery.getFullThreadDiff(stripTaggedBody(request.body as any)),

    [ORCHESTRATION_WS_METHODS.replayEvents]: (_ws, request) =>
      Effect.gen(function* () {
        const { fromSequenceExclusive } = request.body as any;
        return yield* Stream.runCollect(
          input.orchestrationEngine.readEvents(
            clamp(fromSequenceExclusive, {
              maximum: Number.MAX_SAFE_INTEGER,
              minimum: 0,
            }),
          ),
        ).pipe(Effect.map((events) => Array.from(events)));
      }),
  };
}
