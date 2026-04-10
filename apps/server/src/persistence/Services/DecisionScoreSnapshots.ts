import { DecisionCaseId, IsoDateTime, NonNegativeInt, TrimmedNonEmptyString } from "@okcode/contracts";
import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";
import type { ProjectionRepositoryError } from "../Errors.ts";

export const DecisionScoreSnapshotRow = Schema.Struct({
  snapshotId: TrimmedNonEmptyString,
  caseId: DecisionCaseId,
  score: NonNegativeInt,
  analysisJson: Schema.String,
  createdAt: IsoDateTime,
});
export type DecisionScoreSnapshotRow = typeof DecisionScoreSnapshotRow.Type;

export const ListDecisionScoreSnapshotsInput = Schema.Struct({
  caseId: DecisionCaseId,
});
export type ListDecisionScoreSnapshotsInput = typeof ListDecisionScoreSnapshotsInput.Type;

export interface DecisionScoreSnapshotRepositoryShape {
  readonly insert: (
    row: DecisionScoreSnapshotRow,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly listByCaseId: (
    input: ListDecisionScoreSnapshotsInput,
  ) => Effect.Effect<ReadonlyArray<DecisionScoreSnapshotRow>, ProjectionRepositoryError>;
}

export class DecisionScoreSnapshotRepository extends ServiceMap.Service<
  DecisionScoreSnapshotRepository,
  DecisionScoreSnapshotRepositoryShape
>()("okcode/persistence/Services/DecisionScoreSnapshots/DecisionScoreSnapshotRepository") {}
