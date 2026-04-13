import {
  DecisionCaseId,
  DecisionConsultationId,
  DecisionConsultationStatus,
  DecisionConsultationTarget,
  IsoDateTime,
  ThreadId,
} from "@okcode/contracts";
import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectionRepositoryError } from "../Errors.ts";

export const DecisionConsultationRow = Schema.Struct({
  consultationId: DecisionConsultationId,
  caseId: DecisionCaseId,
  target: DecisionConsultationTarget,
  status: DecisionConsultationStatus,
  reason: Schema.String,
  questionsJson: Schema.String,
  responseSummary: Schema.NullOr(Schema.String),
  linkedThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  resolvedAt: Schema.NullOr(IsoDateTime),
});
export type DecisionConsultationRow = typeof DecisionConsultationRow.Type;

export const GetDecisionConsultationInput = Schema.Struct({
  consultationId: DecisionConsultationId,
});
export type GetDecisionConsultationInput = typeof GetDecisionConsultationInput.Type;

export const ListDecisionConsultationsInput = Schema.Struct({
  caseId: DecisionCaseId,
});
export type ListDecisionConsultationsInput = typeof ListDecisionConsultationsInput.Type;

export interface DecisionConsultationRepositoryShape {
  readonly upsert: (row: DecisionConsultationRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetDecisionConsultationInput,
  ) => Effect.Effect<
    import("effect").Option.Option<DecisionConsultationRow>,
    ProjectionRepositoryError
  >;
  readonly listByCaseId: (
    input: ListDecisionConsultationsInput,
  ) => Effect.Effect<ReadonlyArray<DecisionConsultationRow>, ProjectionRepositoryError>;
}

export class DecisionConsultationRepository extends ServiceMap.Service<
  DecisionConsultationRepository,
  DecisionConsultationRepositoryShape
>()("okcode/persistence/Services/DecisionConsultations/DecisionConsultationRepository") {}
