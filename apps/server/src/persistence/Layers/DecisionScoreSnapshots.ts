import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";
import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";
import {
  DecisionScoreSnapshotRepository,
  DecisionScoreSnapshotRow,
  ListDecisionScoreSnapshotsInput,
  type DecisionScoreSnapshotRepositoryShape,
} from "../Services/DecisionScoreSnapshots.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeDecisionScoreSnapshotRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insertRow = SqlSchema.void({
    Request: DecisionScoreSnapshotRow,
    execute: (row) =>
      sql`
        INSERT INTO decision_score_snapshots (
          snapshot_id, case_id, score, analysis_json, created_at
        ) VALUES (
          ${row.snapshotId}, ${row.caseId}, ${row.score}, ${row.analysisJson}, ${row.createdAt}
        )
      `,
  });

  const listRows = SqlSchema.findAll({
    Request: ListDecisionScoreSnapshotsInput,
    Result: DecisionScoreSnapshotRow,
    execute: ({ caseId }) =>
      sql`
        SELECT
          snapshot_id AS "snapshotId",
          case_id AS "caseId",
          score,
          analysis_json AS "analysisJson",
          created_at AS "createdAt"
        FROM decision_score_snapshots
        WHERE case_id = ${caseId}
        ORDER BY created_at DESC
      `,
  });

  const insert: DecisionScoreSnapshotRepositoryShape["insert"] = (row) =>
    insertRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionScoreSnapshotRepository.insert:query",
          "DecisionScoreSnapshotRepository.insert:encodeRequest",
        ),
      ),
    );

  const listByCaseId: DecisionScoreSnapshotRepositoryShape["listByCaseId"] = (input) =>
    listRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionScoreSnapshotRepository.listByCaseId:query",
          "DecisionScoreSnapshotRepository.listByCaseId:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof DecisionScoreSnapshotRow>>),
    );

  return { insert, listByCaseId } satisfies DecisionScoreSnapshotRepositoryShape;
});

export const DecisionScoreSnapshotRepositoryLive = Layer.effect(
  DecisionScoreSnapshotRepository,
  makeDecisionScoreSnapshotRepository,
);
