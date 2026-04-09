import { describe, expect, it } from "vitest";

import { humanizeThreadError, isAuthenticationThreadError } from "./threadError";

describe("humanizeThreadError", () => {
  it("summarizes worktree creation failures into a user-facing message", () => {
    const raw =
      "Git command failed in GitCore.createWorktree: git worktree add -b wt-missing-base /tmp/wt main (/repo) - Base branch 'main' does not resolve to a commit yet. Available branches: master. Create the first commit or select a different branch before starting a worktree thread.";

    expect(humanizeThreadError(raw)).toEqual({
      title: "Worktree thread could not start",
      description:
        "Base branch 'main' does not resolve to a commit yet. Available branches: master. Create the first commit or select a different branch before starting a worktree thread.",
      technicalDetails: raw,
    });
  });

  it("passes through non-worktree errors unchanged", () => {
    expect(humanizeThreadError("Something else went wrong.")).toEqual({
      title: null,
      description: "Something else went wrong.",
      technicalDetails: null,
    });
  });

  it("redacts secret-like values before presenting thread errors", () => {
    expect(
      humanizeThreadError(
        "Git command failed in GitCore.createWorktree: OPENAI_API_KEY=sk-proj-secret (/repo) - token=abc123",
      ),
    ).toEqual({
      title: "Worktree thread could not start",
      description: "token=[REDACTED]",
      technicalDetails:
        "Git command failed in GitCore.createWorktree: OPENAI_API_KEY=[REDACTED] (/repo) - token=[REDACTED]",
    });
  });

  it("detects provider authentication failures", () => {
    expect(
      isAuthenticationThreadError(
        "Codex CLI is not authenticated. Run `codex login` and try again.",
      ),
    ).toBe(true);
    expect(
      isAuthenticationThreadError(
        "Claude is not authenticated. Run `claude auth login` and try again.",
      ),
    ).toBe(true);
  });

  it("does not classify unrelated failures as authentication errors", () => {
    expect(isAuthenticationThreadError("Provider crashed while starting.")).toBe(false);
  });
});
