import * as SqlClient from "effect/unstable/sql/SqlClient";
import { Effect, Layer } from "effect";
import { toPersistenceSqlError } from "../Errors.ts";

import {
  SmeMessageRepository,
  type SmeMessageRepositoryShape,
  type SmeMessageRow,
} from "../Services/SmeMessages.ts";

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
    sql`
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
    `.pipe(
      Effect.map((rows) =>
        (
          rows as ReadonlyArray<{
            messageId: string;
            conversationId: string;
            role: string;
            text: string;
            isStreaming: number;
            createdAt: string;
            updatedAt: string;
          }>
        ).map(
          (r) =>
            ({
              messageId: r.messageId as SmeMessageRow["messageId"],
              conversationId: r.conversationId as SmeMessageRow["conversationId"],
              role: r.role,
              text: r.text,
              isStreaming: r.isStreaming !== 0,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
            }) as SmeMessageRow,
        ),
      ),
      Effect.mapError(toPersistenceSqlError("SmeMessageRepository.listByConversationId:query")),
    );

  const deleteByConversationId: SmeMessageRepositoryShape["deleteByConversationId"] = (input) =>
    sql`
      DELETE FROM sme_messages
      WHERE conversation_id = ${input.conversationId}
    `.pipe(
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
