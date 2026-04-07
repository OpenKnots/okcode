import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  DeleteSmeMessagesByConversationInput,
  ListSmeMessagesByConversationInput,
  SmeMessageRepository,
  SmeMessageRow,
  type SmeMessageRepositoryShape,
} from "../Services/SmeMessages.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

/**
 * DB row schema: isStreaming stored as INTEGER 0/1, mapped to/from boolean.
 */
const SmeMessageDbRow = Schema.Struct({
  messageId: SmeMessageRow.fields.messageId,
  conversationId: SmeMessageRow.fields.conversationId,
  role: SmeMessageRow.fields.role,
  text: SmeMessageRow.fields.text,
  isStreaming: Schema.Number,
  createdAt: SmeMessageRow.fields.createdAt,
  updatedAt: SmeMessageRow.fields.updatedAt,
});

const makeSmeMessageRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsert: SmeMessageRepositoryShape["upsert"] = (row) =>
    Effect.gen(function* () {
      const isStreamingInt = row.isStreaming ? 1 : 0;
      yield* sql`
        INSERT INTO sme_messages (
          message_id, conversation_id, role, text,
          is_streaming, created_at, updated_at
        )
        VALUES (
          ${row.messageId}, ${row.conversationId}, ${row.role}, ${row.text},
          ${isStreamingInt}, ${row.createdAt}, ${row.updatedAt}
        )
        ON CONFLICT (message_id)
        DO UPDATE SET
          text = excluded.text,
          is_streaming = excluded.is_streaming,
          updated_at = excluded.updated_at
      `;
    }).pipe(Effect.mapError(toPersistenceSqlError("SmeMessageRepository.upsert:query")));

  const listByConversationId: SmeMessageRepositoryShape["listByConversationId"] = (input) =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT
          message_id AS "messageId",
          conversation_id AS "conversationId",
          role,
          text,
          is_streaming AS "isStreaming",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM sme_messages
        WHERE conversation_id = ${input.conversationId}
        ORDER BY created_at ASC
      `;
      return rows.map((r: any) => ({
        messageId: r.messageId,
        conversationId: r.conversationId,
        role: r.role,
        text: r.text,
        isStreaming: r.isStreaming !== 0,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })) as any;
    }).pipe(
      Effect.mapError(toPersistenceSqlError("SmeMessageRepository.listByConversationId:query")),
    );

  const deleteByConversationId: SmeMessageRepositoryShape["deleteByConversationId"] = (input) =>
    Effect.gen(function* () {
      yield* sql`
        DELETE FROM sme_messages
        WHERE conversation_id = ${input.conversationId}
      `;
    }).pipe(
      Effect.mapError(toPersistenceSqlError("SmeMessageRepository.deleteByConversationId:query")),
    );

  return {
    upsert,
    listByConversationId,
    deleteByConversationId,
  } satisfies SmeMessageRepositoryShape;
});

export const SmeMessageRepositoryLive = Layer.effect(
  SmeMessageRepository,
  makeSmeMessageRepository,
);
