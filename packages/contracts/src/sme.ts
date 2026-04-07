/**
 * SME Chat - Subject Matter Expert conversational chat contracts.
 *
 * Defines schemas, WS methods, and push events for the SME chat feature.
 * SME chat is a pure conversational interface (no coding tools) where each
 * project has its own knowledge base and chat conversations.
 *
 * @module sme
 */
import { Schema } from "effect";
import {
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  SmeConversationId,
  SmeDocumentId,
  SmeMessageId,
  TrimmedNonEmptyString,
} from "./baseSchemas";

// ── Constants ───────────────────────────────────────────────────────────

export const SME_MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const SME_MAX_DOCUMENTS_PER_PROJECT = 50;
export const SME_MAX_CONVERSATIONS_PER_PROJECT = 100;
export const SME_MAX_MESSAGE_INPUT_CHARS = 60_000;

// ── Schemas ─────────────────────────────────────────────────────────────

export const SmeMessageRole = Schema.Literals(["user", "assistant", "system"]);
export type SmeMessageRole = typeof SmeMessageRole.Type;

export const SmeKnowledgeDocument = Schema.Struct({
  documentId: SmeDocumentId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  fileName: TrimmedNonEmptyString,
  mimeType: Schema.String,
  sizeBytes: NonNegativeInt,
  contentHash: Schema.String,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type SmeKnowledgeDocument = typeof SmeKnowledgeDocument.Type;

export const SmeConversation = Schema.Struct({
  conversationId: SmeConversationId,
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: Schema.NullOr(IsoDateTime),
});
export type SmeConversation = typeof SmeConversation.Type;

export const SmeMessage = Schema.Struct({
  messageId: SmeMessageId,
  conversationId: SmeConversationId,
  role: SmeMessageRole,
  text: Schema.String,
  isStreaming: Schema.Boolean,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type SmeMessage = typeof SmeMessage.Type;

// ── Input Schemas ───────────────────────────────────────────────────────

export const SmeUploadDocumentInput = Schema.Struct({
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  fileName: TrimmedNonEmptyString,
  mimeType: Schema.String,
  /** Base64-encoded file content */
  contentBase64: Schema.String,
});
export type SmeUploadDocumentInput = typeof SmeUploadDocumentInput.Type;

export const SmeDeleteDocumentInput = Schema.Struct({
  documentId: SmeDocumentId,
});
export type SmeDeleteDocumentInput = typeof SmeDeleteDocumentInput.Type;

export const SmeListDocumentsInput = Schema.Struct({
  projectId: ProjectId,
});
export type SmeListDocumentsInput = typeof SmeListDocumentsInput.Type;

export const SmeCreateConversationInput = Schema.Struct({
  projectId: ProjectId,
  title: TrimmedNonEmptyString,
  model: TrimmedNonEmptyString,
});
export type SmeCreateConversationInput = typeof SmeCreateConversationInput.Type;

export const SmeDeleteConversationInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type SmeDeleteConversationInput = typeof SmeDeleteConversationInput.Type;

export const SmeListConversationsInput = Schema.Struct({
  projectId: ProjectId,
});
export type SmeListConversationsInput = typeof SmeListConversationsInput.Type;

export const SmeGetConversationInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type SmeGetConversationInput = typeof SmeGetConversationInput.Type;

export const SmeSendMessageInput = Schema.Struct({
  conversationId: SmeConversationId,
  text: TrimmedNonEmptyString,
});
export type SmeSendMessageInput = typeof SmeSendMessageInput.Type;

export const SmeInterruptMessageInput = Schema.Struct({
  conversationId: SmeConversationId,
});
export type SmeInterruptMessageInput = typeof SmeInterruptMessageInput.Type;

// ── WS Method Constants ─────────────────────────────────────────────────

export const SME_WS_METHODS = {
  uploadDocument: "sme.uploadDocument",
  deleteDocument: "sme.deleteDocument",
  listDocuments: "sme.listDocuments",
  createConversation: "sme.createConversation",
  deleteConversation: "sme.deleteConversation",
  listConversations: "sme.listConversations",
  getConversation: "sme.getConversation",
  sendMessage: "sme.sendMessage",
  interruptMessage: "sme.interruptMessage",
} as const;

// ── Push Event Channels ─────────────────────────────────────────────────

export const SME_WS_CHANNELS = {
  messageEvent: "sme.messageEvent",
} as const;

// ── Push Event Schemas ──────────────────────────────────────────────────

export const SmeMessageDeltaEvent = Schema.Struct({
  type: Schema.Literal("sme.message.delta"),
  conversationId: SmeConversationId,
  messageId: SmeMessageId,
  text: Schema.String,
});

export const SmeMessageCompleteEvent = Schema.Struct({
  type: Schema.Literal("sme.message.complete"),
  conversationId: SmeConversationId,
  messageId: SmeMessageId,
  text: Schema.String,
});

export const SmeMessageErrorEvent = Schema.Struct({
  type: Schema.Literal("sme.message.error"),
  conversationId: SmeConversationId,
  messageId: SmeMessageId,
  error: Schema.String,
});

export const SmeMessageEvent = Schema.Union([
  SmeMessageDeltaEvent,
  SmeMessageCompleteEvent,
  SmeMessageErrorEvent,
]);
export type SmeMessageEvent = typeof SmeMessageEvent.Type;
