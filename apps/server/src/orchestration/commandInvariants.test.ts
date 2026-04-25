import { describe, expect, it } from "vitest";
import {
  MessageId,
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  ProjectId,
  ThreadId,
  type OrchestrationCommand,
  type OrchestrationReadModel,
} from "@okcode/contracts";
import { Effect } from "effect";

import {
  findThreadById,
  requireProject,
  requireProjectChatThreadAbsent,
  listThreadsByProjectId,
  requireNonNegativeInteger,
  requireThread,
  requireThreadAbsent,
} from "./commandInvariants.ts";

const now = new Date().toISOString();

const readModel: OrchestrationReadModel = {
  snapshotSequence: 2,
  updatedAt: now,
  projects: [
    {
      id: ProjectId.makeUnsafe("project-a"),
      title: "Project A",
      workspaceRoot: "/tmp/project-a",
      defaultModel: "gpt-5-codex",
      iconPath: null,
      scripts: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: ProjectId.makeUnsafe("project-b"),
      title: "Project B",
      workspaceRoot: "/tmp/project-b",
      defaultModel: "gpt-5-codex",
      iconPath: null,
      scripts: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: ProjectId.makeUnsafe("project-archived"),
      title: "Project Archived",
      workspaceRoot: "/tmp/project-archived",
      defaultModel: "gpt-5-codex",
      iconPath: null,
      scripts: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
  ],
  threads: [
    {
      id: ThreadId.makeUnsafe("thread-1"),
      kind: "thread",
      projectId: ProjectId.makeUnsafe("project-a"),
      title: "Thread A",
      model: "gpt-5-codex",
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
      runtimeMode: "full-access",
      branch: null,
      worktreePath: null,
      createdAt: now,
      updatedAt: now,
      latestTurn: null,
      messages: [],
      session: null,
      activities: [],
      proposedPlans: [],
      checkpoints: [],
      deletedAt: null,
    },
    {
      id: ThreadId.makeUnsafe("thread-2"),
      kind: "thread",
      projectId: ProjectId.makeUnsafe("project-b"),
      title: "Thread B",
      model: "gpt-5-codex",
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
      runtimeMode: "full-access",
      branch: null,
      worktreePath: null,
      createdAt: now,
      updatedAt: now,
      latestTurn: null,
      messages: [],
      session: null,
      activities: [],
      proposedPlans: [],
      checkpoints: [],
      deletedAt: null,
    },
    {
      id: ThreadId.makeUnsafe("thread-archived"),
      kind: "thread",
      projectId: ProjectId.makeUnsafe("project-archived"),
      title: "Thread Archived",
      model: "gpt-5-codex",
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
      runtimeMode: "full-access",
      branch: null,
      worktreePath: null,
      createdAt: now,
      updatedAt: now,
      latestTurn: null,
      messages: [],
      session: null,
      activities: [],
      proposedPlans: [],
      checkpoints: [],
      deletedAt: now,
    },
  ],
};

const messageSendCommand: OrchestrationCommand = {
  type: "thread.turn.start",
  commandId: CommandId.makeUnsafe("cmd-1"),
  threadId: ThreadId.makeUnsafe("thread-1"),
  message: {
    messageId: MessageId.makeUnsafe("msg-1"),
    role: "user",
    text: "hello",
    attachments: [],
  },
  interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
  runtimeMode: "approval-required",
  createdAt: now,
};

describe("commandInvariants", () => {
  it("finds threads by id and project", () => {
    expect(findThreadById(readModel, ThreadId.makeUnsafe("thread-1"))?.projectId).toBe("project-a");
    expect(findThreadById(readModel, ThreadId.makeUnsafe("missing"))).toBeUndefined();
    expect(
      listThreadsByProjectId(readModel, ProjectId.makeUnsafe("project-b")).map(
        (thread) => thread.id,
      ),
    ).toEqual([ThreadId.makeUnsafe("thread-2")]);
  });

  it("requires existing thread", async () => {
    const thread = await Effect.runPromise(
      requireThread({
        readModel,
        command: messageSendCommand,
        threadId: ThreadId.makeUnsafe("thread-1"),
      }),
    );
    expect(thread.id).toBe(ThreadId.makeUnsafe("thread-1"));

    await expect(
      Effect.runPromise(
        requireThread({
          readModel,
          command: messageSendCommand,
          threadId: ThreadId.makeUnsafe("thread-archived"),
        }),
      ),
    ).rejects.toThrow("has been archived");

    await expect(
      Effect.runPromise(
        requireThread({
          readModel,
          command: messageSendCommand,
          threadId: ThreadId.makeUnsafe("missing"),
        }),
      ),
    ).rejects.toThrow("does not exist");
  });

  it("requires active projects for non-create flows", async () => {
    await Effect.runPromise(
      requireProject({
        readModel,
        command: {
          type: "project.meta.update",
          commandId: CommandId.makeUnsafe("cmd-project-update"),
          projectId: ProjectId.makeUnsafe("project-a"),
          iconPath: null,
        },
        projectId: ProjectId.makeUnsafe("project-a"),
      }),
    );

    await expect(
      Effect.runPromise(
        requireProject({
          readModel,
          command: {
            type: "project.meta.update",
            commandId: CommandId.makeUnsafe("cmd-project-update-archived"),
            projectId: ProjectId.makeUnsafe("project-archived"),
            iconPath: null,
          },
          projectId: ProjectId.makeUnsafe("project-archived"),
        }),
      ),
    ).rejects.toThrow("has been archived");
  });

  it("requires missing thread for create flows", async () => {
    await Effect.runPromise(
      requireThreadAbsent({
        readModel,
        command: {
          type: "thread.create",
          commandId: CommandId.makeUnsafe("cmd-2"),
          threadId: ThreadId.makeUnsafe("thread-3"),
          kind: "thread",
          projectId: ProjectId.makeUnsafe("project-a"),
          title: "new",
          model: "gpt-5-codex",
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          branch: null,
          worktreePath: null,
          createdAt: now,
        },
        threadId: ThreadId.makeUnsafe("thread-3"),
      }),
    );

    await expect(
      Effect.runPromise(
        requireThreadAbsent({
          readModel,
          command: {
            type: "thread.create",
            commandId: CommandId.makeUnsafe("cmd-3"),
            threadId: ThreadId.makeUnsafe("thread-1"),
            kind: "thread",
            projectId: ProjectId.makeUnsafe("project-a"),
            title: "dup",
            model: "gpt-5-codex",
            interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
            runtimeMode: "full-access",
            branch: null,
            worktreePath: null,
            createdAt: now,
          },
          threadId: ThreadId.makeUnsafe("thread-1"),
        }),
      ),
    ).rejects.toThrow("already exists");
  });

  it("rejects duplicate project-chat threads within the same project", async () => {
    const readModelWithProjectChat: OrchestrationReadModel = {
      ...readModel,
      threads: [
        ...readModel.threads,
        {
          id: ThreadId.makeUnsafe("thread-project-chat"),
          kind: "project-chat",
          projectId: ProjectId.makeUnsafe("project-a"),
          title: "Project chat",
          model: "gpt-5-codex",
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "full-access",
          branch: null,
          worktreePath: null,
          createdAt: now,
          updatedAt: now,
          latestTurn: null,
          messages: [],
          session: null,
          activities: [],
          proposedPlans: [],
          checkpoints: [],
          deletedAt: null,
        },
      ],
    };

    await expect(
      Effect.runPromise(
        requireProjectChatThreadAbsent({
          readModel: readModelWithProjectChat,
          command: {
            type: "thread.create",
            commandId: CommandId.makeUnsafe("cmd-project-chat"),
            threadId: ThreadId.makeUnsafe("thread-project-chat-next"),
            kind: "project-chat",
            projectId: ProjectId.makeUnsafe("project-a"),
            title: "Project chat",
            model: "gpt-5-codex",
            interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
            runtimeMode: "full-access",
            branch: null,
            worktreePath: null,
            createdAt: now,
          },
          projectId: ProjectId.makeUnsafe("project-a"),
        }),
      ),
    ).rejects.toThrow("already has a project chat");
  });

  it("requires non-negative integers", async () => {
    await Effect.runPromise(
      requireNonNegativeInteger({
        commandType: "thread.checkpoint.revert",
        field: "turnCount",
        value: 0,
      }),
    );

    await expect(
      Effect.runPromise(
        requireNonNegativeInteger({
          commandType: "thread.checkpoint.revert",
          field: "turnCount",
          value: -1,
        }),
      ),
    ).rejects.toThrow("greater than or equal to 0");
  });
});
