import type {
  GitHubUserPreview,
  PrConflictAnalysis,
  PrConflictApplyResult,
  PrReviewConfig,
  PrReviewDashboardInput,
  PrReviewDashboardResult,
  PrReviewPatchInput,
  PrReviewPatchResult,
  PrReviewRepoConfigUpdatedPayload,
  PrReviewSearchUsersInput,
  PrReviewSearchUsersResult,
  PrReviewUserPreviewInput,
  PrSubmitReviewInput,
  PrSubmitReviewResult,
  PrWorkflowStepRunResult,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { PrReviewServiceError } from "../Errors.ts";

export interface PrReviewShape {
  readonly getConfig: (input: {
    readonly cwd: string;
  }) => Effect.Effect<PrReviewConfig, PrReviewServiceError>;
  readonly watchRepoConfig: (input: {
    readonly cwd: string;
    readonly onChange: (payload: PrReviewRepoConfigUpdatedPayload) => void;
  }) => Effect.Effect<void, PrReviewServiceError>;
  readonly getDashboard: (
    input: PrReviewDashboardInput,
  ) => Effect.Effect<PrReviewDashboardResult, PrReviewServiceError>;
  readonly getPatch: (
    input: PrReviewPatchInput,
  ) => Effect.Effect<PrReviewPatchResult, PrReviewServiceError>;
  readonly addThread: (
    input: import("@okcode/contracts").PrReviewAddThreadInput,
  ) => Effect.Effect<PrReviewDashboardResult, PrReviewServiceError>;
  readonly replyToThread: (
    input: import("@okcode/contracts").PrReviewReplyToThreadInput,
  ) => Effect.Effect<PrReviewDashboardResult, PrReviewServiceError>;
  readonly resolveThread: (
    input: import("@okcode/contracts").PrReviewResolveThreadInput,
  ) => Effect.Effect<PrReviewDashboardResult, PrReviewServiceError>;
  readonly unresolveThread: (
    input: import("@okcode/contracts").PrReviewResolveThreadInput,
  ) => Effect.Effect<PrReviewDashboardResult, PrReviewServiceError>;
  readonly searchUsers: (
    input: PrReviewSearchUsersInput,
  ) => Effect.Effect<PrReviewSearchUsersResult, PrReviewServiceError>;
  readonly getUserPreview: (
    input: PrReviewUserPreviewInput,
  ) => Effect.Effect<GitHubUserPreview, PrReviewServiceError>;
  readonly analyzeConflicts: (
    input: PrReviewDashboardInput,
  ) => Effect.Effect<PrConflictAnalysis, PrReviewServiceError>;
  readonly applyConflictResolution: (
    input: import("@okcode/contracts").PrReviewApplyConflictResolutionInput,
  ) => Effect.Effect<PrConflictApplyResult, PrReviewServiceError>;
  readonly runWorkflowStep: (
    input: import("@okcode/contracts").PrReviewRunWorkflowStepInput,
  ) => Effect.Effect<PrWorkflowStepRunResult, PrReviewServiceError>;
  readonly submitReview: (
    input: PrSubmitReviewInput,
  ) => Effect.Effect<PrSubmitReviewResult, PrReviewServiceError>;
}

export class PrReview extends ServiceMap.Service<PrReview, PrReviewShape>()(
  "okcode/prReview/Services/PrReview",
) {}
