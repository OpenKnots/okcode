import { ProjectId, SmeConversationId, type EnvironmentVariableEntry } from "@okcode/contracts";
import { Effect, Layer, Option, Stream } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EnvironmentVariables,
  type EnvironmentVariablesShape,
} from "../../persistence/Services/EnvironmentVariables.ts";
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

const originalAnthropicEnv = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
  ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
};

afterEach(() => {
  restoreAnthropicEnv();
});

function restoreAnthropicEnv() {
  for (const [key, value] of Object.entries(originalAnthropicEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setAnthropicEnv(input: {
  readonly apiKey?: string;
  readonly authToken?: string;
  readonly baseURL?: string;
}) {
  if (input.apiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = input.apiKey;
  }

  if (input.authToken === undefined) {
    delete process.env.ANTHROPIC_AUTH_TOKEN;
  } else {
    process.env.ANTHROPIC_AUTH_TOKEN = input.authToken;
  }

  if (input.baseURL === undefined) {
    delete process.env.ANTHROPIC_BASE_URL;
  } else {
    process.env.ANTHROPIC_BASE_URL = input.baseURL;
  }
}

function toEntries(record: Record<string, string>): EnvironmentVariableEntry[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function makeEnvironmentVariables(persistedEnv: Record<string, string>): EnvironmentVariablesShape {
  const entries = toEntries(persistedEnv);

  return {
    getGlobal: () => Effect.succeed({ entries }),
    saveGlobal: (input) => Effect.succeed({ entries: input.entries }),
    getProject: (input) => Effect.succeed({ projectId: input.projectId, entries }),
    saveProject: (input) =>
      Effect.succeed({
        projectId: input.projectId,
        entries: input.entries,
      }),
    resolveEnvironment: () => Effect.succeed(persistedEnv),
  };
}

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

function makeProviderService(): ProviderServiceShape {
  return {
    startSession: () => Effect.die("unexpected provider startSession"),
    sendTurn: () => Effect.die("unexpected provider sendTurn"),
    interruptTurn: () => Effect.void,
    respondToRequest: () => Effect.void,
    respondToUserInput: () => Effect.void,
    stopSession: () => Effect.void,
    listSessions: () => Effect.succeed([]),
    getCapabilities: () => Effect.die("unexpected provider getCapabilities"),
    rollbackConversation: () => Effect.void,
    streamEvents: Stream.empty,
  };
}

describe("SmeChatServiceLive", () => {
  it("uses persisted Anthropic credentials for a successful send and stores the final reply", async () => {
    setAnthropicEnv({
      apiKey: "process-key-that-should-not-win",
      authToken: "process-token-that-should-not-win",
      baseURL: "https://process-base.example",
    });

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
    const persistedEnv = {
      ANTHROPIC_API_KEY: "project-api-key",
      ANTHROPIC_BASE_URL: "https://project-base.example",
    };
    const { repository: messageRepo, rowsByConversation } = makeMessageRepository();
    const capturedClientOptions: Array<unknown> = [];
    const capturedRequests: Array<unknown> = [];

    const createClient = vi.fn((options: unknown) => {
      capturedClientOptions.push(options);
      return {
        messages: {
          stream: async function* (request: unknown) {
            capturedRequests.push(request);
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "Hello" },
            };
            yield {
              type: "content_block_delta",
              delta: { type: "text_delta", text: " world" },
            };
          },
        },
      } as never;
    });

    const layer = makeSmeChatServiceLive({ createClient }).pipe(
      Layer.provideMerge(
        Layer.succeed(EnvironmentVariables, makeEnvironmentVariables(persistedEnv)),
      ),
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, messageRepo)),
      Layer.provideMerge(Layer.succeed(ProviderService, makeProviderService())),
    );

    const events: Array<unknown> = [];
    await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* SmeChatService;
        yield* service.sendMessage(
          {
            conversationId,
            text: "What changed in the latest design?",
          },
          (event) => {
            events.push(event);
          },
        );
      }).pipe(Effect.provide(layer)),
    );

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(capturedClientOptions).toEqual([
      {
        apiKey: "project-api-key",
        authToken: null,
        baseURL: "https://project-base.example",
      },
    ]);
    expect(capturedRequests).toEqual([
      {
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: expect.stringContaining("knowledgeable subject matter expert assistant"),
        messages: [{ role: "user", content: "What changed in the latest design?" }],
      },
    ]);
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

  it("fails before persisting messages when no Anthropic credentials are available", async () => {
    setAnthropicEnv({});

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
    const createClient = vi.fn();

    const layer = makeSmeChatServiceLive({ createClient }).pipe(
      Layer.provideMerge(Layer.succeed(EnvironmentVariables, makeEnvironmentVariables({}))),
      Layer.provideMerge(Layer.succeed(SmeKnowledgeDocumentRepository, makeDocumentRepository())),
      Layer.provideMerge(
        Layer.succeed(SmeConversationRepository, makeConversationRepository([conversationRow])),
      ),
      Layer.provideMerge(Layer.succeed(SmeMessageRepository, messageRepo)),
      Layer.provideMerge(Layer.succeed(ProviderService, makeProviderService())),
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
    ).rejects.toThrow("SmeChatError in sendMessage:validate: Anthropic API key is missing.");

    expect(createClient).not.toHaveBeenCalled();
    expect(rowsByConversation.get(conversationId)).toEqual([
      expect.objectContaining({
        role: "user",
        text: "Can you summarize the docs?",
        isStreaming: false,
      }),
    ]);
  });
});
