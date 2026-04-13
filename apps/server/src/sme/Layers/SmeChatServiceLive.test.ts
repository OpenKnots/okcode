import { ProjectId, SmeConversationId } from "@okcode/contracts";
import { Effect, Layer, Option } from "effect";
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

describe("SmeChatServiceLive", () => {
  it("routes Claude conversations through direct Anthropic chat and stores the reply", async () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const conversationId = SmeConversationId.makeUnsafe("conversation-1");
    const conversationRow: SmeConversationRow = {
      conversationId,
      projectId,
      title: "Architecture Q&A",
      provider: "claudeAgent",
      authMethod: "apiKey",
      model: "claude-sonnet-4-6",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    const { repository: messageRepo, rowsByConversation } = makeMessageRepository();
    const sendInputs: Array<any> = [];
    const sendClaudeMessage = (input: any) =>
      Effect.sync(() => {
        sendInputs.push(input);
        input.onEvent?.({
          type: "sme.message.delta",
          conversationId: input.conversationId,
          messageId: input.assistantMessageId,
          text: "Hello",
        });
        input.onEvent?.({
          type: "sme.message.delta",
          conversationId: input.conversationId,
          messageId: input.assistantMessageId,
          text: " world",
        });
        return "Hello world";
      });

    const layer = makeSmeChatServiceLive({ sendSmeViaAnthropic: sendClaudeMessage }).pipe(
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, messageRepo)),
    );

    const savedEnv = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
      ANTHROPIC_API_BASE_URL: process.env.ANTHROPIC_API_BASE_URL,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_API_BASE_URL;

    const events: Array<unknown> = [];
    try {
      await Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SmeChatService;
          yield* service.sendMessage(
            {
              conversationId,
              text: "What changed in the latest design?",
              providerOptions: {
                claudeAgent: {
                  authTokenHelperCommand: "printf test-token",
                },
              },
            },
            (event) => {
              events.push(event);
            },
          );
        }).pipe(Effect.provide(layer)),
      );
    } finally {
      if (savedEnv.ANTHROPIC_API_KEY === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = savedEnv.ANTHROPIC_API_KEY;
      }
      if (savedEnv.ANTHROPIC_AUTH_TOKEN === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN;
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = savedEnv.ANTHROPIC_AUTH_TOKEN;
      }
      if (savedEnv.ANTHROPIC_BASE_URL === undefined) {
        delete process.env.ANTHROPIC_BASE_URL;
      } else {
        process.env.ANTHROPIC_BASE_URL = savedEnv.ANTHROPIC_BASE_URL;
      }
      if (savedEnv.ANTHROPIC_API_BASE_URL === undefined) {
        delete process.env.ANTHROPIC_API_BASE_URL;
      } else {
        process.env.ANTHROPIC_API_BASE_URL = savedEnv.ANTHROPIC_API_BASE_URL;
      }
    }

    expect(sendInputs).toHaveLength(1);
    expect(sendInputs[0]).toEqual(
      expect.objectContaining({
        clientOptions: expect.objectContaining({
          authToken: "test-token",
          apiKey: null,
        }),
        model: "claude-sonnet-4-6",
        systemPrompt: expect.stringContaining("plain assistant text only"),
        messages: [{ role: "user", content: "What changed in the latest design?" }],
      }),
    );
    expect(sendInputs[0].messages).toHaveLength(1);
    expect(sendInputs[0].messages[0]).toEqual({
      role: "user",
      content: "What changed in the latest design?",
    });
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

  it("fails before sending when Claude credentials are unavailable", async () => {
    const projectId = ProjectId.makeUnsafe("project-2");
    const conversationId = SmeConversationId.makeUnsafe("conversation-2");
    const conversationRow: SmeConversationRow = {
      conversationId,
      projectId,
      title: "Docs sync",
      provider: "claudeAgent",
      authMethod: "apiKey",
      model: "claude-sonnet-4-6",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    };
    const { repository: messageRepo, rowsByConversation } = makeMessageRepository();
    const layer = makeSmeChatServiceLive({
      sendSmeViaAnthropic: () => Effect.succeed("unexpected send"),
    }).pipe(
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, messageRepo)),
    );

    const savedEnv = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
      ANTHROPIC_API_BASE_URL: process.env.ANTHROPIC_API_BASE_URL,
    };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_API_BASE_URL;

    try {
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
        "SmeChatError in sendMessage:validate: Claude SME Chat needs an Anthropic API key, auth token, or auth token helper command.",
      );
    } finally {
      if (savedEnv.ANTHROPIC_API_KEY === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = savedEnv.ANTHROPIC_API_KEY;
      }
      if (savedEnv.ANTHROPIC_AUTH_TOKEN === undefined) {
        delete process.env.ANTHROPIC_AUTH_TOKEN;
      } else {
        process.env.ANTHROPIC_AUTH_TOKEN = savedEnv.ANTHROPIC_AUTH_TOKEN;
      }
      if (savedEnv.ANTHROPIC_BASE_URL === undefined) {
        delete process.env.ANTHROPIC_BASE_URL;
      } else {
        process.env.ANTHROPIC_BASE_URL = savedEnv.ANTHROPIC_BASE_URL;
      }
      if (savedEnv.ANTHROPIC_API_BASE_URL === undefined) {
        delete process.env.ANTHROPIC_API_BASE_URL;
      } else {
        process.env.ANTHROPIC_API_BASE_URL = savedEnv.ANTHROPIC_API_BASE_URL;
      }
    }

    expect(rowsByConversation.get(conversationId)).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Can you summarize the docs?",
        isStreaming: false,
      }),
    ]);
  });

  it("rejects unsupported SME providers before a conversation can be created", async () => {
    const projectId = ProjectId.makeUnsafe("project-3");
    const layer = makeSmeChatServiceLive().pipe(
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(Layer.succeed(SmeConversationRepository, makeConversationRepository([]))),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, makeMessageRepository().repository)),
    );

    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* SmeChatService;
          yield* service.createConversation({
            projectId,
            title: "Unsupported provider",
            provider: "codex",
            authMethod: "chatgpt",
            model: "codex-mini",
          });
        }).pipe(Effect.provide(layer)),
      ),
    ).rejects.toThrow("SME Chat only supports Claude Code conversations right now.");
  });
});
