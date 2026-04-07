/**
 * SmeKnowledgeDocumentRepository - Repository interface for SME knowledge documents.
 *
 * Owns persistence operations for documents uploaded to a project's knowledge base.
 *
 * @module SmeKnowledgeDocumentRepository
 */
import { IsoDateTime, ProjectId, SmeDocumentId } from "@okcode/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const SmeKnowledgeDocumentRow = Schema.Struct({
  documentId: SmeDocumentId,
  projectId: ProjectId,
  title: Schema.String,
  fileName: Schema.String,
  mimeType: Schema.String,
  sizeBytes: Schema.Number,
  contentText: Schema.String,
  contentHash: Schema.String,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type SmeKnowledgeDocumentRow = typeof SmeKnowledgeDocumentRow.Type;

export const GetSmeDocumentInput = Schema.Struct({
  documentId: SmeDocumentId,
});
export type GetSmeDocumentInput = typeof GetSmeDocumentInput.Type;

export const ListSmeDocumentsByProjectInput = Schema.Struct({
  projectId: ProjectId,
});
export type ListSmeDocumentsByProjectInput = typeof ListSmeDocumentsByProjectInput.Type;

export const DeleteSmeDocumentInput = Schema.Struct({
  documentId: SmeDocumentId,
});
export type DeleteSmeDocumentInput = typeof DeleteSmeDocumentInput.Type;

export interface SmeKnowledgeDocumentRepositoryShape {
  readonly upsert: (row: SmeKnowledgeDocumentRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetSmeDocumentInput,
  ) => Effect.Effect<Option.Option<SmeKnowledgeDocumentRow>, ProjectionRepositoryError>;
  readonly listByProjectId: (
    input: ListSmeDocumentsByProjectInput,
  ) => Effect.Effect<ReadonlyArray<SmeKnowledgeDocumentRow>, ProjectionRepositoryError>;
  readonly deleteById: (
    input: DeleteSmeDocumentInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class SmeKnowledgeDocumentRepository extends ServiceMap.Service<
  SmeKnowledgeDocumentRepository,
  SmeKnowledgeDocumentRepositoryShape
>()("okcode/persistence/Services/SmeKnowledgeDocuments/SmeKnowledgeDocumentRepository") {}
