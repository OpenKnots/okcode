import { ProjectId, ThreadId } from "@okcode/contracts";
import { describe, expect, it } from "vitest";

import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE, type Thread } from "./types";
import {
  formatBranchAge,
  formatWorktreePathForDisplay,
  getOrphanedWorktreePathForThread,
} from "./worktreeCleanup";

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: ThreadId.makeUnsafe("thread-1"),
    codexThreadId: null,
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
