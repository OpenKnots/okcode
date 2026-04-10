import type {
  DecisionCase,
  DecisionConfidenceAnalysis,
  DecisionConsultation,
  DecisionConsultationQuestion,
  DecisionConsultationStatus,
  DecisionConsultationTarget,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type { DecisionWorkspaceServiceError } from "../Errors.ts";

export interface DecisionProjectionShape {
  readonly upsertCase: (input: DecisionCase) => Effect.Effect<void, DecisionWorkspaceServiceError>;
  readonly getCase: (input: {
    readonly caseId: string;
  }) => Effect.Effect<DecisionCase | null, DecisionWorkspaceServiceError>;
  readonly listCasesByCwd: (input: {
    readonly cwd: string;
  }) => Effect.Effect<ReadonlyArray<DecisionCase>, DecisionWorkspaceServiceError>;
  readonly upsertConsultation: (input: {
    readonly consultation: DecisionConsultation;
    readonly questions: ReadonlyArray<DecisionConsultationQuestion>;
  }) => Effect.Effect<void, DecisionWorkspaceServiceError>;
  readonly getConsultation: (input: {
    readonly consultationId: string;
  }) => Effect.Effect<
    { consultation: DecisionConsultation; questions: ReadonlyArray<DecisionConsultationQuestion> } | null,
    DecisionWorkspaceServiceError
  >;
  readonly listConsultationsByCaseId: (input: {
    readonly caseId: string;
  }) => Effect.Effect<ReadonlyArray<DecisionConsultation>, DecisionWorkspaceServiceError>;
  readonly appendScoreSnapshot: (input: {
    readonly caseId: string;
    readonly analysis: DecisionConfidenceAnalysis;
  }) => Effect.Effect<void, DecisionWorkspaceServiceError>;
  readonly listScoreSnapshots: (input: {
    readonly caseId: string;
  }) => Effect.Effect<ReadonlyArray<DecisionConfidenceAnalysis>, DecisionWorkspaceServiceError>;
  readonly createConsultation: (input: {
    readonly caseId: string;
    readonly target: DecisionConsultationTarget;
    readonly status: DecisionConsultationStatus;
    readonly reason: string;
    readonly questions: ReadonlyArray<DecisionConsultationQuestion>;
    readonly linkedThreadId: string | null;
    readonly responseSummary?: string | null;
    readonly resolvedAt?: string | null;
  }) => Effect.Effect<DecisionConsultation, DecisionWorkspaceServiceError>;
}

export class DecisionProjection extends ServiceMap.Service<
  DecisionProjection,
  DecisionProjectionShape
>()("okcode/decision/Services/DecisionProjection") {}
