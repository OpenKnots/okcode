/**
 * SmeChatService - Service interface for SME chat operations.
 *
 * Provides document management, conversation CRUD, and message sending
 * for the subject matter expert chat feature.
 *
 * @module SmeChatService
 */
import type {
  SmeConversation,
  SmeCreateConversationInput,
  SmeDeleteConversationInput,
  SmeDeleteDocumentInput,
  SmeGetConversationInput,
  SmeInterruptMessageInput,
  SmeKnowledgeDocument,
  SmeListConversationsInput,
  SmeListDocumentsInput,
  SmeMessage,
  SmeMessageEvent,
  SmeSendMessageInput,
  SmeUploadDocumentInput,
} from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export class SmeChatError extends Error {
  readonly _tag = "SmeChatError";
  constructor(
    readonly operation: string,
    readonly detail: string,
    override readonly cause?: unknown,
  ) {
    super(`SmeChatError in ${operation}: ${detail}`);
  }
}

export interface SmeChatServiceShape {
  readonly uploadDocument: (
    input: SmeUploadDocumentInput,
  ) => Effect.Effect<SmeKnowledgeDocument, SmeChatError>;

  readonly deleteDocument: (input: SmeDeleteDocumentInput) => Effect.Effect<void, SmeChatError>;

  readonly listDocuments: (
    input: SmeListDocumentsInput,
  ) => Effect.Effect<ReadonlyArray<SmeKnowledgeDocument>, SmeChatError>;

  readonly createConversation: (
    input: SmeCreateConversationInput,
  ) => Effect.Effect<SmeConversation, SmeChatError>;

  readonly deleteConversation: (
    input: SmeDeleteConversationInput,
  ) => Effect.Effect<void, SmeChatError>;

  readonly listConversations: (
    input: SmeListConversationsInput,
  ) => Effect.Effect<ReadonlyArray<SmeConversation>, SmeChatError>;

  readonly getConversation: (
    input: SmeGetConversationInput,
  ) => Effect.Effect<
    { conversation: SmeConversation; messages: ReadonlyArray<SmeMessage> } | null,
    SmeChatError
  >;

  readonly sendMessage: (
    input: SmeSendMessageInput,
    onEvent?: (event: SmeMessageEvent) => void,
  ) => Effect.Effect<void, SmeChatError>;

  readonly interruptMessage: (input: SmeInterruptMessageInput) => Effect.Effect<void, SmeChatError>;
}

export class SmeChatService extends ServiceMap.Service<SmeChatService, SmeChatServiceShape>()(
  "okcode/sme/Services/SmeChatService",
) {}
