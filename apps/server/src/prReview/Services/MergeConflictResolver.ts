import type { PrConflictAnalysis, PrConflictApplyResult, PrReviewSummary } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { PrReviewError } from "../Errors.ts";

export interface MergeConflictResolverShape {
  readonly analyze: (input: {
    readonly cwd: string;
    readonly pullRequest: PrReviewSummary;
  }) => Effect.Effect<PrConflictAnalysis, PrReviewError>;
  readonly apply: (input: {
    readonly cwd: string;
    readonly pullRequest: PrReviewSummary;
    readonly candidateId: string;
  }) => Effect.Effect<PrConflictApplyResult, PrReviewError>;
}

export class MergeConflictResolver extends ServiceMap.Service<
  MergeConflictResolver,
  MergeConflictResolverShape
>()("okcode/prReview/Services/MergeConflictResolver") {}
