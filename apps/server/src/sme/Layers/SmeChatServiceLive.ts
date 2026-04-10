/**
 * SmeChatServiceLive - Live implementation for the SME chat service.
 *
 * Implements document management, conversation CRUD, validation, and stateless
 * provider-backed message sending for SME chat.
 *
 * @module SmeChatServiceLive
 */
import Anthropic from "@anthropic-ai/sdk";
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

import { EnvironmentVariables } from "../../persistence/Services/EnvironmentVariables.ts";
import { OpenclawGatewayConfig } from "../../persistence/Services/OpenclawGatewayConfig.ts";
import { SmeConversationRepository } from "../../persistence/Services/SmeConversations.ts";
import { SmeKnowledgeDocumentRepository } from "../../persistence/Services/SmeKnowledgeDocuments.ts";
import { SmeMessageRepository } from "../../persistence/Services/SmeMessages.ts";
import { ProviderHealth } from "../../provider/Services/ProviderHealth.ts";
import { ProviderService } from "../../provider/Services/ProviderService.ts";
import {
  isValidSmeAuthMethod,
  validateAnthropicSetup,
  validateCodexSetup,
  validateOpenClawSetup,
} from "../authValidation.ts";
import { sendSmeViaAnthropic, type ResolvedAnthropicClientOptions } from "../backends/anthropic.ts";
import { sendSmeViaProviderRuntime } from "../backends/providerRuntime.ts";
import {
  buildSmeAnthropicMessages,
  buildSmeCompiledPrompt,
  buildSmeSystemPrompt,
} from "../promptBuilder.ts";
import {
  SmeChatError,
  SmeChatService,
  type SmeChatServiceShape,
} from "../Services/SmeChatService.ts";

type AnthropicMessagesClient = Pick<Anthropic, "messages">;

export interface SmeChatServiceLiveOptions {
  readonly createClient?: (options: ResolvedAnthropicClientOptions) => AnthropicMessagesClient;
}

type ActiveRequest = {
  readonly interrupt: Effect.Effect<void, never>;
};

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

const makeSmeChatService = (options: SmeChatServiceLiveOptions = {}) =>
  Effect.gen(function* () {
    const documentRepo = yield* SmeKnowledgeDocumentRepository;
    const conversationRepo = yield* SmeConversationRepository;
    const messageRepo = yield* SmeMessageRepository;
    const environmentVariables = yield* EnvironmentVariables;
    const openclawGatewayConfig = yield* OpenclawGatewayConfig;
    const providerHealth = yield* ProviderHealth;
    const providerService = yield* ProviderService;
    const createClient =
      options.createClient ??
      ((clientOptions: ResolvedAnthropicClientOptions): AnthropicMessagesClient =>
        new Anthropic(clientOptions));

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

        switch (conversation.provider) {
          case "claudeAgent": {
            const persistedEnv = yield* environmentVariables
              .resolveEnvironment({
                projectId: conversation.projectId,
              })
              .pipe(Effect.mapError((e) => new SmeChatError("validateSetup", e.message)));
            return validateAnthropicSetup({
              authMethod: conversation.authMethod as Extract<
                SmeAuthMethod,
                "auto" | "apiKey" | "authToken"
              >,
              persistedEnv,
              processEnv: process.env,
            });
          }

          case "codex":
            return yield* Effect.tryPromise({
              try: () =>
                validateCodexSetup({
                  authMethod: conversation.authMethod as Extract<
                    SmeAuthMethod,
                    "auto" | "apiKey" | "chatgpt" | "customProvider"
                  >,
                  providerOptions,
                }),
              catch: (cause) =>
                new SmeChatError("validateSetup", "Failed to validate Codex setup.", cause),
            });

          case "openclaw":
            const openclawSummary = yield* openclawGatewayConfig
              .getSummary()
              .pipe(Effect.mapError((e) => new SmeChatError("validateSetup", e.message)));
            const openclawStatus = (yield* providerHealth.getStatuses).find(
              (status) => status.provider === "openclaw",
            );
            return validateOpenClawSetup({
              authMethod: conversation.authMethod as Extract<
                SmeAuthMethod,
                "auto" | "password" | "none"
              >,
              gatewayUrl: openclawSummary.gatewayUrl,
              hasSharedSecret: openclawSummary.hasSharedSecret,
              hasDeviceToken: openclawSummary.hasDeviceToken,
              ...(openclawStatus ? { providerStatus: openclawStatus } : {}),
            });
        }
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

        const systemPrompt = buildSmeSystemPrompt(docs);
        const promptHistory = existingMessages.map((message) => ({
          role: message.role,
          text: message.text,
        }));
        const anthropicMessages = buildSmeAnthropicMessages({
          history: promptHistory,
          userText: input.text,
        });
        const compiledPrompt = buildSmeCompiledPrompt({
          docs,
          history: promptHistory,
          userText: input.text,
        });

        const sendEffect =
          conv.provider === "claudeAgent"
            ? Effect.gen(function* () {
                const persistedEnv = yield* environmentVariables
                  .resolveEnvironment({
                    projectId: conv.projectId,
                  })
                  .pipe(Effect.mapError((e) => new SmeChatError("sendMessage:env", e.message)));
                const anthropicSetup = validateAnthropicSetup({
                  authMethod: conv.authMethod as Extract<
                    SmeAuthMethod,
                    "auto" | "apiKey" | "authToken"
                  >,
                  persistedEnv,
                  processEnv: process.env,
                });
                if (!anthropicSetup.ok || !anthropicSetup.clientOptions) {
                  return yield* Effect.fail(
                    new SmeChatError("sendMessage:validate", anthropicSetup.message),
                  );
                }

                const controller = new AbortController();
                yield* setInterrupt(
                  input.conversationId,
                  Effect.sync(() => {
                    controller.abort();
                  }),
                );
                return yield* sendSmeViaAnthropic({
                  client: createClient(anthropicSetup.clientOptions),
                  conversationId: input.conversationId,
                  assistantMessageId,
                  model: conv.model,
                  systemPrompt,
                  messages: anthropicMessages,
                  ...(onEvent ? { onEvent } : {}),
                  abortSignal: controller.signal,
                }).pipe(Effect.ensuring(clearInterrupt(input.conversationId)));
              })
            : sendSmeViaProviderRuntime({
                providerService,
                provider: conv.provider,
                conversationId: input.conversationId,
                assistantMessageId,
                model: conv.model,
                compiledPrompt,
                ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
                ...(onEvent ? { onEvent } : {}),
                setInterruptEffect: (interrupt) => setInterrupt(input.conversationId, interrupt),
                clearInterruptEffect: clearInterrupt(input.conversationId),
              });

        const responseText = yield* sendEffect.pipe(
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

export const makeSmeChatServiceLive = (options: SmeChatServiceLiveOptions = {}) =>
  Layer.effect(SmeChatService, makeSmeChatService(options));

export const SmeChatServiceLive = makeSmeChatServiceLive();
