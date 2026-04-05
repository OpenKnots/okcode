import { describe, expect, it } from "vitest";

import {
  buildConflictFeedbackPreview,
  buildConflictRecommendation,
  computeActiveStepIndex,
  groupConflictCandidatesByFile,
  humanizeConflictError,
  pickRecommendedConflictCandidate,
  pullRequestStateBadgeClassName,
  workspaceModeLabel,
} from "./MergeConflictShell.logic";

describe("pickRecommendedConflictCandidate", () => {
  it("prefers deterministic candidates", () => {
    expect(
      pickRecommendedConflictCandidate({
        candidates: [
          {
            id: "src/demo.ts:review",
            path: "src/demo.ts",
            title: "Prefer current side",
            description: "Review candidate",
            confidence: "review",
            previewPatch: "const review = true;\n",
          },
          {
            id: "src/demo.ts:safe",
            path: "src/demo.ts",
            title: "Take theirs",
            description: "Safe candidate",
            confidence: "safe",
            previewPatch: "const safe = true;\n",
          },
        ],
      })?.id,
    ).toBe("src/demo.ts:safe");
  });
});

describe("groupConflictCandidatesByFile", () => {
  it("keeps deterministic candidates first within a file group", () => {
    const groups = groupConflictCandidatesByFile([
      {
        id: "src/b.ts:review",
        path: "src/b.ts",
        title: "Prefer incoming side",
        description: "Review candidate",
        confidence: "review",
        previewPatch: "incoming\n",
      },
      {
        id: "src/b.ts:safe",
        path: "src/b.ts",
        title: "Take ours",
        description: "Safe candidate",
        confidence: "safe",
        previewPatch: "ours\n",
      },
      {
        id: "src/a.ts:review",
        path: "src/a.ts",
        title: "Prefer current side",
        description: "Review candidate",
        confidence: "review",
        previewPatch: "current\n",
      },
    ]);

    expect(groups.map((group) => group.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(groups[1]?.candidates.map((candidate) => candidate.id)).toEqual([
      "src/b.ts:safe",
      "src/b.ts:review",
    ]);
  });
});

describe("buildConflictRecommendation", () => {
  it("guides the user to prepare a local workspace when GitHub is conflicting but no candidates exist", () => {
    expect(
      buildConflictRecommendation({
        analysis: {
          status: "conflicted",
          mergeableState: "CONFLICTING",
          summary: "GitHub reports merge conflicts.",
          candidates: [],
        },
        hasPreparedWorkspace: false,
      }),
    ).toMatchObject({
      tone: "warning",
      title: "Prepare a local workspace to continue.",
      recommendedAction: "prepare-worktree",
    });
  });

  it("recommends reviewing the candidate when a safe resolution is ready", () => {
    expect(
      buildConflictRecommendation({
        analysis: {
          status: "conflicted",
          mergeableState: "CONFLICTING",
          summary: "GitHub reports merge conflicts.",
          candidates: [
            {
              id: "src/auth.ts:safe",
              path: "src/auth.ts",
              title: "Take theirs",
              description: "Safe candidate",
              confidence: "safe",
              previewPatch: "const safe = true;\n",
            },
          ],
        },
        hasPreparedWorkspace: true,
      }),
    ).toMatchObject({
      tone: "success",
      title: "Recommended resolution is ready.",
      recommendedAction: "review-candidate",
    });
  });

  it("recommends capturing a note when workspace is prepared but no candidates are available", () => {
    expect(
      buildConflictRecommendation({
        analysis: {
          status: "conflicted",
          mergeableState: "CONFLICTING",
          summary: "GitHub reports merge conflicts.",
          candidates: [],
        },
        hasPreparedWorkspace: true,
      }),
    ).toMatchObject({
      tone: "warning",
      title: "Manual merge work is still required.",
      recommendedAction: "capture-note",
    });
  });
});

describe("humanizeConflictError", () => {
  it("recognises the 'already checked out' error pattern", () => {
    const result = humanizeConflictError(
      "Error: Git manager failed in preparePullRequestThread: This PR branch is already checked out in the main repo.",
    );
    expect(result.summary).toBe("Branch already checked out");
    expect(result.detail).toContain("worktree");
  });

  it("recognises the 'not a git repository' pattern", () => {
    const result = humanizeConflictError(
      "fatal: not a git repository (or any parent up to mount point /)",
    );
    expect(result.summary).toBe("Not a git repository");
  });

  it("recognises when a conflict candidate has gone stale", () => {
    const result = humanizeConflictError(
      "PrReview failed in applyConflictResolution: Conflict candidate not found: src/auth.ts:ours",
    );
    expect(result.summary).toBe("Conflict candidate is out of date");
    expect(result.detail).toContain("Refresh the conflict analysis");
  });

  it("falls back to stripping the prefix and using the first sentence", () => {
    const result = humanizeConflictError(
      "Git manager failed in preparePullRequestThread: Something unexpected happened. More details here.",
    );
    expect(result.summary).toBe("Something unexpected happened.");
    expect(result.detail).toContain("Git manager failed");
  });
});

describe("computeActiveStepIndex", () => {
  it("returns the index of the first non-done step", () => {
    expect(
      computeActiveStepIndex([
        { status: "done" },
        { status: "done" },
        { status: "blocked" },
        { status: "todo" },
      ]),
    ).toBe(2);
  });

  it("returns steps.length when all steps are done", () => {
    expect(computeActiveStepIndex([{ status: "done" }, { status: "done" }])).toBe(2);
  });

  it("returns 0 when no steps are done", () => {
    expect(computeActiveStepIndex([{ status: "todo" }, { status: "todo" }])).toBe(0);
  });
});

describe("buildConflictFeedbackPreview", () => {
  it("builds a human-readable brief", () => {
    expect(
      buildConflictFeedbackPreview({
        disposition: "review",
        note: "Keep the API signature from the incoming branch.",
        pullRequest: {
          number: 42,
          title: "Unify auth boundary",
          url: "https://github.com/acme/app/pull/42",
          baseBranch: "main",
          headBranch: "feature/auth",
          state: "open",
        },
        selectedCandidate: {
          id: "src/auth.ts:theirs",
          path: "src/auth.ts",
          title: "Prefer incoming side",
          description: "Review-required candidate using the incoming side.",
          confidence: "review",
          previewPatch: "export const auth = true;\n",
        },
        workspaceLabel: "Dedicated worktree",
      }),
    ).toContain("Operator note: Keep the API signature from the incoming branch.");
  });
});

describe("workspaceModeLabel", () => {
  it('returns "Repo scan" when no workspace is prepared', () => {
    expect(workspaceModeLabel(null)).toBe("Repo scan");
  });

  it('returns "Prepared in repo" for local mode', () => {
    expect(
      workspaceModeLabel({
        branch: "feature/auth",
        cwd: "/Users/val/project",
        mode: "local",
        worktreePath: null,
      }),
    ).toBe("Prepared in repo");
  });

  it('returns "Dedicated worktree" for worktree mode', () => {
    expect(
      workspaceModeLabel({
        branch: "feature/auth",
        cwd: "/Users/val/.git/worktrees/auth",
        mode: "worktree",
        worktreePath: "/Users/val/.git/worktrees/auth",
      }),
    ).toBe("Dedicated worktree");
  });
});

describe("pullRequestStateBadgeClassName", () => {
  it("returns emerald styling for open PRs", () => {
    const result = pullRequestStateBadgeClassName("open");
    expect(result).toContain("emerald");
    expect(result).not.toContain("muted");
  });

  it("returns muted styling for merged PRs", () => {
    const result = pullRequestStateBadgeClassName("merged");
    expect(result).toContain("muted");
    expect(result).not.toContain("emerald");
  });

  it("returns muted styling for closed PRs", () => {
    const result = pullRequestStateBadgeClassName("closed");
    expect(result).toContain("muted");
  });

  it("returns identical styling for merged and closed states", () => {
    expect(pullRequestStateBadgeClassName("merged")).toBe(pullRequestStateBadgeClassName("closed"));
  });
});
