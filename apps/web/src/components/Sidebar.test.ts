import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sidebar file tree shortcut", () => {
  it("opens the right-panel workspace instead of mounting the tree inline", () => {
    const src = readFileSync(resolve(import.meta.dirname, "./Sidebar.tsx"), "utf8");

    expect(src).toContain('aria-label="Open workspace"');
    expect(src).toContain('useRightPanelStore.getState().open("workspace")');
    expect(src).not.toContain("<WorkspaceFileTree");
  });

  it("uses the project context menu for renaming instead of double click", () => {
    const src = readFileSync(resolve(import.meta.dirname, "./Sidebar.tsx"), "utf8");

    expect(src).toContain('{ id: "rename", label: "Rename project" }');
    expect(src).toContain("onContextMenu={(event) => {");
    expect(src).not.toContain("onDoubleClick={(e) => {");
  });
});
