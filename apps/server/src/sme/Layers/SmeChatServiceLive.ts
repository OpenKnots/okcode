/**
 * SmeChatServiceLive - Live implementation for the SME chat service.
 *
 * Implements document management, conversation CRUD, and message sending
 * using the Anthropic Messages API for streaming completions.
 *
 * @module SmeChatServiceLive
 */
import Anthropic from "@anthropic-ai/sdk";
import type { SmeConversation, SmeKnowledgeDocument, SmeMessage } from "@okcode/contracts";
import {
  SME_MAX_DOCUMENT_SIZE_BYTES,
  SME_MAX_DOCUMENTS_PER_PROJECT,
  SME_MAX_CONVERSATIONS_PER_PROJECT,
} from "@okcode/contracts";
import { DateTime, Effect, Layer, Option, Random, Ref } from "effect";
import crypto from "node:crypto";

import { SmeKnowledgeDocumentRepository } from "../../persistence/Services/SmeKnowledgeDocuments.ts";
import { SmeConversationRepository } from "../../persistence/Services/SmeConversations.ts";
import { SmeMessageRepository } from "../../persistence/Services/SmeMessages.ts";
import {
  SmeChatError,
  SmeChatService,
  type SmeChatServiceShape,
} from "../Services/SmeChatService.ts";

const makeSmeChatService = Effect.gen(function* () {
  const documentRepo = yield* SmeKnowledgeDocumentRepository;
  const conversationRepo = yield* SmeConversationRepository;
  const messageRepo = yield* SmeMessageRepository;

  // Track active streaming fibers per conversation for interruption
  const activeStreams = yield* Ref.make(new Map<string, AbortController>());

  const generateId = () =>
    Effect.map(
      Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER),
      (n) => `${Date.now().toString(36)}-${n.toString(36)}`,
    );

  const now = () => Effect.map(DateTime.now, (dt) => DateTime.formatIso(dt));

  // ── Document Operations ─────────────────────────────────────────────

  const uploadDocument: SmeChatServiceShape["uploadDocument"] = (input) =>
    Effect.gen(function* () {
      // Check document count limit
      const existing = yield* documentRepo
        .listByProjectId({ projectId: input.projectId })
        .pipe(Effect.mapError((e) => new SmeChatError("uploadDocument", e.message)));
      if (existing.length >= SME_MAX_DOCUMENTS_PER_PROJECT) {
        return yield* Effect.fail(
          new SmeChatError(
            "uploadDocument",
            `Maximum ${SME_MAX_DOCUMENTS_PER_PROJECT} documents per project exceeded`,
          ),
        );
      }

      // Decode base64 content
      const contentBuffer = Buffer.from(input.contentBase64, "base64");
      if (contentBuffer.byteLength > SME_MAX_DOCUMENT_SIZE_BYTES) {
        return yield* Effect.fail(
          new SmeChatError(
            "uploadDocument",
            `Document exceeds maximum size of ${SME_MAX_DOCUMENT_SIZE_BYTES} bytes`,
          ),
        );
      }

      const contentText = contentBuffer.toString("utf-8");
      const contentHash = crypto.createHash("sha256").update(contentText).digest("hex");

      const documentId = yield* generateId();
      const timestamp = yield* now();

      const row = {
        documentId,
        projectId: input.projectId,
        title: input.title,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: contentBuffer.byteLength,
        contentText,
        contentHash,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };

      yield* documentRepo
        .upsert(row as any)
        .pipe(Effect.mapError((e) => new SmeChatError("uploadDocument", e.message)));

      return {
        documentId,
        projectId: input.projectId,
        title: input.title,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: contentBuffer.byteLength,
        contentHash,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      } as SmeKnowledgeDocument;
    });

  const deleteDocument: SmeChatServiceShape["deleteDocument"] = (input) =>
    documentRepo
      .deleteById({ documentId: input.documentId })
      .pipe(Effect.mapError((e) => new SmeChatError("deleteDocument", e.message)));

  const listDocuments: SmeChatServiceShape["listDocuments"] = (input) =>
    documentRepo.listByProjectId({ projectId: input.projectId }).pipe(
      Effect.mapError((e) => new SmeChatError("listDocuments", e.message)),
      Effect.map((rows) =>
        rows.map(
          (r) =>
            ({
              documentId: r.documentId,
              projectId: r.projectId,
              title: r.title,
              fileName: r.fileName,
              mimeType: r.mimeType,
              sizeBytes: r.sizeBytes,
              contentHash: r.contentHash,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
              deletedAt: r.deletedAt,
            }) as SmeKnowledgeDocument,
        ),
      ),
    );

  // ── Conversation Operations ───────────────────────────────────────

  const createConversation: SmeChatServiceShape["createConversation"] = (input) =>
    Effect.gen(function* () {
      const existing = yield* conversationRepo
        .listByProjectId({ projectId: input.projectId })
        .pipe(Effect.mapError((e) => new SmeChatError("createConversation", e.message)));
      if (existing.length >= SME_MAX_CONVERSATIONS_PER_PROJECT) {
        return yield* Effect.fail(
          new SmeChatError(
            "createConversation",
            `Maximum ${SME_MAX_CONVERSATIONS_PER_PROJECT} conversations per project exceeded`,
          ),
        );
      }

      const conversationId = yield* generateId();
      const timestamp = yield* now();

      const row = {
        conversationId,
        projectId: input.projectId,
        title: input.title,
        model: input.model,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };

      yield* conversationRepo
        .upsert(row as any)
        .pipe(Effect.mapError((e) => new SmeChatError("createConversation", e.message)));

      return row as SmeConversation;
    });

  const deleteConversation: SmeChatServiceShape["deleteConversation"] = (input) =>
    Effect.gen(function* () {
      yield* messageRepo
        .deleteByConversationId({ conversationId: input.conversationId })
        .pipe(Effect.mapError((e) => new SmeChatError("deleteConversation", e.message)));
      yield* conversationRepo
        .deleteById({ conversationId: input.conversationId })
        .pipe(Effect.mapError((e) => new SmeChatError("deleteConversation", e.message)));
    });

  const listConversations: SmeChatServiceShape["listConversations"] = (input) =>
    conversationRepo.listByProjectId({ projectId: input.projectId }).pipe(
      Effect.mapError((e) => new SmeChatError("listConversations", e.message)),
      Effect.map((rows) =>
        rows.map(
          (r) =>
            ({
              conversationId: r.conversationId,
              projectId: r.projectId,
              title: r.title,
              model: r.model,
              createdAt: r.createdAt,
              updatedAt: r.updatedAt,
              deletedAt: r.deletedAt,
            }) as SmeConversation,
        ),
      ),
    );

  const getConversation: SmeChatServiceShape["getConversation"] = (input) =>
    Effect.gen(function* () {
      const optConv = yield* conversationRepo
        .getById({ conversationId: input.conversationId })
        .pipe(Effect.mapError((e) => new SmeChatError("getConversation", e.message)));

      if (Option.isNone(optConv)) return null;
      const conv = optConv.value;

      const messages = yield* messageRepo
        .listByConversationId({ conversationId: input.conversationId })
        .pipe(Effect.mapError((e) => new SmeChatError("getConversation", e.message)));

      return {
        conversation: {
          conversationId: conv.conversationId,
          projectId: conv.projectId,
          title: conv.title,
          model: conv.model,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          deletedAt: conv.deletedAt,
        } as SmeConversation,
        messages: messages.map(
          (m) =>
            ({
              messageId: m.messageId,
              conversationId: m.conversationId,
              role: m.role,
              text: m.text,
              isStreaming: m.isStreaming,
              createdAt: m.createdAt,
              updatedAt: m.updatedAt,
            }) as SmeMessage,
        ),
      };
    });

  // ── Message Sending ───────────────────────────────────────────────

  const sendMessage: SmeChatServiceShape["sendMessage"] = (input, onEvent) =>
    Effect.gen(function* () {
      // 1. Resolve conversation
      const optConv = yield* conversationRepo
        .getById({ conversationId: input.conversationId })
        .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));
      if (Option.isNone(optConv)) {
        return yield* Effect.fail(new SmeChatError("sendMessage", "Conversation not found"));
      }
      const conv = optConv.value;

      // 2. Load knowledge documents
      const docs = yield* documentRepo
        .listByProjectId({ projectId: conv.projectId })
        .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));

      // 3. Load conversation history
      const existingMessages = yield* messageRepo
        .listByConversationId({ conversationId: input.conversationId })
        .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));

      // 4. Persist user message
      const userMessageId = yield* generateId();
      const timestamp = yield* now();
      yield* messageRepo
        .upsert({
          messageId: userMessageId,
          conversationId: input.conversationId,
          role: "user",
          text: input.text,
          isStreaming: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as any)
        .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));

      // 5. Create assistant message placeholder
      const assistantMessageId = yield* generateId();
      yield* messageRepo
        .upsert({
          messageId: assistantMessageId,
          conversationId: input.conversationId,
          role: "assistant",
          text: "",
          isStreaming: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        } as any)
        .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));

      // 6. Build messages array for the API
      const systemPrompt = buildSystemPrompt(docs);
      const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const msg of existingMessages) {
        if (msg.role === "user" || msg.role === "assistant") {
          apiMessages.push({ role: msg.role as "user" | "assistant", content: msg.text });
        }
      }
      apiMessages.push({ role: "user", content: input.text });

      // 7. Stream completion via Anthropic Messages API
      const abortController = new AbortController();
      yield* Ref.update(activeStreams, (map) => {
        const newMap = new Map(map);
        newMap.set(input.conversationId, abortController);
        return newMap;
      });

      const fullText = yield* Effect.tryPromise({
        try: async () => {
          const anthropic = new Anthropic();
          let result = "";
          const stream = anthropic.messages.stream(
            {
              model: conv.model,
              max_tokens: 8192,
              system: systemPrompt,
              messages: apiMessages,
            },
            { signal: abortController.signal },
          );

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              result += event.delta.text;
              onEvent?.({
                type: "sme.message.delta",
                conversationId: input.conversationId,
                messageId: assistantMessageId,
                text: event.delta.text,
              } as any);
            }
          }
          return result;
        },
        catch: (err) => new SmeChatError("sendMessage:stream", String(err), err),
      }).pipe(
        Effect.ensuring(
          Ref.update(activeStreams, (map) => {
            const newMap = new Map(map);
            newMap.delete(input.conversationId);
            return newMap;
          }),
        ),
      );

      // 8. Finalize assistant message
      const finalTimestamp = yield* now();
      yield* messageRepo
        .upsert({
          messageId: assistantMessageId,
          conversationId: input.conversationId,
          role: "assistant",
          text: fullText,
          isStreaming: false,
          createdAt: timestamp,
          updatedAt: finalTimestamp,
        } as any)
        .pipe(Effect.mapError((e) => new SmeChatError("sendMessage:finalize", e.message)));

      // 9. Emit completion event
      onEvent?.({
        type: "sme.message.complete",
        conversationId: input.conversationId,
        messageId: assistantMessageId,
        text: fullText,
      } as any);
    });

  const interruptMessage: SmeChatServiceShape["interruptMessage"] = (input) =>
    Effect.gen(function* () {
      const streams = yield* Ref.get(activeStreams);
      const controller = streams.get(input.conversationId);
      if (controller) {
        controller.abort();
      }
    });

  return {
    uploadDocument,
    deleteDocument,
    listDocuments,
    createConversation,
    deleteConversation,
    listConversations,
    getConversation,
    sendMessage,
    interruptMessage,
  } satisfies SmeChatServiceShape;
});

// ── Helpers ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  docs: ReadonlyArray<{ title: string; fileName: string; contentText: string }>,
): string {
  const parts = [
    "You are a knowledgeable subject matter expert assistant. Your role is to provide clear, accurate, and helpful answers based on the reference documents provided and your general knowledge.",
    "Focus on explanation, analysis, and guidance. Be conversational and thorough.",
  ];

  if (docs.length > 0) {
    parts.push(
      "\nThe following reference documents have been provided for this project. Use them to inform your answers when relevant:\n",
    );
    for (const doc of docs) {
      parts.push(`<document title="${doc.title}" filename="${doc.fileName}">`);
      parts.push(doc.contentText);
      parts.push("</document>\n");
    }
  }

  return parts.join("\n");
}

export const SmeChatServiceLive = Layer.effect(SmeChatService, makeSmeChatService);
