import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sidebar file tree mounting", () => {
  it("keeps the workspace file tree mounted when the files section is collapsed", () => {
    const src = readFileSync(resolve(import.meta.dirname, "./Sidebar.tsx"), "utf8");

    expect(src).toContain("<WorkspaceFileTree");
    expect(src).toContain('className={cn(filesCollapsedByProject.has(project.id) && "hidden")}');
    expect(src).not.toContain("!filesCollapsedByProject.has(project.id) && (");
  });
});
