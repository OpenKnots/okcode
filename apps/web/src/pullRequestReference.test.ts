import { describe, expect, it } from "vitest";

import { parsePullRequestReference, parsePullRequestReferenceParts } from "./pullRequestReference";

describe("parsePullRequestReference", () => {
  it("accepts GitHub pull request URLs", () => {
    expect(parsePullRequestReference("https://github.com/pingdotgg/okcode/pull/42")).toBe(
      "https://github.com/pingdotgg/okcode/pull/42",
    );
  });

  it("extracts repository metadata from GitHub pull request URLs", () => {
    expect(
      parsePullRequestReferenceParts("https://github.com/pingdotgg/okcode/pull/42/files"),
    ).toEqual({
      kind: "url",
      reference: "https://github.com/pingdotgg/okcode/pull/42/files",
      number: "42",
      owner: "pingdotgg",
      repo: "okcode",
    });
  });

  it("accepts raw numbers", () => {
    expect(parsePullRequestReference("42")).toBe("42");
  });

  it("accepts #number references", () => {
    expect(parsePullRequestReference("#42")).toBe("#42");
  });

  it("rejects non-pull-request input", () => {
    expect(parsePullRequestReference("feature/my-branch")).toBeNull();
  });
});
