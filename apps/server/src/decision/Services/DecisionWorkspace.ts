import type {
  DecisionCaseSummary,
  DecisionExecuteRecommendationInput,
  DecisionExecutionResult,
  DecisionGetWorkspaceInput,
  DecisionListCasesInput,
  DecisionRequestConsultationInput,
  DecisionRespondConsultationInput,
  DecisionWorkspace as DecisionWorkspaceResult,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { DecisionWorkspaceServiceError } from "../Errors.ts";

export interface DecisionWorkspaceShape {
  readonly listCases: (
    input: DecisionListCasesInput,
  ) => Effect.Effect<ReadonlyArray<DecisionCaseSummary>, DecisionWorkspaceServiceError>;
  readonly getWorkspace: (
    input: DecisionGetWorkspaceInput,
  ) => Effect.Effect<DecisionWorkspaceResult, DecisionWorkspaceServiceError>;
  readonly reanalyze: (
    input: DecisionGetWorkspaceInput,
  ) => Effect.Effect<DecisionWorkspaceResult, DecisionWorkspaceServiceError>;
  readonly requestConsultation: (
    input: DecisionRequestConsultationInput,
  ) => Effect.Effect<DecisionWorkspaceResult, DecisionWorkspaceServiceError>;
  readonly respondConsultation: (
    input: DecisionRespondConsultationInput,
  ) => Effect.Effect<DecisionWorkspaceResult, DecisionWorkspaceServiceError>;
  readonly executeRecommendation: (
    input: DecisionExecuteRecommendationInput,
  ) => Effect.Effect<DecisionExecutionResult, DecisionWorkspaceServiceError>;
}

export class DecisionWorkspace extends ServiceMap.Service<
  DecisionWorkspace,
  DecisionWorkspaceShape
>()("okcode/decision/Services/DecisionWorkspace") {}
