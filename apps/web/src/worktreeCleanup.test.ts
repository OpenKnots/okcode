import { ProjectId, ThreadId } from "@okcode/contracts";
import { describe, expect, it } from "vitest";

import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE, type Thread } from "./types";
import {
  buildWorktreeCleanupCandidateStates,
  formatBranchAge,
  formatWorktreePathForDisplay,
  getOrphanedWorktreePathForThread,
  resolveWorktreeCleanupProjectCwd,
} from "./worktreeCleanup";

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: ThreadId.makeUnsafe("thread-1"),
    codexThreadId: null,
    kind: "thread",
    projectId: ProjectId.makeUnsafe("project-1"),
    title: "Thread",
    model: "gpt-5.3-codex",
    runtimeMode: DEFAULT_RUNTIME_MODE,
    interactionMode: DEFAULT_INTERACTION_MODE,
    session: null,
    messages: [],
    turnDiffSummaries: [],
    activities: [],
    proposedPlans: [],
    error: null,
    createdAt: "2026-02-13T00:00:00.000Z",
    latestTurn: null,
    branch: null,
    worktreePath: null,
    ...overrides,
  };
}

describe("getOrphanedWorktreePathForThread", () => {
  it("returns null when the target thread does not exist", () => {
    const result = getOrphanedWorktreePathForThread([], ThreadId.makeUnsafe("missing-thread"));
    expect(result).toBeNull();
  });

  it("returns null when the target thread has no worktree", () => {
    const threads = [makeThread()];
    const result = getOrphanedWorktreePathForThread(threads, ThreadId.makeUnsafe("thread-1"));
    expect(result).toBeNull();
  });

  it("returns the path when no other thread links to that worktree", () => {
    const threads = [makeThread({ worktreePath: "/tmp/repo/worktrees/feature-a" })];
    const result = getOrphanedWorktreePathForThread(threads, ThreadId.makeUnsafe("thread-1"));
    expect(result).toBe("/tmp/repo/worktrees/feature-a");
  });

  it("returns null when another thread links to the same worktree", () => {
    const threads = [
      makeThread({
        id: ThreadId.makeUnsafe("thread-1"),
        worktreePath: "/tmp/repo/worktrees/feature-a",
      }),
      makeThread({
        id: ThreadId.makeUnsafe("thread-2"),
        worktreePath: "/tmp/repo/worktrees/feature-a",
      }),
    ];
    const result = getOrphanedWorktreePathForThread(threads, ThreadId.makeUnsafe("thread-1"));
    expect(result).toBeNull();
  });

  it("ignores threads linked to different worktrees", () => {
    const threads = [
      makeThread({
        id: ThreadId.makeUnsafe("thread-1"),
        worktreePath: "/tmp/repo/worktrees/feature-a",
      }),
      makeThread({
        id: ThreadId.makeUnsafe("thread-2"),
        worktreePath: "/tmp/repo/worktrees/feature-b",
      }),
    ];
    const result = getOrphanedWorktreePathForThread(threads, ThreadId.makeUnsafe("thread-1"));
    expect(result).toBe("/tmp/repo/worktrees/feature-a");
  });
});

describe("resolveWorktreeCleanupProjectCwd", () => {
  const projectA = {
    id: ProjectId.makeUnsafe("project-a"),
    cwd: "/repo-a",
  };
  const projectB = {
    id: ProjectId.makeUnsafe("project-b"),
    cwd: "/repo-b",
  };

  it("prefers the active thread's project cwd", () => {
    const result = resolveWorktreeCleanupProjectCwd({
      activeThreadId: ThreadId.makeUnsafe("thread-2"),
      projects: [projectA, projectB],
      threads: [
        { id: ThreadId.makeUnsafe("thread-1"), projectId: projectA.id },
        { id: ThreadId.makeUnsafe("thread-2"), projectId: projectB.id },
      ],
    });

    expect(result).toBe("/repo-b");
  });

  it("falls back to the first project when there is no active thread", () => {
    const result = resolveWorktreeCleanupProjectCwd({
      activeThreadId: null,
      projects: [projectA, projectB],
      threads: [],
    });

    expect(result).toBe("/repo-a");
  });

  it("returns null when there are no projects", () => {
    const result = resolveWorktreeCleanupProjectCwd({
      activeThreadId: null,
      projects: [],
      threads: [],
    });

    expect(result).toBeNull();
  });
});

describe("buildWorktreeCleanupCandidateStates", () => {
  it("marks candidates linked to threads as unavailable for deletion", () => {
    const states = buildWorktreeCleanupCandidateStates({
      candidates: [
        {
          path: "/repo/worktrees/feature-a",
          branch: "feature-a",
          prNumber: 12,
          prTitle: "Feature A",
          prUrl: "https://example.com/pr/12",
          mergedAt: "2026-04-06T12:00:00.000Z",
          pathExists: true,
          prunable: false,
        },
        {
          path: "/repo/worktrees/feature-b",
          branch: "feature-b",
          prNumber: 13,
          prTitle: "Feature B",
          prUrl: "https://example.com/pr/13",
          mergedAt: "2026-04-06T12:00:00.000Z",
          pathExists: false,
          prunable: true,
        },
      ],
      threadWorktreePaths: ["/repo/worktrees/feature-a", null],
    });

    expect(states).toEqual([
      {
        candidate: {
          path: "/repo/worktrees/feature-a",
          branch: "feature-a",
          prNumber: 12,
          prTitle: "Feature A",
          prUrl: "https://example.com/pr/12",
          mergedAt: "2026-04-06T12:00:00.000Z",
          pathExists: true,
          prunable: false,
        },
        usageCount: 1,
        canDelete: false,
      },
      {
        candidate: {
          path: "/repo/worktrees/feature-b",
          branch: "feature-b",
          prNumber: 13,
          prTitle: "Feature B",
          prUrl: "https://example.com/pr/13",
          mergedAt: "2026-04-06T12:00:00.000Z",
          pathExists: false,
          prunable: true,
        },
        usageCount: 0,
        canDelete: true,
      },
    ]);
  });
});

describe("formatBranchAge", () => {
  const now = new Date("2026-04-06T12:00:00.000Z");

  it("returns 'just now' for timestamps less than a minute ago", () => {
    expect(formatBranchAge("2026-04-06T11:59:30.000Z", now)).toBe("just now");
  });

  it("returns minutes for recent merges", () => {
    expect(formatBranchAge("2026-04-06T11:45:00.000Z", now)).toBe("15m ago");
  });

  it("returns hours for same-day merges", () => {
    expect(formatBranchAge("2026-04-06T05:00:00.000Z", now)).toBe("7h ago");
  });

  it("returns days for merges within a week", () => {
    expect(formatBranchAge("2026-04-03T12:00:00.000Z", now)).toBe("3d ago");
  });

  it("returns weeks for merges within a month", () => {
    expect(formatBranchAge("2026-03-16T12:00:00.000Z", now)).toBe("3w ago");
  });

  it("returns months for older merges", () => {
    expect(formatBranchAge("2026-01-06T12:00:00.000Z", now)).toBe("3mo ago");
  });

  it("returns 'just now' for future timestamps", () => {
    expect(formatBranchAge("2026-04-07T00:00:00.000Z", now)).toBe("just now");
  });
});

describe("formatWorktreePathForDisplay", () => {
  it("shows only the last path segment for unix-like paths", () => {
    const result = formatWorktreePathForDisplay(
      "/Users/julius/.okcode/worktrees/okcode-mvp/okcode-4e609bb8",
    );
    expect(result).toBe("okcode-4e609bb8");
  });

  it("normalizes windows separators before selecting the final segment", () => {
    const result = formatWorktreePathForDisplay(
      "C:\\Users\\julius\\.okcode\\worktrees\\okcode-mvp\\okcode-4e609bb8",
    );
    expect(result).toBe("okcode-4e609bb8");
  });

  it("uses the final segment even when outside ~/.okcode/worktrees", () => {
    const result = formatWorktreePathForDisplay("/tmp/custom-worktrees/my-worktree");
    expect(result).toBe("my-worktree");
  });

  it("ignores trailing slashes", () => {
    const result = formatWorktreePathForDisplay("/tmp/custom-worktrees/my-worktree/");
    expect(result).toBe("my-worktree");
  });
});
