import type { PrReviewConfig, PrReviewRepoConfigUpdatedPayload } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { PrReviewConfigError } from "../Errors.ts";

export interface RepoReviewConfigShape {
  readonly getConfig: (input: {
    readonly cwd: string;
  }) => Effect.Effect<PrReviewConfig, PrReviewConfigError>;
  readonly watchRepo: (input: {
    readonly cwd: string;
    readonly onChange: (payload: PrReviewRepoConfigUpdatedPayload) => void;
  }) => Effect.Effect<void, PrReviewConfigError>;
}

export class RepoReviewConfig extends ServiceMap.Service<RepoReviewConfig, RepoReviewConfigShape>()(
  "okcode/prReview/Services/RepoReviewConfig",
) {}
