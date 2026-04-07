import { describe, expect, it } from "vitest";
import { resolveWorkspaceLayoutMode } from "./WorkspacePanel";

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
