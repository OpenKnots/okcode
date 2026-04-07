import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sidebar file tree shortcut", () => {
  it("opens the right-panel file tree instead of mounting the tree inline", () => {
    const src = readFileSync(resolve(import.meta.dirname, "./Sidebar.tsx"), "utf8");

    expect(src).toContain('aria-label="Open file tree"');
    expect(src).toContain('useRightPanelStore.getState().open("files")');
    expect(src).not.toContain("<WorkspaceFileTree");
  });
});
