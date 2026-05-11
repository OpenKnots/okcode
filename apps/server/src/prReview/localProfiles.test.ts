import { describe, expect, it } from "vitest";

import {
  decodePrReviewLocalCommandAction,
  encodePrReviewLocalCommandAction,
  parseGitHubRepositoryNameWithOwnerFromRemoteUrl,
} from "./localProfiles";

describe("prReview local profiles", () => {
  it("parses GitHub HTTPS and SSH remotes", () => {
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("https://github.com/acme/acme.git"),
    ).toBe("acme/acme");
    expect(
      parseGitHubRepositoryNameWithOwnerFromRemoteUrl("git@github.com:Acme/maintainers.git"),
    ).toBe("Acme/maintainers");
  });

  it("round-trips encoded local command actions", () => {
    const encoded = encodePrReviewLocalCommandAction({
      kind: "localCommand",
      cwd: "/Users/val/Documents/GitHub/Acme/maintainers",
      args: ["scripts/pr-review", "{{prNumber}}"],
      label: "review-pr",
    });

    expect(decodePrReviewLocalCommandAction(encoded)).toEqual({
      kind: "localCommand",
      cwd: "/Users/val/Documents/GitHub/Acme/maintainers",
      args: ["scripts/pr-review", "{{prNumber}}"],
      label: "review-pr",
    });
  });

  it("rejects malformed encoded local command actions", () => {
    expect(decodePrReviewLocalCommandAction("okcode:local-command:not-base64")).toBeNull();
    expect(decodePrReviewLocalCommandAction("scripts/pr-review 123")).toBeNull();
  });
});
