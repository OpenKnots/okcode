import type { ProjectId } from "@okcode/contracts";
import { describe, expect, it } from "vitest";

import { joinPath, projectLabel } from "./reviewUtils";

function makeProject(overrides: { id?: string; name: string; cwd: string }) {
  return {
    id: (overrides.id ?? "test-id") as ProjectId,
    name: overrides.name,
    cwd: overrides.cwd,
    model: "claude-opus-4",
    expanded: false,
    scripts: [],
  };
}

describe("projectLabel", () => {
  it("returns the project name when present", () => {
    expect(
      projectLabel(
        makeProject({ name: "okcode", cwd: "/Users/val/Documents/GitHub/OpenKnots/okcode" }),
      ),
    ).toBe("okcode");
  });

  it("falls back to cwd when name is empty", () => {
    expect(projectLabel(makeProject({ name: "", cwd: "/Users/val/projects/demo" }))).toBe(
      "/Users/val/projects/demo",
    );
  });

  it("falls back to cwd when name is only whitespace", () => {
    expect(projectLabel(makeProject({ name: "   ", cwd: "/opt/repos/app" }))).toBe(
      "/opt/repos/app",
    );
  });

  it("preserves the original name without trimming", () => {
    expect(projectLabel(makeProject({ name: " my-project ", cwd: "/tmp" }))).toBe(" my-project ");
  });
});

describe("joinPath", () => {
  it("joins base and relative path", () => {
    expect(joinPath("/Users/val/project", "src/index.ts")).toBe("/Users/val/project/src/index.ts");
  });

  it("strips trailing slashes from base", () => {
    expect(joinPath("/Users/val/project///", "src/index.ts")).toBe(
      "/Users/val/project/src/index.ts",
    );
  });

  it("strips leading slashes from relative path", () => {
    expect(joinPath("/Users/val/project", "///src/index.ts")).toBe(
      "/Users/val/project/src/index.ts",
    );
  });

  it("handles both trailing and leading slashes", () => {
    expect(joinPath("/base/", "/relative")).toBe("/base/relative");
  });
});
