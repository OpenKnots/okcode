/**
 * SmeMessageRepository - Repository interface for SME chat messages.
 *
 * Owns persistence operations for messages within SME conversations.
 *
 * @module SmeMessageRepository
 */
import { IsoDateTime, SmeConversationId, SmeMessageId } from "@okcode/contracts";
import { Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const SmeMessageRow = Schema.Struct({
  messageId: SmeMessageId,
  conversationId: SmeConversationId,
  role: Schema.String,
  text: Schema.String,
  isStreaming: Schema.Boolean,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type SmeMessageRow = typeof SmeMessageRow.Type;

export const ListSmeMessagesByConversationInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type ListSmeMessagesByConversationInput = typeof ListSmeMessagesByConversationInput.Type;

export const DeleteSmeMessagesByConversationInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type DeleteSmeMessagesByConversationInput = typeof DeleteSmeMessagesByConversationInput.Type;

export interface SmeMessageRepositoryShape {
  readonly upsert: (row: SmeMessageRow) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly listByConversationId: (
    input: ListSmeMessagesByConversationInput,
  ) => Effect.Effect<ReadonlyArray<SmeMessageRow>, ProjectionRepositoryError>;
  readonly deleteByConversationId: (
    input: DeleteSmeMessagesByConversationInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class SmeMessageRepository extends ServiceMap.Service<
  SmeMessageRepository,
  SmeMessageRepositoryShape
>()("okcode/persistence/Services/SmeMessages/SmeMessageRepository") {}
