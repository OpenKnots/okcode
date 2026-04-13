import {
  DecisionCaseId,
  DecisionConflictKind,
  DecisionSource,
  IsoDateTime,
  ProjectId,
  ThreadId,
  TrimmedNonEmptyString,
} from "@okcode/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectionRepositoryError } from "../Errors.ts";

export const DecisionCaseRow = Schema.Struct({
  caseId: DecisionCaseId,
  projectId: ProjectId,
  cwd: TrimmedNonEmptyString,
  sourceKind: DecisionSource,
  sourceId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  conflictKind: DecisionConflictKind,
  linkedThreadId: Schema.NullOr(ThreadId),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type DecisionCaseRow = typeof DecisionCaseRow.Type;

export const GetDecisionCaseInput = Schema.Struct({
  caseId: DecisionCaseId,
});
export type GetDecisionCaseInput = typeof GetDecisionCaseInput.Type;

export const ListDecisionCasesInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type ListDecisionCasesInput = typeof ListDecisionCasesInput.Type;

export interface DecisionCaseRepositoryShape {
  readonly upsert: (row: DecisionCaseRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetDecisionCaseInput,
  ) => Effect.Effect<Option.Option<DecisionCaseRow>, ProjectionRepositoryError>;
  readonly listByCwd: (
    input: ListDecisionCasesInput,
  ) => Effect.Effect<ReadonlyArray<DecisionCaseRow>, ProjectionRepositoryError>;
}

export class DecisionCaseRepository extends ServiceMap.Service<
  DecisionCaseRepository,
  DecisionCaseRepositoryShape
>()("okcode/persistence/Services/DecisionCases/DecisionCaseRepository") {}
