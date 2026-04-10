/**
 * SmeConversationRepository - Repository interface for SME conversations.
 *
 * Owns persistence operations for SME chat conversations scoped to a project.
 *
 * @module SmeConversationRepository
 */
import {
  IsoDateTime,
  ProjectId,
  ProviderKind,
  SmeAuthMethod,
  SmeConversationId,
} from "@okcode/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const SmeConversationRow = Schema.Struct({
  conversationId: SmeConversationId,
  projectId: ProjectId,
  title: Schema.String,
  provider: ProviderKind,
  authMethod: SmeAuthMethod,
  model: Schema.String,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type SmeConversationRow = typeof SmeConversationRow.Type;

export const GetSmeConversationInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type GetSmeConversationInput = typeof GetSmeConversationInput.Type;

export const ListSmeConversationsByProjectInput = Schema.Struct({
  projectId: ProjectId,
});
export type ListSmeConversationsByProjectInput = typeof ListSmeConversationsByProjectInput.Type;

export const DeleteSmeConversationInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type DeleteSmeConversationInput = typeof DeleteSmeConversationInput.Type;

export interface SmeConversationRepositoryShape {
  readonly upsert: (row: SmeConversationRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly getById: (
    input: GetSmeConversationInput,
  ) => Effect.Effect<Option.Option<SmeConversationRow>, ProjectionRepositoryError>;
  readonly listByProjectId: (
    input: ListSmeConversationsByProjectInput,
  ) => Effect.Effect<ReadonlyArray<SmeConversationRow>, ProjectionRepositoryError>;
  readonly deleteById: (
    input: DeleteSmeConversationInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class SmeConversationRepository extends ServiceMap.Service<
  SmeConversationRepository,
  SmeConversationRepositoryShape
>()("okcode/persistence/Services/SmeConversations/SmeConversationRepository") {}
