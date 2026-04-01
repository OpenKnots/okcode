import { ProjectId, ThreadId } from "@okcode/contracts";
import { describe, expect, it } from "vitest";

import {
  buildAutoSelectedWorktreeBaseBranchToastCopy,
  buildLocalDraftThread,
  buildExpiredTerminalContextToastCopy,
  deriveComposerSendState,
} from "./ChatView.logic";

describe("deriveComposerSendState", () => {
  it("treats expired terminal pills as non-sendable content", () => {
    const state = deriveComposerSendState({
      prompt: "\uFFFC",
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("");
    expect(state.sendableTerminalContexts).toEqual([]);
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(false);
  });

  it("keeps text sendable while excluding expired terminal pills", () => {
    const state = deriveComposerSendState({
      prompt: `yoo \uFFFC waddup`,
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("yoo  waddup");
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(true);
  });
});

describe("buildExpiredTerminalContextToastCopy", () => {
  it("formats clear empty-state guidance", () => {
    expect(buildExpiredTerminalContextToastCopy(1, "empty")).toEqual({
      title: "Expired terminal context won't be sent",
      description: "Remove it or re-add it to include terminal output.",
    });
  });

  it("formats omission guidance for sent messages", () => {
    expect(buildExpiredTerminalContextToastCopy(2, "omitted")).toEqual({
      title: "Expired terminal contexts omitted from message",
      description: "Re-add it if you want that terminal output included.",
    });
  });
});

describe("buildAutoSelectedWorktreeBaseBranchToastCopy", () => {
  it("explains the branch fallback clearly", () => {
    expect(
      buildAutoSelectedWorktreeBaseBranchToastCopy({
        requestedBranch: "main",
        selectedBranch: "master",
      }),
    ).toEqual({
      title: "Using master instead of main",
      description:
        "The requested base branch main was unavailable, so OK Code created this worktree from master.",
    });
  });
});

describe("buildLocalDraftThread", () => {
  it("uses a persisted draft title when present", () => {
    const thread = buildLocalDraftThread(
      ThreadId.makeUnsafe("thread-draft"),
      {
        projectId: ProjectId.makeUnsafe("project-1"),
        createdAt: "2026-03-17T12:52:29.000Z",
        title: "Investigate flaky CI",
        runtimeMode: "full-access",
        interactionMode: "chat",
        branch: null,
        worktreePath: null,
        envMode: "local",
      },
      "gpt-5.4",
      null,
    );

    expect(thread.title).toBe("Investigate flaky CI");
  });

  it("falls back to the default title when the draft title is empty", () => {
    const thread = buildLocalDraftThread(
      ThreadId.makeUnsafe("thread-draft-empty"),
      {
        projectId: ProjectId.makeUnsafe("project-1"),
        createdAt: "2026-03-17T12:52:29.000Z",
        title: "   ",
        runtimeMode: "full-access",
        interactionMode: "chat",
        branch: null,
        worktreePath: null,
        envMode: "local",
      },
      "gpt-5.4",
      null,
    );

    expect(thread.title).toBe("New thread");
  });
});
