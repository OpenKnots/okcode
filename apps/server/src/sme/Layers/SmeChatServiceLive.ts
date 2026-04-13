/**
 * SmeChatServiceLive - Live implementation for the SME chat service.
 *
 * Implements document management, conversation CRUD, validation, and stateless
 * provider-backed message sending for SME chat.
 *
 * @module SmeChatServiceLive
 */
import type {
  SmeAuthMethod,
  SmeConversation,
  SmeKnowledgeDocument,
  SmeMessage,
} from "@okcode/contracts";
import {
  SME_MAX_CONVERSATIONS_PER_PROJECT,
  SME_MAX_DOCUMENT_SIZE_BYTES,
  SME_MAX_DOCUMENTS_PER_PROJECT,
} from "@okcode/contracts";
import { DateTime, Effect, Layer, Option, Random, Ref } from "effect";
import crypto from "node:crypto";

import { SmeConversationRepository } from "../../persistence/Services/SmeConversations.ts";
import { SmeKnowledgeDocumentRepository } from "../../persistence/Services/SmeKnowledgeDocuments.ts";
import { SmeMessageRepository } from "../../persistence/Services/SmeMessages.ts";
import { isValidSmeAuthMethod } from "../authValidation.ts";
import { resolveAnthropicClientOptions, sendSmeViaAnthropic } from "../backends/anthropic.ts";
import { buildSmeSystemPrompt } from "../promptBuilder.ts";
import {
  SmeChatError,
  SmeChatService,
  type SmeChatServiceShape,
} from "../Services/SmeChatService.ts";
import type { MessageParam } from "@anthropic-ai/sdk/resources";

type ActiveRequest = {
  readonly interrupt: Effect.Effect<void, never>;
};

interface SmeChatServiceLiveOptions {
  readonly sendSmeViaAnthropic?: typeof sendSmeViaAnthropic;
}

const SME_CHAT_SUPPORTED_PROVIDER: SmeConversation["provider"] = "claudeAgent";

function isSmeChatProviderSupported(provider: SmeConversation["provider"]) {
  return provider === SME_CHAT_SUPPORTED_PROVIDER;
}

function unsupportedProviderMessage(provider: SmeConversation["provider"]) {
  return `SME Chat only supports Claude Code conversations right now. '${provider}' can still request tools or interactive approvals, which SME Chat does not implement.`;
}

function ensureValidConversationAuth(
  provider: SmeConversation["provider"],
  authMethod: SmeAuthMethod,
  operation: string,
) {
  return isValidSmeAuthMethod(provider, authMethod)
    ? Effect.void
    : Effect.fail(
        new SmeChatError(
          operation,
          `Auth method '${authMethod}' is not valid for provider '${provider}'.`,
        ),
      );
}

function toConversation(row: {
  readonly conversationId: string;
  readonly projectId: string;
  readonly title: string;
  readonly provider: SmeConversation["provider"];
  readonly authMethod: SmeAuthMethod;
  readonly model: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}): SmeConversation {
  return {
    conversationId: row.conversationId as never,
    projectId: row.projectId as never,
    title: row.title,
    provider: row.provider,
    authMethod: row.authMethod,
    model: row.model,
    createdAt: row.createdAt as never,
    updatedAt: row.updatedAt as never,
    deletedAt: row.deletedAt as never,
  };
}

function toMessage(message: {
  readonly messageId: string;
  readonly conversationId: string;
  readonly role: SmeMessage["role"];
  readonly text: string;
  readonly isStreaming: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}): SmeMessage {
  return {
    messageId: message.messageId as never,
    conversationId: message.conversationId as never,
    role: message.role,
    text: message.text,
    isStreaming: message.isStreaming,
    createdAt: message.createdAt as never,
    updatedAt: message.updatedAt as never,
  };
}

const makeSmeChatService = (options?: SmeChatServiceLiveOptions) =>
  Effect.gen(function* () {
    const documentRepo = yield* SmeKnowledgeDocumentRepository;
    const conversationRepo = yield* SmeConversationRepository;
    const messageRepo = yield* SmeMessageRepository;
    const sendClaudeMessage = options?.sendSmeViaAnthropic ?? sendSmeViaAnthropic;

    const activeRequests = yield* Ref.make(new Map<string, ActiveRequest>());

    const generateId = () =>
      Effect.map(
        Random.nextIntBetween(0, Number.MAX_SAFE_INTEGER),
        (n) => `${Date.now().toString(36)}-${n.toString(36)}`,
      );

    const now = () => Effect.map(DateTime.now, (dt) => DateTime.formatIso(dt));

    const setInterrupt = (conversationId: string, interrupt: Effect.Effect<void, never>) =>
      Ref.update(activeRequests, (map) => {
        const next = new Map(map);
        next.set(conversationId, { interrupt });
        return next;
      });

    const clearInterrupt = (conversationId: string) =>
      Ref.update(activeRequests, (map) => {
        const next = new Map(map);
        next.delete(conversationId);
        return next;
      });

    const validateSetupForConversation = (
      conversation: Pick<SmeConversation, "projectId" | "provider" | "authMethod">,
      providerOptions?: Parameters<SmeChatServiceShape["validateSetup"]>[0]["providerOptions"],
    ) =>
      Effect.gen(function* () {
        yield* ensureValidConversationAuth(
          conversation.provider,
          conversation.authMethod,
          "validateSetup",
        );
        if (!isSmeChatProviderSupported(conversation.provider)) {
          return {
            ok: false,
            severity: "error" as const,
            message: unsupportedProviderMessage(conversation.provider),
            resolvedAuthMethod: conversation.authMethod,
            resolvedAccountType: "unknown" as const,
          };
        }

        const clientOptions = yield* Effect.try({
          try: () =>
            resolveAnthropicClientOptions({
              providerOptions: providerOptions?.claudeAgent,
            }),
          catch: (cause) => new SmeChatError("validateSetup", String(cause), cause),
        });

        if (!clientOptions.apiKey && !clientOptions.authToken) {
          return {
            ok: false,
            severity: "error" as const,
            message:
              "Claude SME Chat needs an Anthropic API key, auth token, or auth token helper command. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, or configure `authTokenHelperCommand` in Settings.",
            resolvedAuthMethod: conversation.authMethod,
            resolvedAccountType: "unknown" as const,
          };
        }

        return {
          ok: true,
          severity: "ready" as const,
          message:
            clientOptions.apiKey !== null
              ? "Claude SME Chat can use the configured Anthropic API key."
              : "Claude SME Chat can use the configured Anthropic auth token.",
          resolvedAuthMethod: conversation.authMethod,
          resolvedAccountType:
            clientOptions.apiKey !== null ? ("apiKey" as const) : ("unknown" as const),
        };
      });

    const uploadDocument: SmeChatServiceShape["uploadDocument"] = (input) =>
      Effect.gen(function* () {
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

        yield* documentRepo
          .upsert({
            documentId: documentId as never,
            projectId: input.projectId,
            title: input.title,
            fileName: input.fileName,
            mimeType: input.mimeType,
            sizeBytes: contentBuffer.byteLength,
            contentText,
            contentHash,
            createdAt: timestamp as never,
            updatedAt: timestamp as never,
            deletedAt: null,
          } as any)
          .pipe(Effect.mapError((e) => new SmeChatError("uploadDocument", e.message)));

        return {
          documentId: documentId as never,
          projectId: input.projectId,
          title: input.title,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: contentBuffer.byteLength,
          contentHash,
          createdAt: timestamp as never,
          updatedAt: timestamp as never,
          deletedAt: null,
        } satisfies SmeKnowledgeDocument;
      });

    const deleteDocument: SmeChatServiceShape["deleteDocument"] = (input) =>
      documentRepo
        .deleteById({ documentId: input.documentId })
        .pipe(Effect.mapError((e) => new SmeChatError("deleteDocument", e.message)));

    const listDocuments: SmeChatServiceShape["listDocuments"] = (input) =>
      documentRepo.listByProjectId({ projectId: input.projectId }).pipe(
        Effect.mapError((e) => new SmeChatError("listDocuments", e.message)),
        Effect.map((rows) =>
          rows.map((row) => ({
            documentId: row.documentId,
            projectId: row.projectId,
            title: row.title,
            fileName: row.fileName,
            mimeType: row.mimeType,
            sizeBytes: row.sizeBytes,
            contentHash: row.contentHash,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
          })),
        ),
      );

    const createConversation: SmeChatServiceShape["createConversation"] = (input) =>
      Effect.gen(function* () {
        yield* ensureValidConversationAuth(input.provider, input.authMethod, "createConversation");
        if (!isSmeChatProviderSupported(input.provider)) {
          return yield* Effect.fail(
            new SmeChatError("createConversation", unsupportedProviderMessage(input.provider)),
          );
        }

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
          conversationId: conversationId as never,
          projectId: input.projectId,
          title: input.title,
          provider: input.provider,
          authMethod: input.authMethod,
          model: input.model,
          createdAt: timestamp as never,
          updatedAt: timestamp as never,
          deletedAt: null,
        };

        yield* conversationRepo
          .upsert(row as any)
          .pipe(Effect.mapError((e) => new SmeChatError("createConversation", e.message)));

        return row satisfies SmeConversation;
      });

    const updateConversation: SmeChatServiceShape["updateConversation"] = (input) =>
      Effect.gen(function* () {
        yield* ensureValidConversationAuth(input.provider, input.authMethod, "updateConversation");
        if (!isSmeChatProviderSupported(input.provider)) {
          return yield* Effect.fail(
            new SmeChatError("updateConversation", unsupportedProviderMessage(input.provider)),
          );
        }
        const existing = yield* conversationRepo
          .getById({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("updateConversation", e.message)));
        if (Option.isNone(existing)) {
          return yield* Effect.fail(
            new SmeChatError("updateConversation", "Conversation not found"),
          );
        }

        const row = existing.value;
        const timestamp = yield* now();
        const updated = {
          ...row,
          title: input.title,
          provider: input.provider,
          authMethod: input.authMethod,
          model: input.model,
          updatedAt: timestamp as never,
        };

        yield* conversationRepo
          .upsert(updated as any)
          .pipe(Effect.mapError((e) => new SmeChatError("updateConversation", e.message)));

        return toConversation(updated);
      });

    const deleteConversation: SmeChatServiceShape["deleteConversation"] = (input) =>
      Effect.gen(function* () {
        yield* messageRepo
          .deleteByConversationId({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("deleteConversation", e.message)));
        yield* conversationRepo
          .deleteById({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("deleteConversation", e.message)));
        yield* clearInterrupt(input.conversationId);
      });

    const listConversations: SmeChatServiceShape["listConversations"] = (input) =>
      conversationRepo.listByProjectId({ projectId: input.projectId }).pipe(
        Effect.mapError((e) => new SmeChatError("listConversations", e.message)),
        Effect.map((rows) => rows.map(toConversation)),
      );

    const getConversation: SmeChatServiceShape["getConversation"] = (input) =>
      Effect.gen(function* () {
        const conversation = yield* conversationRepo
          .getById({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("getConversation", e.message)));
        if (Option.isNone(conversation)) {
          return null;
        }

        const messages = yield* messageRepo
          .listByConversationId({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("getConversation", e.message)));

        return {
          conversation: toConversation(conversation.value),
          messages: messages.map((message) => toMessage(message as any)),
        };
      });

    const validateSetup: SmeChatServiceShape["validateSetup"] = (input) =>
      Effect.gen(function* () {
        const conversation = yield* conversationRepo
          .getById({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("validateSetup", e.message)));
        if (Option.isNone(conversation)) {
          return yield* Effect.fail(new SmeChatError("validateSetup", "Conversation not found"));
        }
        return yield* validateSetupForConversation(conversation.value, input.providerOptions);
      });

    const sendMessage: SmeChatServiceShape["sendMessage"] = (input, onEvent) =>
      Effect.gen(function* () {
        const conversation = yield* conversationRepo
          .getById({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));
        if (Option.isNone(conversation)) {
          return yield* Effect.fail(new SmeChatError("sendMessage", "Conversation not found"));
        }
        const conv = conversation.value;

        if (!isSmeChatProviderSupported(conv.provider)) {
          return yield* Effect.fail(
            new SmeChatError("sendMessage", unsupportedProviderMessage(conv.provider)),
          );
        }

        const docs = yield* documentRepo
          .listByProjectId({ projectId: conv.projectId })
          .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));
        const existingMessages = yield* messageRepo
          .listByConversationId({ conversationId: input.conversationId })
          .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));

        const timestamp = yield* now();
        const userMessageId = yield* generateId();
        const assistantMessageId = yield* generateId();

        yield* messageRepo
          .upsert({
            messageId: userMessageId as never,
            conversationId: input.conversationId,
            role: "user",
            text: input.text,
            isStreaming: false,
            createdAt: timestamp as never,
            updatedAt: timestamp as never,
          } as any)
          .pipe(Effect.mapError((e) => new SmeChatError("sendMessage", e.message)));

        const validation = yield* validateSetupForConversation(conv, input.providerOptions);
        if (!validation.ok) {
          onEvent?.({
            type: "sme.message.error",
            conversationId: input.conversationId,
            messageId: assistantMessageId as never,
            error: validation.message,
          });
          return yield* Effect.fail(new SmeChatError("sendMessage:validate", validation.message));
        }

        const promptHistory = existingMessages.map((message) => ({
          role: message.role,
          text: message.text,
        }));
        const anthropicClientOptions = yield* Effect.try({
          try: () =>
            resolveAnthropicClientOptions({
              providerOptions: input.providerOptions?.claudeAgent,
            }),
          catch: (cause) => new SmeChatError("sendMessage:providerRuntime", String(cause), cause),
        });

        if (!anthropicClientOptions.apiKey && !anthropicClientOptions.authToken) {
          return yield* Effect.fail(
            new SmeChatError(
              "sendMessage:providerRuntime",
              "Claude SME Chat needs an Anthropic API key, auth token, or auth token helper command. Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, or configure `authTokenHelperCommand` in Settings.",
            ),
          );
        }

        const systemPrompt = buildSmeSystemPrompt(docs);
        const messages: Array<MessageParam> = [
          ...(promptHistory
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({
              role: message.role,
              content: message.text,
            })) as Array<MessageParam>),
          {
            role: "user",
            content: input.text,
          },
        ];

        const abortController = new AbortController();

        const sendEffect = sendClaudeMessage({
          clientOptions: anthropicClientOptions,
          conversationId: input.conversationId,
          assistantMessageId,
          model: conv.model,
          systemPrompt,
          messages,
          ...(onEvent ? { onEvent } : {}),
          abortSignal: abortController.signal,
        });

        yield* setInterrupt(
          input.conversationId,
          Effect.sync(() => {
            abortController.abort();
          }),
        );

        const responseText = yield* sendEffect.pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* clearInterrupt(input.conversationId);
            }),
          ),
          Effect.mapError((cause) =>
            cause instanceof SmeChatError
              ? cause
              : new SmeChatError("sendMessage", String(cause), cause),
          ),
          Effect.tapError((error) =>
            Effect.sync(() => {
              onEvent?.({
                type: "sme.message.error",
                conversationId: input.conversationId,
                messageId: assistantMessageId as never,
                error: error.detail,
              });
            }),
          ),
        );

        const finalTimestamp = yield* now();
        yield* messageRepo
          .upsert({
            messageId: assistantMessageId as never,
            conversationId: input.conversationId,
            role: "assistant",
            text: responseText,
            isStreaming: false,
            createdAt: timestamp as never,
            updatedAt: finalTimestamp as never,
          } as any)
          .pipe(Effect.mapError((e) => new SmeChatError("sendMessage:finalize", e.message)));

        onEvent?.({
          type: "sme.message.complete",
          conversationId: input.conversationId,
          messageId: assistantMessageId as never,
          text: responseText,
        });
      });

    const interruptMessage: SmeChatServiceShape["interruptMessage"] = (input) =>
      Effect.gen(function* () {
        const active = yield* Ref.get(activeRequests);
        const request = active.get(input.conversationId);
        if (!request) {
          return;
        }
        yield* request.interrupt;
        yield* clearInterrupt(input.conversationId);
      });

    return {
      uploadDocument,
      deleteDocument,
      listDocuments,
      createConversation,
      updateConversation,
      deleteConversation,
      listConversations,
      getConversation,
      validateSetup,
      sendMessage,
      interruptMessage,
    } satisfies SmeChatServiceShape;
  });

export const makeSmeChatServiceLive = (options?: SmeChatServiceLiveOptions) =>
  Layer.effect(SmeChatService, makeSmeChatService(options));

export const SmeChatServiceLive = makeSmeChatServiceLive();
