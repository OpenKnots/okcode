import { describe, expect, it } from "vitest";

import {
  decodePrReviewLocalCommandAction,
  encodePrReviewLocalCommandAction,
  parseGitHubRepositoryNameWithOwnerFromRemoteUrl,
} from "./localProfiles";

describe("prReview local profiles", () => {
  it("parses GitHub HTTPS and SSH remotes", () => {
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("https://github.com/openclaw/openclaw.git"),
    ).toBe("openclaw/openclaw");
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("git@github.com:OpenClaw/maintainers.git"),
    ).toBe("OpenClaw/maintainers");
  });

  it("round-trips encoded local command actions", () => {
    const encoded = encodePrReviewLocalCommandAction({
      kind: "localCommand",
      cwd: "/Users/val/Documents/GitHub/OpenClaw/maintainers",
      args: ["scripts/pr-review", "{{prNumber}}"],
      label: "review-pr",
    });

    expect(decodePrReviewLocalCommandAction(encoded)).toEqual({
      kind: "localCommand",
      cwd: "/Users/val/Documents/GitHub/OpenClaw/maintainers",
      args: ["scripts/pr-review", "{{prNumber}}"],
      label: "review-pr",
    });
  });

  it("rejects malformed encoded local command actions", () => {
    expect(decodePrReviewLocalCommandAction("okcode:local-command:not-base64")).toBeNull();
    expect(decodePrReviewLocalCommandAction("scripts/pr-review 123")).toBeNull();
  });
});
