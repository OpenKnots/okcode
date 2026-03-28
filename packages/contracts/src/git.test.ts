import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  GitActionFailure,
  GitCreateWorktreeInput,
  GitPreparePullRequestThreadInput,
  GitRunStackedActionInput,
  GitResolvePullRequestResult,
  GitStatusResult,
} from "./git";

const decodeCreateWorktreeInput = Schema.decodeUnknownSync(GitCreateWorktreeInput);
const decodePreparePullRequestThreadInput = Schema.decodeUnknownSync(
  GitPreparePullRequestThreadInput,
);
const decodeRunStackedActionInput = Schema.decodeUnknownSync(GitRunStackedActionInput);
const decodeResolvePullRequestResult = Schema.decodeUnknownSync(GitResolvePullRequestResult);
const decodeGitStatusResult = Schema.decodeUnknownSync(GitStatusResult);
const decodeGitActionFailure = Schema.decodeUnknownSync(GitActionFailure);

describe("GitCreateWorktreeInput", () => {
  it("accepts omitted newBranch for existing-branch worktrees", () => {
    const parsed = decodeCreateWorktreeInput({
      cwd: "/repo",
      branch: "feature/existing",
      path: "/tmp/worktree",
    });

    expect(parsed.newBranch).toBeUndefined();
    expect(parsed.branch).toBe("feature/existing");
  });
});

describe("GitPreparePullRequestThreadInput", () => {
  it("accepts pull request references and mode", () => {
    const parsed = decodePreparePullRequestThreadInput({
      cwd: "/repo",
      reference: "#42",
      mode: "worktree",
    });

    expect(parsed.reference).toBe("#42");
    expect(parsed.mode).toBe("worktree");
  });
});

describe("GitResolvePullRequestResult", () => {
  it("decodes resolved pull request metadata", () => {
    const parsed = decodeResolvePullRequestResult({
      pullRequest: {
        number: 42,
        title: "PR threads",
        url: "https://github.com/pingdotgg/codething-mvp/pull/42",
        baseBranch: "main",
        headBranch: "feature/pr-threads",
        state: "open",
      },
    });

    expect(parsed.pullRequest.number).toBe(42);
    expect(parsed.pullRequest.headBranch).toBe("feature/pr-threads");
  });
});

describe("GitRunStackedActionInput", () => {
  it("requires a client-provided actionId for progress correlation", () => {
    const parsed = decodeRunStackedActionInput({
      actionId: "action-1",
      cwd: "/repo",
      action: "commit",
    });

    expect(parsed.actionId).toBe("action-1");
    expect(parsed.action).toBe("commit");
  });
});

describe("GitStatusResult", () => {
  it("decodes conflict metadata", () => {
    const parsed = decodeGitStatusResult({
      branch: "feature/conflicts",
      hasWorkingTreeChanges: true,
      hasConflicts: true,
      conflictedFiles: ["src/app.tsx"],
      workingTree: {
        files: [{ path: "src/app.tsx", insertions: 0, deletions: 0 }],
        insertions: 0,
        deletions: 0,
      },
      hasUpstream: true,
      aheadCount: 0,
      behindCount: 1,
      pr: null,
    });

    expect(parsed.hasConflicts).toBe(true);
    expect(parsed.conflictedFiles).toEqual(["src/app.tsx"]);
  });
});

describe("GitActionFailure", () => {
  it("decodes structured git action failure guidance", () => {
    const parsed = decodeGitActionFailure({
      code: "github_auth_required",
      phase: "pr",
      title: "Authenticate GitHub CLI",
      summary: "The branch was pushed, but GitHub CLI is not authenticated.",
      detail: "Run `gh auth login` and retry.",
      nextSteps: ["Run `gh auth login`.", "Retry the PR action."],
      operation: "createPullRequest",
      rawMessage: "GitHub CLI failed in createPullRequest: not logged in",
    });

    expect(parsed.code).toBe("github_auth_required");
    expect(parsed.phase).toBe("pr");
    expect(parsed.nextSteps).toHaveLength(2);
  });
});
