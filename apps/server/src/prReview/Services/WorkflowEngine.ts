import type {
  PrConflictAnalysis,
  PrReviewConfig,
  PrReviewDashboardResult,
  PrWorkflowStepResolution,
  PrWorkflowStepRunResult,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface WorkflowEngineShape {
  readonly resolveSteps: (input: {
    readonly config: PrReviewConfig;
    readonly dashboard: Pick<PrReviewDashboardResult, "pullRequest">;
    readonly conflicts: PrConflictAnalysis;
    readonly overrides: ReadonlyArray<PrWorkflowStepRunResult>;
  }) => Effect.Effect<ReadonlyArray<PrWorkflowStepResolution>, never>;
}

export class WorkflowEngine extends ServiceMap.Service<WorkflowEngine, WorkflowEngineShape>()(
  "okcode/prReview/Services/WorkflowEngine",
) {}
