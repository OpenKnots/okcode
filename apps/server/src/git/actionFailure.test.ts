import { describe, expect, it } from "vitest";
import { buildGitActionFailure } from "./actionFailure.ts";
import { GitCommandError, GitHubCliError } from "./Errors.ts";

describe("buildGitActionFailure", () => {
  it("classifies GitHub auth failures during PR creation", () => {
    const failure = buildGitActionFailure({
      action: "commit_push_pr",
      phase: "pr",
      error: new GitHubCliError({
        operation: "createPullRequest",
        detail: "GitHub CLI is not authenticated. Run `gh auth login` and retry.",
      }),
    });

    expect(failure.code).toBe("github_auth_required");
    expect(failure.title).toBe("Authenticate GitHub CLI");
    expect(failure.summary).toContain("branch was pushed");
    expect(failure.nextSteps).toContain("Run `gh auth login` in this environment.");
  });

  it("classifies protected branch push failures", () => {
    const failure = buildGitActionFailure({
      action: "commit_push",
      phase: "push",
      error: new GitCommandError({
        operation: "GitCore.pushCurrentBranch",
        command: "git push origin main",
        cwd: "/repo",
        detail: "remote: error: GH006: Protected branch update failed for refs/heads/main.",
      }),
    });

    expect(failure.code).toBe("branch_protected");
    expect(failure.title).toBe("Protected branch rejected the push");
    expect(failure.command).toBe("git push origin main");
  });

  it("classifies commit hook failures", () => {
    const failure = buildGitActionFailure({
      action: "commit",
      phase: "commit",
      error: new GitCommandError({
        operation: "GitCore.commit.commit",
        command: "git commit -m Fix",
        cwd: "/repo",
        detail: "pre-commit hook failed:\nlint errors found",
      }),
    });

    expect(failure.code).toBe("hook_failed");
    expect(failure.summary).toBe("A repository hook rejected the commit.");
    expect(failure.nextSteps[0]).toContain("Review the hook output");
  });
});
