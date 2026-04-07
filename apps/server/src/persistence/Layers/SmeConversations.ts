import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  DeleteSmeConversationInput,
  GetSmeConversationInput,
  ListSmeConversationsByProjectInput,
  SmeConversationRepository,
  SmeConversationRow,
  type SmeConversationRepositoryShape,
} from "../Services/SmeConversations.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeSmeConversationRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: SmeConversationRow,
    execute: (row) =>
      sql`
        INSERT INTO sme_conversations (
          conversation_id, project_id, title, model,
          created_at, updated_at, deleted_at
        )
        VALUES (
          ${row.conversationId}, ${row.projectId}, ${row.title}, ${row.model},
          ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt}
        )
        ON CONFLICT (conversation_id)
        DO UPDATE SET
          title = excluded.title,
          model = excluded.model,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `,
  });

  const getRow = SqlSchema.findOneOption({
    Request: GetSmeConversationInput,
    Result: SmeConversationRow,
    execute: ({ conversationId }) =>
      sql`
        SELECT
          conversation_id AS "conversationId",
          project_id AS "projectId",
          title,
          model,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          deleted_at AS "deletedAt"
        FROM sme_conversations
        WHERE conversation_id = ${conversationId}
      `,
  });

  const listRows = SqlSchema.findAll({
    Request: ListSmeConversationsByProjectInput,
    Result: SmeConversationRow,
    execute: ({ projectId }) =>
      sql`
        SELECT
          conversation_id AS "conversationId",
          project_id AS "projectId",
          title,
          model,
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          deleted_at AS "deletedAt"
        FROM sme_conversations
        WHERE project_id = ${projectId} AND deleted_at IS NULL
        ORDER BY updated_at DESC
      `,
  });

  const deleteRow = SqlSchema.void({
    Request: DeleteSmeConversationInput,
    execute: ({ conversationId }) =>
      sql`
        UPDATE sme_conversations
        SET deleted_at = datetime('now')
        WHERE conversation_id = ${conversationId}
      `,
  });

  const upsert: SmeConversationRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "SmeConversationRepository.upsert:query",
          "SmeConversationRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: SmeConversationRepositoryShape["getById"] = (input) =>
    getRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "SmeConversationRepository.getById:query",
          "SmeConversationRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof SmeConversationRow>)),
        }),
      ),
    );

  const listByProjectId: SmeConversationRepositoryShape["listByProjectId"] = (input) =>
    listRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "SmeConversationRepository.listByProjectId:query",
          "SmeConversationRepository.listByProjectId:decodeRows",
        ),
      ),
      Effect.map((rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof SmeConversationRow>>),
    );

  const deleteById: SmeConversationRepositoryShape["deleteById"] = (input) =>
    deleteRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("SmeConversationRepository.deleteById:query")),
    );

  return { upsert, getById, listByProjectId, deleteById } satisfies SmeConversationRepositoryShape;
});

export const SmeConversationRepositoryLive = Layer.effect(
  SmeConversationRepository,
  makeSmeConversationRepository,
);
