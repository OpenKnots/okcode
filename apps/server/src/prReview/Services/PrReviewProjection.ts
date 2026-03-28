import type { PrWorkflowStepRunResult } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface PrReviewProjectionShape {
  readonly listWorkflowStatuses: (input: {
    readonly cwd: string;
    readonly prNumber: number;
  }) => Effect.Effect<ReadonlyArray<PrWorkflowStepRunResult>, never>;
  readonly upsertWorkflowStatus: (input: {
    readonly cwd: string;
    readonly prNumber: number;
    readonly status: PrWorkflowStepRunResult;
  }) => Effect.Effect<void, never>;
}

export class PrReviewProjection extends ServiceMap.Service<
  PrReviewProjection,
  PrReviewProjectionShape
>()("okcode/prReview/Services/PrReviewProjection") {}
