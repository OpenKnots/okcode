import { Effect, Layer, Ref } from "effect";
import {
  PrReviewProjection,
  type PrReviewProjectionShape,
} from "../Services/PrReviewProjection.ts";

type WorkflowStateRecord = {
  readonly [stepId: string]: import("@okcode/contracts").PrWorkflowStepRunResult;
};

const keyFor = (cwd: string, prNumber: number) => `${cwd}::${prNumber}`;

const makePrReviewProjection = Effect.gen(function* () {
  const stateRef = yield* Ref.make(new Map<string, WorkflowStateRecord>());

  const service: PrReviewProjectionShape = {
    listWorkflowStatuses: ({ cwd, prNumber }) =>
      Ref.get(stateRef).pipe(
        Effect.map((state) => Object.values(state.get(keyFor(cwd, prNumber)) ?? {})),
      ),
    upsertWorkflowStatus: ({ cwd, prNumber, status }) =>
      Ref.update(stateRef, (current) => {
        const next = new Map(current);
        const key = keyFor(cwd, prNumber);
        const existing = next.get(key) ?? {};
        next.set(key, { ...existing, [status.stepId]: status });
        return next;
      }),
  };

  return service;
});

export const PrReviewProjectionLive = Layer.effect(PrReviewProjection, makePrReviewProjection);
