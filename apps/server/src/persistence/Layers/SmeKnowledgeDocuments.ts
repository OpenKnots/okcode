import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";
import { Effect, Layer, Option, Schema } from "effect";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";

import {
  DeleteSmeDocumentInput,
  GetSmeDocumentInput,
  ListSmeDocumentsByProjectInput,
  SmeKnowledgeDocumentRepository,
  SmeKnowledgeDocumentRow,
  type SmeKnowledgeDocumentRepositoryShape,
} from "../Services/SmeKnowledgeDocuments.ts";

function toPersistenceSqlOrDecodeError(sqlOperation: string, decodeOperation: string) {
  return (cause: unknown) =>
    Schema.isSchemaError(cause)
      ? toPersistenceDecodeError(decodeOperation)(cause)
      : toPersistenceSqlError(sqlOperation)(cause);
}

const makeSmeKnowledgeDocumentRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: SmeKnowledgeDocumentRow,
    execute: (row) =>
      sql`
        INSERT INTO sme_knowledge_documents (
          document_id, project_id, title, file_name, mime_type,
          size_bytes, content_text, content_hash, created_at, updated_at, deleted_at
        )
        VALUES (
          ${row.documentId}, ${row.projectId}, ${row.title}, ${row.fileName}, ${row.mimeType},
          ${row.sizeBytes}, ${row.contentText}, ${row.contentHash}, ${row.createdAt}, ${row.updatedAt}, ${row.deletedAt}
        )
        ON CONFLICT (document_id)
        DO UPDATE SET
          title = excluded.title,
          file_name = excluded.file_name,
          mime_type = excluded.mime_type,
          size_bytes = excluded.size_bytes,
          content_text = excluded.content_text,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `,
  });

  const getRow = SqlSchema.findOneOption({
    Request: GetSmeDocumentInput,
    Result: SmeKnowledgeDocumentRow,
    execute: ({ documentId }) =>
      sql`
        SELECT
          document_id AS "documentId",
          project_id AS "projectId",
          title,
          file_name AS "fileName",
          mime_type AS "mimeType",
          size_bytes AS "sizeBytes",
          content_text AS "contentText",
          content_hash AS "contentHash",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          deleted_at AS "deletedAt"
        FROM sme_knowledge_documents
        WHERE document_id = ${documentId}
      `,
  });

  const listRows = SqlSchema.findAll({
    Request: ListSmeDocumentsByProjectInput,
    Result: SmeKnowledgeDocumentRow,
    execute: ({ projectId }) =>
      sql`
        SELECT
          document_id AS "documentId",
          project_id AS "projectId",
          title,
          file_name AS "fileName",
          mime_type AS "mimeType",
          size_bytes AS "sizeBytes",
          content_text AS "contentText",
          content_hash AS "contentHash",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          deleted_at AS "deletedAt"
        FROM sme_knowledge_documents
        WHERE project_id = ${projectId} AND deleted_at IS NULL
        ORDER BY created_at ASC
      `,
  });

  const deleteRow = SqlSchema.void({
    Request: DeleteSmeDocumentInput,
    execute: ({ documentId }) =>
      sql`
        UPDATE sme_knowledge_documents
        SET deleted_at = datetime('now')
        WHERE document_id = ${documentId}
      `,
  });

  const upsert: SmeKnowledgeDocumentRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "SmeKnowledgeDocumentRepository.upsert:query",
          "SmeKnowledgeDocumentRepository.upsert:encodeRequest",
        ),
      ),
    );

  const getById: SmeKnowledgeDocumentRepositoryShape["getById"] = (input) =>
    getRow(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "SmeKnowledgeDocumentRepository.getById:query",
          "SmeKnowledgeDocumentRepository.getById:decodeRow",
        ),
      ),
      Effect.flatMap((rowOption) =>
        Option.match(rowOption, {
          onNone: () => Effect.succeed(Option.none()),
          onSome: (row) =>
            Effect.succeed(Option.some(row as Schema.Schema.Type<typeof SmeKnowledgeDocumentRow>)),
        }),
      ),
    );

  const listByProjectId: SmeKnowledgeDocumentRepositoryShape["listByProjectId"] = (input) =>
    listRows(input).pipe(
      Effect.mapError(
        toPersistenceSqlOrDecodeError(
          "SmeKnowledgeDocumentRepository.listByProjectId:query",
          "SmeKnowledgeDocumentRepository.listByProjectId:decodeRows",
        ),
      ),
      Effect.map(
        (rows) => rows as ReadonlyArray<Schema.Schema.Type<typeof SmeKnowledgeDocumentRow>>,
      ),
    );

  const deleteById: SmeKnowledgeDocumentRepositoryShape["deleteById"] = (input) =>
    deleteRow(input).pipe(
      Effect.mapError(toPersistenceSqlError("SmeKnowledgeDocumentRepository.deleteById:query")),
    );

  return {
    upsert,
    getById,
    listByProjectId,
    deleteById,
  } satisfies SmeKnowledgeDocumentRepositoryShape;
});

export const SmeKnowledgeDocumentRepositoryLive = Layer.effect(
  SmeKnowledgeDocumentRepository,
  makeSmeKnowledgeDocumentRepository,
);
