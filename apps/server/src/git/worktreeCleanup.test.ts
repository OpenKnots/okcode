import { describe, expect, it } from "vitest";

import { collectMergedWorktreeCleanupCandidates } from "./worktreeCleanup";

describe("collectMergedWorktreeCleanupCandidates", () => {
  it("includes only merged pull request worktrees and ignores root, blank, and branchless entries", () => {
    const candidates = collectMergedWorktreeCleanupCandidates({
      cwd: "/repo",
      worktreeListStdout: [
        "worktree /repo/",
        "branch refs/heads/feature-root",
        "",
        "worktree /repo/worktrees/feature-one",
        "branch refs/heads/feature-one",
        "",
        "worktree /repo/worktrees/feature-two",
        "branch refs/heads/feature-two",
        "prunable gitdir file points to non-existent location",
        "",
        "worktree /repo/worktrees/no-branch",
        "HEAD abcdef1234567890",
        "",
        "worktree   ",
        "branch refs/heads/feature-blank-path",
        "",
      ].join("\n"),
      mergedPullRequests: [
        {
          number: 101,
          title: "Root PR",
          url: "https://example.com/pr/101",
          headBranch: "feature-root",
          mergedAt: "2026-03-01T00:00:00.000Z",
        },
        {
          number: 102,
          title: "Feature one",
          url: "https://example.com/pr/102",
          headBranch: "feature-one",
          mergedAt: "2026-03-02T00:00:00.000Z",
        },
        {
          number: 103,
          title: "Feature two",
          url: "https://example.com/pr/103",
          headBranch: "feature-two",
          mergedAt: "2026-03-03T00:00:00.000Z",
        },
        {
          number: 104,
          title: "Blank path",
          url: "https://example.com/pr/104",
          headBranch: "feature-blank-path",
          mergedAt: "2026-03-04T00:00:00.000Z",
        },
      ],
    });

    expect(candidates).toEqual([
      {
        path: "/repo/worktrees/feature-one",
        branch: "feature-one",
        prNumber: 102,
        prTitle: "Feature one",
        prUrl: "https://example.com/pr/102",
        mergedAt: "2026-03-02T00:00:00.000Z",
        pathExists: true,
        prunable: false,
      },
      {
        path: "/repo/worktrees/feature-two",
        branch: "feature-two",
        prNumber: 103,
        prTitle: "Feature two",
        prUrl: "https://example.com/pr/103",
        mergedAt: "2026-03-03T00:00:00.000Z",
        pathExists: false,
        prunable: true,
      },
    ]);
  });

  it("marks prunable entries as missing paths", () => {
    const [candidate] = collectMergedWorktreeCleanupCandidates({
      cwd: "/repo",
      worktreeListStdout: [
        "worktree /repo/worktrees/feature-missing",
        "branch refs/heads/feature-missing",
        "prunable gitdir file points to non-existent location",
        "",
      ].join("\n"),
      mergedPullRequests: [
        {
          number: 201,
          title: "Missing worktree",
          url: "https://example.com/pr/201",
          headBranch: "feature-missing",
          mergedAt: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    expect(candidate).toMatchObject({
      branch: "feature-missing",
      pathExists: false,
      prunable: true,
    });
  });

  it("sorts by existing paths first, then mergedAt descending, then branch name", () => {
    const candidates = collectMergedWorktreeCleanupCandidates({
      cwd: "/repo",
      worktreeListStdout: [
        "worktree /repo/worktrees/feature-beta",
        "branch refs/heads/feature-beta",
        "",
        "worktree /repo/worktrees/feature-missing",
        "branch refs/heads/feature-missing",
        "prunable gitdir file points to non-existent location",
        "",
        "worktree /repo/worktrees/feature-recent",
        "branch refs/heads/feature-recent",
        "",
        "worktree /repo/worktrees/feature-alpha",
        "branch refs/heads/feature-alpha",
        "",
      ].join("\n"),
      mergedPullRequests: [
        {
          number: 301,
          title: "Feature beta",
          url: "https://example.com/pr/301",
          headBranch: "feature-beta",
          mergedAt: "2026-03-01T12:00:00.000Z",
        },
        {
          number: 302,
          title: "Feature missing",
          url: "https://example.com/pr/302",
          headBranch: "feature-missing",
          mergedAt: "2026-04-01T12:00:00.000Z",
        },
        {
          number: 303,
          title: "Feature recent",
          url: "https://example.com/pr/303",
          headBranch: "feature-recent",
          mergedAt: "2026-03-02T12:00:00.000Z",
        },
        {
          number: 304,
          title: "Feature alpha",
          url: "https://example.com/pr/304",
          headBranch: "feature-alpha",
          mergedAt: "2026-03-01T12:00:00.000Z",
        },
      ],
    });

    expect(candidates.map((candidate) => candidate.branch)).toEqual([
      "feature-recent",
      "feature-alpha",
      "feature-beta",
      "feature-missing",
    ]);
  });
});
