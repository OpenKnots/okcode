import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer } from "effect";

import { toPersistenceSqlError } from "../Errors.ts";
import {
  DeleteProjectionPendingUserInputInput,
  GetProjectionPendingUserInputInput,
  ListProjectionPendingUserInputsInput,
  ProjectionPendingUserInput,
  ProjectionPendingUserInputRepository,
  type ProjectionPendingUserInputRepositoryShape,
} from "../Services/ProjectionPendingUserInputs.ts";

const makeProjectionPendingUserInputRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertProjectionPendingUserInputRow = SqlSchema.void({
    Request: ProjectionPendingUserInput,
    execute: (row) =>
      sql`
        INSERT INTO projection_pending_user_inputs (
          request_id,
          thread_id,
          turn_id,
          status,
          created_at,
          resolved_at
        )
        VALUES (
          ${row.requestId},
          ${row.threadId},
          ${row.turnId},
          ${row.status},
          ${row.createdAt},
          ${row.resolvedAt}
        )
        ON CONFLICT (request_id)
        DO UPDATE SET
          thread_id = excluded.thread_id,
          turn_id = excluded.turn_id,
          status = excluded.status,
          created_at = excluded.created_at,
          resolved_at = excluded.resolved_at
      `,
  });

  const listProjectionPendingUserInputRows = SqlSchema.findAll({
    Request: ListProjectionPendingUserInputsInput,
    Result: ProjectionPendingUserInput,
    execute: ({ threadId }) =>
      sql`
        SELECT
          request_id AS "requestId",
          thread_id AS "threadId",
          turn_id AS "turnId",
          status,
          created_at AS "createdAt",
          resolved_at AS "resolvedAt"
        FROM projection_pending_user_inputs
        WHERE thread_id = ${threadId}
        ORDER BY created_at ASC, request_id ASC
      `,
  });

  const getProjectionPendingUserInputRow = SqlSchema.findOneOption({
    Request: GetProjectionPendingUserInputInput,
    Result: ProjectionPendingUserInput,
    execute: ({ requestId }) =>
      sql`
        SELECT
          request_id AS "requestId",
          thread_id AS "threadId",
          turn_id AS "turnId",
          status,
          created_at AS "createdAt",
          resolved_at AS "resolvedAt"
        FROM projection_pending_user_inputs
        WHERE request_id = ${requestId}
      `,
  });

  const deleteProjectionPendingUserInputRow = SqlSchema.void({
    Request: DeleteProjectionPendingUserInputInput,
    execute: ({ requestId }) =>
      sql`
        DELETE FROM projection_pending_user_inputs
        WHERE request_id = ${requestId}
      `,
  });

  const upsert: ProjectionPendingUserInputRepositoryShape["upsert"] = (row) =>
    upsertProjectionPendingUserInputRow(row).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionPendingUserInputRepository.upsert:query")),
    );

  const listByThreadId: ProjectionPendingUserInputRepositoryShape["listByThreadId"] = (input) =>
    listProjectionPendingUserInputRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionPendingUserInputRepository.listByThreadId:query"),
      ),
    );

  const getByRequestId: ProjectionPendingUserInputRepositoryShape["getByRequestId"] = (input) =>
    getProjectionPendingUserInputRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionPendingUserInputRepository.getByRequestId:query"),
      ),
    );

  const deleteByRequestId: ProjectionPendingUserInputRepositoryShape["deleteByRequestId"] = (
    input,
  ) =>
    deleteProjectionPendingUserInputRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlError("ProjectionPendingUserInputRepository.deleteByRequestId:query"),
      ),
    );

  return {
    upsert,
    listByThreadId,
    getByRequestId,
    deleteByRequestId,
  } satisfies ProjectionPendingUserInputRepositoryShape;
});

export const ProjectionPendingUserInputRepositoryLive = Layer.effect(
  ProjectionPendingUserInputRepository,
  makeProjectionPendingUserInputRepository,
);
