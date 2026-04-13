import { ProjectId, SmeConversationId } from "@okcode/contracts";
import { Effect, Layer, Option, Queue, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { OpenclawGatewayConfig } from "../../persistence/Services/OpenclawGatewayConfig.ts";
import {
  SmeKnowledgeDocumentRepository,
  type SmeKnowledgeDocumentRepositoryShape,
  type SmeKnowledgeDocumentRow,
} from "../../persistence/Services/SmeKnowledgeDocuments.ts";
import {
  SmeConversationRepository,
  type SmeConversationRepositoryShape,
  type SmeConversationRow,
} from "../../persistence/Services/SmeConversations.ts";
import {
  SmeMessageRepository,
  type SmeMessageRepositoryShape,
  type SmeMessageRow,
} from "../../persistence/Services/SmeMessages.ts";
import {
  ProviderHealth,
  type ProviderHealthShape,
} from "../../provider/Services/ProviderHealth.ts";
import {
  ProviderService,
  type ProviderServiceShape,
} from "../../provider/Services/ProviderService.ts";
import { SmeChatService } from "../Services/SmeChatService.ts";
import { makeSmeChatServiceLive } from "./SmeChatServiceLive.ts";

function makeDocumentRepository(
  rows: ReadonlyArray<SmeKnowledgeDocumentRow> = [],
): SmeKnowledgeDocumentRepositoryShape {
  const documents = new Map(rows.map((row) => [row.documentId, row] as const));
  const getOption = <T>(value: T | undefined) =>
    value === undefined ? Option.none() : Option.some(value);

  return {
    upsert: (row) =>
      Effect.sync(() => {
        documents.set(row.documentId, row);
      }),
    getById: ({ documentId }) => Effect.succeed(getOption(documents.get(documentId))),
    listByProjectId: ({ projectId }) =>
      Effect.succeed([...documents.values()].filter((row) => row.projectId === projectId)),
    deleteById: ({ documentId }) =>
      Effect.sync(() => {
        documents.delete(documentId);
      }),
  };
}

function makeConversationRepository(
  rows: ReadonlyArray<SmeConversationRow>,
): SmeConversationRepositoryShape {
  const conversations = new Map(rows.map((row) => [row.conversationId, row] as const));
  const getOption = <T>(value: T | undefined) =>
    value === undefined ? Option.none() : Option.some(value);

  return {
    upsert: (row) =>
      Effect.sync(() => {
        conversations.set(row.conversationId, row);
      }),
    getById: ({ conversationId }) => Effect.succeed(getOption(conversations.get(conversationId))),
    listByProjectId: ({ projectId }) =>
      Effect.succeed([...conversations.values()].filter((row) => row.projectId === projectId)),
    deleteById: ({ conversationId }) =>
      Effect.sync(() => {
        conversations.delete(conversationId);
      }),
  };
}

function makeMessageRepository() {
  const rowsByConversation = new Map<string, SmeMessageRow[]>();

  const repository: SmeMessageRepositoryShape = {
    upsert: (row) =>
      Effect.sync(() => {
        const existing = rowsByConversation.get(row.conversationId) ?? [];
        const next = existing.filter((message) => message.messageId !== row.messageId);
        next.push(row);
        rowsByConversation.set(row.conversationId, next);
      }),
    listByConversationId: ({ conversationId }) =>
      Effect.succeed(rowsByConversation.get(conversationId) ?? []),
    deleteByConversationId: ({ conversationId }) =>
      Effect.sync(() => {
        rowsByConversation.delete(conversationId);
      }),
  };

  return { repository, rowsByConversation };
}

function makeProviderHealth(
  statuses: Array<{
    readonly provider: "codex" | "claudeAgent" | "openclaw";
    readonly status: "ready" | "warning" | "error";
    readonly available: boolean;
    readonly authStatus: "authenticated" | "unauthenticated" | "unknown";
    readonly checkedAt: string;
    readonly message?: string;
  }>,
): ProviderHealthShape {
  return {
    getStatuses: Effect.succeed(statuses),
  };
}

function makeProviderService() {
  const runtimeEvents = Effect.runSync(Queue.unbounded<any>());
  const startedSessions: Array<unknown> = [];
  const sentTurns: Array<unknown> = [];

  const service: ProviderServiceShape = {
    startSession: (threadId, input) =>
      Effect.sync(() => {
        startedSessions.push({ threadId, input });
        return {
          provider: input.provider ?? "claudeAgent",
          status: "ready",
          runtimeMode: input.runtimeMode,
          threadId,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        } as never;
      }),
    sendTurn: (input) =>
      Effect.gen(function* () {
        sentTurns.push(input);
        const turnId = "turn-1" as never;
        yield* Queue.offer(runtimeEvents, {
          eventId: "evt-1" as never,
          provider: "claudeAgent",
          threadId: input.threadId,
          turnId,
          createdAt: "2026-01-01T00:00:00.000Z",
          type: "content.delta",
          payload: {
            streamKind: "assistant_text",
            delta: "Hello",
          },
        } as never);
        yield* Queue.offer(runtimeEvents, {
          eventId: "evt-2" as never,
          provider: "claudeAgent",
          threadId: input.threadId,
          turnId,
          createdAt: "2026-01-01T00:00:00.000Z",
          type: "content.delta",
          payload: {
            streamKind: "assistant_text",
            delta: " world",
          },
        } as never);
        yield* Queue.offer(runtimeEvents, {
          eventId: "evt-3" as never,
          provider: "claudeAgent",
          threadId: input.threadId,
          turnId,
          createdAt: "2026-01-01T00:00:00.000Z",
          type: "turn.completed",
          payload: {
            state: "completed",
          },
        } as never);
        return {
          threadId: input.threadId,
          turnId,
        } as never;
      }),
    interruptTurn: () => Effect.void,
    respondToRequest: () => Effect.void,
    respondToUserInput: () => Effect.void,
    stopSession: () => Effect.void,
    listSessions: () => Effect.succeed([]),
    getCapabilities: () => Effect.die("unexpected provider getCapabilities"),
    rollbackConversation: () => Effect.void,
    streamEvents: Stream.fromQueue(runtimeEvents),
  };

  return { service, startedSessions, sentTurns };
}

function makeOpenclawGatewayConfig() {
  return {
    getSummary: () =>
      Effect.succeed({
        gatewayUrl: null,
        hasSharedSecret: false,
        deviceId: null,
        devicePublicKey: null,
        deviceFingerprint: null,
        hasDeviceToken: false,
        deviceTokenRole: null,
        deviceTokenScopes: [],
        updatedAt: null,
      }),
    getStored: () => Effect.succeed(null),
    save: () => Effect.die("unexpected openclaw save"),
    resolveForConnect: () => Effect.succeed(null),
    saveDeviceToken: () => Effect.void,
    clearDeviceToken: () => Effect.void,
    resetDeviceState: () =>
      Effect.succeed({
        gatewayUrl: null,
        hasSharedSecret: false,
        deviceId: null,
        devicePublicKey: null,
        deviceFingerprint: null,
        hasDeviceToken: false,
        deviceTokenRole: null,
        deviceTokenScopes: [],
        updatedAt: null,
      }),
  };
}

describe("SmeChatServiceLive", () => {
  it("routes Claude conversations through the provider runtime and stores the reply", async () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const conversationId = SmeConversationId.makeUnsafe("conversation-1");
    const conversationRow: SmeConversationRow = {
      conversationId,
      projectId,
      title: "Architecture Q&A",
      provider: "claudeAgent",
      authMethod: "auto",
      model: "claude-sonnet-4-6",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    const { repository: messageRepo, rowsByConversation } = makeMessageRepository();
    const providerService = makeProviderService();

    const layer = makeSmeChatServiceLive().pipe(
      Layer.provideMerge(
        Layer.succeed(
          ProviderHealth,
          makeProviderHealth([
            {
              provider: "claudeAgent",
              status: "ready",
              available: true,
              authStatus: "authenticated",
              checkedAt: "2026-01-01T00:00:00.000Z",
              message: "Claude Code CLI is ready.",
            },
          ]),
        ),
      ),
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, messageRepo)),
      Layer.provideMerge(Layer.succeed(OpenclawGatewayConfig, makeOpenclawGatewayConfig())),
      Layer.provideMerge(Layer.succeed(ProviderService, providerService.service)),
    );

    const events: Array<unknown> = [];
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SmeChatService;
        yield* service.sendMessage(
          {
            conversationId,
            text: "What changed in the latest design?",
            providerOptions: {
              claudeAgent: {
                binaryPath: "/usr/local/bin/claude",
                permissionMode: "plan",
                maxThinkingTokens: 12_000,
              },
            },
          },
          (event) => {
            events.push(event);
          },
        );
      }).pipe(Effect.provide(layer)),
    );

    expect(providerService.startedSessions).toHaveLength(1);
    expect(providerService.sentTurns).toHaveLength(1);
    expect((providerService.startedSessions[0] as any).input.providerOptions).toEqual({
      claudeAgent: {
        binaryPath: "/usr/local/bin/claude",
        permissionMode: "plan",
        maxThinkingTokens: 12_000,
      },
    });
    expect(providerService.sentTurns[0] as any).toEqual(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        input: expect.stringContaining("knowledgeable subject matter expert assistant"),
      }),
    );
    expect(events).toEqual([
      {
        type: "sme.message.delta",
        conversationId,
        messageId: expect.any(String),
        text: "Hello",
      },
      {
        type: "sme.message.delta",
        conversationId,
        messageId: expect.any(String),
        text: " world",
      },
      {
        type: "sme.message.complete",
        conversationId,
        messageId: expect.any(String),
        text: "Hello world",
      },
    ]);

    const storedMessages = rowsByConversation.get(conversationId);
    expect(storedMessages).toHaveLength(2);
    expect(
      storedMessages?.map((message) => ({
        role: message.role,
        text: message.text,
        isStreaming: message.isStreaming,
      })),
    ).toEqual([
      { role: "user", text: "What changed in the latest design?", isStreaming: false },
      { role: "assistant", text: "Hello world", isStreaming: false },
    ]);
  });

  it("fails before sending when Claude Code CLI is unavailable", async () => {
    const projectId = ProjectId.makeUnsafe("project-2");
    const conversationId = SmeConversationId.makeUnsafe("conversation-2");
    const conversationRow: SmeConversationRow = {
      conversationId,
      projectId,
      title: "Docs sync",
      provider: "claudeAgent",
      authMethod: "auto",
      model: "claude-sonnet-4-6",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    const { repository: messageRepo, rowsByConversation } = makeMessageRepository();
    const providerService = makeProviderService();

    const layer = makeSmeChatServiceLive().pipe(
      Layer.provideMerge(
        Layer.succeed(
          ProviderHealth,
          makeProviderHealth([
            {
              provider: "claudeAgent",
              status: "error",
              available: false,
              authStatus: "unknown",
              checkedAt: "2026-01-01T00:00:00.000Z",
              message: "Claude Code CLI (`claude`) is not installed or not on PATH.",
            },
          ]),
        ),
      ),
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, messageRepo)),
      Layer.provideMerge(Layer.succeed(OpenclawGatewayConfig, makeOpenclawGatewayConfig())),
      Layer.provideMerge(Layer.succeed(ProviderService, providerService.service)),
    );

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SmeChatService;
          yield* service.sendMessage({
            conversationId,
            text: "Can you summarize the docs?",
          });
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow(
      "SmeChatError in sendMessage:validate: Claude Code CLI (`claude`) is not installed or not on PATH.",
    );

    expect(providerService.startedSessions).toHaveLength(0);
    expect(providerService.sentTurns).toHaveLength(0);
    expect(rowsByConversation.get(conversationId)).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Can you summarize the docs?",
        isStreaming: false,
      }),
    ]);
  });
});
