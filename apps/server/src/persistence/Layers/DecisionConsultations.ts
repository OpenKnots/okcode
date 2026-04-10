import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";
import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";
import {
  DecisionConsultationRepository,
  DecisionConsultationRow,
  GetDecisionConsultationInput,
  ListDecisionConsultationsInput,
  type DecisionConsultationRepositoryShape,
} from "../Services/DecisionConsultations.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeDecisionConsultationRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: DecisionConsultationRow,
    execute: (row) =>
      sql`
        INSERT INTO decision_consultations (
          consultation_id, case_id, target, status, reason, questions_json, response_summary,
          linked_thread_id, created_at, updated_at, resolved_at
        ) VALUES (
          ${row.consultationId}, ${row.caseId}, ${row.target}, ${row.status}, ${row.reason},
          ${row.questionsJson}, ${row.responseSummary}, ${row.linkedThreadId}, ${row.createdAt},
          ${row.updatedAt}, ${row.resolvedAt}
        )
        ON CONFLICT (consultation_id)
        DO UPDATE SET
          case_id = excluded.case_id,
          target = excluded.target,
          status = excluded.status,
          reason = excluded.reason,
          questions_json = excluded.questions_json,
          response_summary = excluded.response_summary,
          linked_thread_id = excluded.linked_thread_id,
          updated_at = excluded.updated_at,
          resolved_at = excluded.resolved_at
      `,
  });

  const getRow = SqlSchema.findOneOption({
    Request: GetDecisionConsultationInput,
    Result: DecisionConsultationRow,
    execute: ({ consultationId }) =>
      sql`
        SELECT
          consultation_id AS "consultationId",
          case_id AS "caseId",
          target,
          status,
          reason,
          questions_json AS "questionsJson",
          response_summary AS "responseSummary",
          linked_thread_id AS "linkedThreadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          resolved_at AS "resolvedAt"
        FROM decision_consultations
        WHERE consultation_id = ${consultationId}
      `,
  });

  const listRows = SqlSchema.findAll({
    Request: ListDecisionConsultationsInput,
    Result: DecisionConsultationRow,
    execute: ({ caseId }) =>
      sql`
        SELECT
          consultation_id AS "consultationId",
          case_id AS "caseId",
          target,
          status,
          reason,
          questions_json AS "questionsJson",
          response_summary AS "responseSummary",
          linked_thread_id AS "linkedThreadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          resolved_at AS "resolvedAt"
        FROM decision_consultations
        WHERE case_id = ${caseId}
        ORDER BY created_at DESC
      `,
  });

  const upsert: DecisionConsultationRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionConsultationRepository.upsert:query",
          "DecisionConsultationRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: DecisionConsultationRepositoryShape["getById"] = (input) =>
    getRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionConsultationRepository.getById:query",
          "DecisionConsultationRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof DecisionConsultationRow>)),
        }),
      ),
    );

  const listByCaseId: DecisionConsultationRepositoryShape["listByCaseId"] = (input) =>
    listRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "DecisionConsultationRepository.listByCaseId:query",
          "DecisionConsultationRepository.listByCaseId:decodeRows",
        ),
      ),
      Effect.map((rows) =>
        rows as ReadonlyArray<Schema.Schema.Type<typeof DecisionConsultationRow>>,
      ),
    );

  return { upsert, getById, listByCaseId } satisfies DecisionConsultationRepositoryShape;
});

export const DecisionConsultationRepositoryLive = Layer.effect(
  DecisionConsultationRepository,
  makeDecisionConsultationRepository,
);
