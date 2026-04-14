import { describe, expect, it } from "vitest";

import {
  buildThreadErrorDiagnosticsCopy,
  humanizeThreadError,
  isAuthenticationThreadError,
} from "./threadError";

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
        "Claude Code must be authenticated with `claude auth login` before starting a session. API key and auth token credentials are not supported.",
      ),
    ).toBe(true);
  });

  it("does not classify unrelated failures as authentication errors", () => {
    expect(isAuthenticationThreadError("Provider crashed while starting.")).toBe(false);
  });

  it("builds redacted diagnostics copy without optional tips by default", () => {
    expect(
      buildThreadErrorDiagnosticsCopy(
        "Git command failed in GitCore.createWorktree: OPENAI_API_KEY=sk-proj-secret (/repo) - token=abc123",
      ),
    ).toBe(
      [
        "Message: Worktree thread could not start: token=[REDACTED]",
        "",
        "Technical details:",
        "Git command failed in GitCore.createWorktree: OPENAI_API_KEY=[REDACTED] (/repo) - token=[REDACTED]",
      ].join("\n"),
    );
  });

  it("adds troubleshooting tips when requested", () => {
    expect(
      buildThreadErrorDiagnosticsCopy(
        "Codex CLI is not authenticated. Run `codex login` and try again.",
        { includeTips: true },
      ),
    ).toContain("Troubleshooting:");
    expect(
      buildThreadErrorDiagnosticsCopy(
        "Claude Code must be authenticated with `claude auth login` before starting a session. API key and auth token credentials are not supported.",
        { includeTips: true },
      ),
    ).toContain("Run `claude auth login` and retry the turn.");
  });
});
