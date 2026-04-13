import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";
import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";
import {
  DecisionCaseRepository,
  DecisionCaseRow,
  GetDecisionCaseInput,
  ListDecisionCasesInput,
  type DecisionCaseRepositoryShape,
} from "../Services/DecisionCases.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeDecisionCaseRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: DecisionCaseRow,
    execute: (row) =>
      sql`
        INSERT INTO decision_cases (
          case_id, project_id, cwd, source_kind, source_id, title, conflict_kind,
          linked_thread_id, created_at, updated_at
        ) VALUES (
          ${row.caseId}, ${row.projectId}, ${row.cwd}, ${row.sourceKind}, ${row.sourceId}, ${row.title},
          ${row.conflictKind}, ${row.linkedThreadId}, ${row.createdAt}, ${row.updatedAt}
        )
        ON CONFLICT (case_id)
        DO UPDATE SET
          project_id = excluded.project_id,
          cwd = excluded.cwd,
          source_kind = excluded.source_kind,
          source_id = excluded.source_id,
          title = excluded.title,
          conflict_kind = excluded.conflict_kind,
          linked_thread_id = excluded.linked_thread_id,
          updated_at = excluded.updated_at
      `,
  });

  const getRow = SqlSchema.findOneOption({
    Request: GetDecisionCaseInput,
    Result: DecisionCaseRow,
    execute: ({ caseId }) =>
      sql`
        SELECT
          case_id AS "caseId",
          project_id AS "projectId",
          cwd,
          source_kind AS "sourceKind",
          source_id AS "sourceId",
          title,
          conflict_kind AS "conflictKind",
          linked_thread_id AS "linkedThreadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM decision_cases
        WHERE case_id = ${caseId}
      `,
  });

  const listRows = SqlSchema.findAll({
    Request: ListDecisionCasesInput,
    Result: DecisionCaseRow,
    execute: ({ cwd }) =>
      sql`
        SELECT
          case_id AS "caseId",
          project_id AS "projectId",
          cwd,
          source_kind AS "sourceKind",
          source_id AS "sourceId",
          title,
          conflict_kind AS "conflictKind",
          linked_thread_id AS "linkedThreadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM decision_cases
        WHERE cwd = ${cwd}
        ORDER BY updated_at DESC
      `,
  });

  const upsert: DecisionCaseRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionCaseRepository.upsert:query",
          "DecisionCaseRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: DecisionCaseRepositoryShape["getById"] = (input) =>
    getRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionCaseRepository.getById:query",
          "DecisionCaseRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof DecisionCaseRow>)),
        }),
      ),
    );

  const listByCwd: DecisionCaseRepositoryShape["listByCwd"] = (input) =>
    listRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionCaseRepository.listByCwd:query",
          "DecisionCaseRepository.listByCwd:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof DecisionCaseRow>>),
    );

  return { upsert, getById, listByCwd } satisfies DecisionCaseRepositoryShape;
});

export const DecisionCaseRepositoryLive = Layer.effect(
  DecisionCaseRepository,
  makeDecisionCaseRepository,
);
