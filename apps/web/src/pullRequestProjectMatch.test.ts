import { describe, expect, it } from "vitest";

import { findProjectMatchingPullRequestReference } from "./pullRequestProjectMatch";
import type { Project } from "./types";

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "project-1" as Project["id"],
    name: "Demo Repo",
    cwd: "/Users/buns/projects/demo-repo",
    model: "gpt-5.4",
    expanded: false,
    scripts: [],
    ...overrides,
  };
}

describe("findProjectMatchingPullRequestReference", () => {
  it("matches pull request URLs against the project name", () => {
    const projects = [
      makeProject({ id: "project-1" as Project["id"], name: "Psi Claw" }),
      makeProject({ id: "project-2" as Project["id"], name: "Another Repo" }),
    ];

    expect(
      findProjectMatchingPullRequestReference(
        projects,
        "https://github.com/OpenKnots/psi-claw/pull/137",
      )?.id,
    ).toBe("project-1");
  });

  it("falls back to the cwd basename when the project name does not match", () => {
    const projects = [
      makeProject({
        id: "project-1" as Project["id"],
        name: "Workspace",
        cwd: "/Users/buns/Documents/GitHub/PsiClaw/psi-claw",
      }),
    ];

    expect(
      findProjectMatchingPullRequestReference(
        projects,
        "https://github.com/OpenKnots/psi-claw/pull/137",
      )?.id,
    ).toBe("project-1");
  });

  it("returns null for numeric pull request references", () => {
    const projects = [makeProject({ id: "project-1" as Project["id"] })];

    expect(findProjectMatchingPullRequestReference(projects, "#137")).toBeNull();
    expect(findProjectMatchingPullRequestReference(projects, "137")).toBeNull();
  });

  it("returns null when no local project matches the URL repository", () => {
    const projects = [makeProject({ id: "project-1" as Project["id"], name: "okcode" })];

    expect(
      findProjectMatchingPullRequestReference(
        projects,
        "https://github.com/OpenKnots/psi-claw/pull/137",
      ),
    ).toBeNull();
  });

  it("returns null when multiple projects match the same repository slug", () => {
    const projects = [
      makeProject({
        id: "project-1" as Project["id"],
        name: "Psi Claw",
        cwd: "/Users/buns/projects/psi-claw",
      }),
      makeProject({
        id: "project-2" as Project["id"],
        name: "Psi Claw",
        cwd: "/Users/buns/projects/psi-claw-copy",
      }),
    ];

    expect(
      findProjectMatchingPullRequestReference(
        projects,
        "https://github.com/OpenKnots/psi-claw/pull/137",
      ),
    ).toBeNull();
  });
});
