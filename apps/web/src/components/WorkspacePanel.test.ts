import { describe, expect, it } from "vitest";
import { resolveWorkspaceLayoutMode, resolveWorkspacePanelDirection } from "./WorkspacePanel";

describe("resolveWorkspaceLayoutMode", () => {
  it("stacks the tree above the editor in narrower panels", () => {
    expect(resolveWorkspaceLayoutMode(320)).toBe("stacked");
    expect(resolveWorkspaceLayoutMode(599)).toBe("stacked");
  });

  it("splits the tree and editor side by side once enough width is available", () => {
    expect(resolveWorkspaceLayoutMode(600)).toBe("split");
    expect(resolveWorkspaceLayoutMode(960)).toBe("split");
  });
});

describe("resolveWorkspacePanelDirection", () => {
  it("keeps split workspaces side by side while the tree is open", () => {
    expect(
      resolveWorkspacePanelDirection({
        layoutMode: "split",
        treeCollapsed: false,
      }),
    ).toBe("flex-row");
  });

  it("collapses the tree vertically even in split workspaces", () => {
    expect(
      resolveWorkspacePanelDirection({
        layoutMode: "split",
        treeCollapsed: true,
      }),
    ).toBe("flex-col");
  });

  it("stacks narrow workspaces vertically", () => {
    expect(
      resolveWorkspacePanelDirection({
        layoutMode: "stacked",
        treeCollapsed: false,
      }),
    ).toBe("flex-col");
  });
});
