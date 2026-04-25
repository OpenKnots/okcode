import { describe, expect, it } from "vitest";
import { ProjectId, ThreadId, type ModelSelection } from "@okcode/contracts";

import { findProjectChatThread, resolveProjectChatModelSelection } from "./projectChat";
import type { Thread } from "../types";

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: ThreadId.makeUnsafe("thread-1"),
    codexThreadId: null,
    kind: "thread",
    projectId: ProjectId.makeUnsafe("project-1"),
    title: "Thread",
    model: "gpt-5.4",
    runtimeMode: "full-access",
    interactionMode: "code",
    session: null,
    messages: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    latestTurn: null,
    branch: null,
    worktreePath: null,
    turnDiffSummaries: [],
    activities: [],
    ...overrides,
  };
}

describe("findProjectChatThread", () => {
  it("returns the canonical project-chat thread for a project", () => {
    const projectId = ProjectId.makeUnsafe("project-1");
    const thread = findProjectChatThread(
      [
        makeThread({ projectId }),
        makeThread({
          id: ThreadId.makeUnsafe("thread-project-chat"),
          projectId,
          kind: "project-chat",
          title: "Project chat",
        }),
      ],
      projectId,
    );

    expect(thread?.kind).toBe("project-chat");
    expect(thread?.id).toBe(ThreadId.makeUnsafe("thread-project-chat"));
  });
});

describe("resolveProjectChatModelSelection", () => {
  it("prefers Codex when it is selectable", () => {
    const selection = resolveProjectChatModelSelection({
      projectDefaultModelSelection: {
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
      } satisfies ModelSelection,
      projectModel: "claude-sonnet-4-6",
      selectableProviders: ["codex", "claudeAgent"],
    });

    expect(selection).toMatchObject({
      provider: "codex",
    });
  });

  it("falls back to the project default provider when Codex is unavailable", () => {
    const selection = resolveProjectChatModelSelection({
      projectDefaultModelSelection: {
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
      } satisfies ModelSelection,
      projectModel: "claude-sonnet-4-6",
      selectableProviders: ["claudeAgent"],
    });

    expect(selection).toEqual({
      provider: "claudeAgent",
      model: "claude-sonnet-4-6",
    });
  });
});
