import { Effect, Layer } from "effect";
import type {
  PrConflictAnalysis,
  PrReviewConfig,
  PrReviewDashboardResult,
  PrWorkflowStepResolution,
  PrWorkflowStepRunResult,
} from "@okcode/contracts";
import { WorkflowEngine, type WorkflowEngineShape } from "../Services/WorkflowEngine.ts";

function nowIsoString() {
  return new Date().toISOString();
}

const SUCCESSFUL_CHECK_STATES = new Set(["SUCCESS", "SUCCESSFUL", "NEUTRAL", "SKIPPED"]);

function resolveStepStatus(input: {
  step: PrReviewConfig["workflows"][number]["steps"][number];
  config: PrReviewConfig;
  dashboard: Pick<PrReviewDashboardResult, "pullRequest">;
  conflicts: PrConflictAnalysis;
  override: PrWorkflowStepRunResult | null;
}): PrWorkflowStepResolution {
  if (input.override) {
    return {
      stepId: input.step.id,
      status: input.override.status,
      detail: input.override.summary,
      updatedAt: nowIsoString(),
    };
  }

  if (input.step.kind === "remoteCheck") {
    const requiredChecks = input.config.rules.requiredChecks;
    if (requiredChecks.length === 0) {
      return {
        stepId: input.step.id,
        status: "done",
        detail: "No required remote checks are configured.",
        updatedAt: nowIsoString(),
      };
    }
    const checksByName = new Map(
      input.dashboard.pullRequest.statusChecks.map((check) => [check.name, check] as const),
    );
    const missing = requiredChecks.filter((name) => {
      const check = checksByName.get(name);
      return (
        !check || !SUCCESSFUL_CHECK_STATES.has((check.conclusion ?? check.status).toUpperCase())
      );
    });
    return {
      stepId: input.step.id,
      status: missing.length === 0 ? "done" : "blocked",
      detail:
        missing.length === 0
          ? "All required remote checks are passing."
          : `Waiting on required checks: ${missing.join(", ")}`,
      updatedAt: nowIsoString(),
    };
  }

  if (input.step.kind === "conflictAnalysis") {
    if (input.conflicts.status === "clean") {
      return {
        stepId: input.step.id,
        status: "done",
        detail: input.conflicts.summary,
        updatedAt: nowIsoString(),
      };
    }
    if (input.conflicts.status === "conflicted") {
      return {
        stepId: input.step.id,
        status: "blocked",
        detail: input.conflicts.summary,
        updatedAt: nowIsoString(),
      };
    }
    return {
      stepId: input.step.id,
      status: "todo",
      detail: input.conflicts.summary,
      updatedAt: nowIsoString(),
    };
  }

  if (input.step.kind === "reviewAction") {
    if (input.dashboard.pullRequest.reviewDecision === "APPROVED") {
      return {
        stepId: input.step.id,
        status: "done",
        detail: "GitHub already shows this PR as approved.",
        updatedAt: nowIsoString(),
      };
    }
    return {
      stepId: input.step.id,
      status: "todo",
      detail: "Submit a review action when ready.",
      updatedAt: nowIsoString(),
    };
  }

  return {
    stepId: input.step.id,
    status: "todo",
    detail: input.step.description,
    updatedAt: nowIsoString(),
  };
}

const makeWorkflowEngine = Effect.sync(() => {
  const service: WorkflowEngineShape = {
    resolveSteps: ({ config, dashboard, conflicts, overrides }) =>
      Effect.sync(() => {
        const workflow =
          config.workflows.find((entry) => entry.id === config.defaultWorkflowId) ??
          config.workflows[0];
        if (!workflow) {
          return [];
        }
        const overrideByStepId = new Map(overrides.map((override) => [override.stepId, override]));
        return workflow.steps.map((step) =>
          resolveStepStatus({
            step,
            config,
            dashboard,
            conflicts,
            override: overrideByStepId.get(step.id) ?? null,
          }),
        );
      }),
  };

  return service;
});

export const WorkflowEngineLive = Layer.effect(WorkflowEngine, makeWorkflowEngine);
