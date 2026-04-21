import { ProjectId, SmeConversationId } from "@okcode/contracts";
import { Effect, Layer, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";

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

function makeProviderServiceLayer() {
  const providerService: ProviderServiceShape = {
    startSession: () => Effect.die("not used in this test"),
    sendTurn: () => Effect.die("not used in this test"),
    interruptTurn: () => Effect.void,
    respondToRequest: () => Effect.void,
    respondToUserInput: () => Effect.void,
    stopSession: () => Effect.void,
    listSessions: () => Effect.succeed([]),
    getCapabilities: () => Effect.die("not used in this test"),
    rollbackConversation: () => Effect.void,
    streamEvents: Stream.empty,
  };

  return Layer.succeed(ProviderService, providerService);
}

describe("SmeChatServiceLive", () => {
  it("creates Codex SME conversations", async () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const layer = makeSmeChatServiceLive().pipe(
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(Layer.succeed(SmeConversationRepository, makeConversationRepository([]))),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, makeMessageRepository().repository)),
      Layer.provideMerge(makeProviderServiceLayer()),
    );

    const created = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SmeChatService;
        return yield* service.createConversation({
          projectId,
          title: "Working SME",
          provider: "codex",
          authMethod: "chatgpt",
          model: "gpt-5",
        });
      }).pipe(Effect.provide(layer)),
    );

    expect(created.provider).toBe("codex");
    expect(created.authMethod).toBe("chatgpt");
    expect(created.model).toBe("gpt-5");
  });

  it("rejects Claude SME conversations", async () => {
    const projectId = ProjectId.makeUnsafe("project-2");
    const layer = makeSmeChatServiceLive().pipe(
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(Layer.succeed(SmeConversationRepository, makeConversationRepository([]))),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, makeMessageRepository().repository)),
      Layer.provideMerge(makeProviderServiceLayer()),
    );

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SmeChatService;
          yield* service.createConversation({
            projectId,
            title: "Old Claude SME",
            provider: "claudeAgent",
            authMethod: "apiKey",
            model: "claude-sonnet-4-6",
          });
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow("GitHub Copilot conversations right now.");
  });

  it("lists persisted Codex conversations", async () => {
    const projectId = ProjectId.makeUnsafe("project-3");
    const conversationId = SmeConversationId.makeUnsafe("conversation-3");
    const conversationRow: SmeConversationRow = {
      conversationId,
      projectId,
      title: "Existing GPT SME",
      provider: "codex",
      authMethod: "chatgpt",
      model: "gpt-5",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };

    const layer = makeSmeChatServiceLive().pipe(
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, makeMessageRepository().repository)),
      Layer.provideMerge(makeProviderServiceLayer()),
    );

    const conversations = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SmeChatService;
        return yield* service.listConversations({ projectId });
      }).pipe(Effect.provide(layer)),
    );

    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.provider).toBe("codex");
    expect(conversations[0]?.authMethod).toBe("chatgpt");
  });
});
