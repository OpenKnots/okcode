import { describe, expect, it } from "vitest";

import { humanizeThreadError } from "./threadError";

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
});
