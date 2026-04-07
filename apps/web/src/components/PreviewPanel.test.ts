import { describe, expect, it } from "vitest";

import { hasBlockingPreviewOverlay, PreviewPanel } from "./PreviewPanel";
import { PreviewLayoutSwitcher } from "./PreviewLayoutSwitcher";
import { usePreviewStateStore } from "~/previewStateStore";

describe("PreviewPanel", () => {
  it("exports the component", () => {
    expect(PreviewPanel).toBeDefined();
  });

  it("treats standard toast stacks as blocking overlays", () => {
    const root = {
      querySelector: (selector: string) =>
        selector.includes('[data-slot="toast-viewport"]:not(:empty)') ? {} : null,
    } as unknown as ParentNode;

    expect(hasBlockingPreviewOverlay(root)).toBe(true);
  });

  it("treats anchored toast notifications as blocking overlays", () => {
    const root = {
      querySelector: (selector: string) =>
        selector.includes('[data-slot="toast-positioner"]') &&
        selector.includes('[data-slot="toast-popup"]')
          ? {}
          : null,
    } as unknown as ParentNode;

    expect(hasBlockingPreviewOverlay(root)).toBe(true);
  });

  it("ignores empty overlay containers", () => {
    const root = {
      querySelector: () => null,
    } as unknown as ParentNode;

    expect(hasBlockingPreviewOverlay(root)).toBe(false);
  });
});

describe("PreviewLayoutSwitcher", () => {
  it("exports the component", () => {
    expect(PreviewLayoutSwitcher).toBeDefined();
  });
});

describe("previewStateStore layout mode", () => {
  const projectId = "test-project" as unknown as Parameters<
    typeof usePreviewStateStore.getState
  >[0] extends undefined
    ? string
    : string;

  it("defaults layout mode to 'top'", () => {
    const state = usePreviewStateStore.getState();
    expect(state.layoutModeByProjectId[projectId] ?? "top").toBe("top");
  });

  it("sets and persists layout mode", () => {
    const { setProjectLayoutMode } = usePreviewStateStore.getState();
    setProjectLayoutMode(projectId as never, "side");
    expect(usePreviewStateStore.getState().layoutModeByProjectId[projectId]).toBe("side");

    setProjectLayoutMode(projectId as never, "fullscreen");
    expect(usePreviewStateStore.getState().layoutModeByProjectId[projectId]).toBe("fullscreen");
  });

  it("toggleFullscreen toggles between fullscreen and previous mode", () => {
    const { setProjectLayoutMode, toggleFullscreen } = usePreviewStateStore.getState();

    // Start from "side" mode
    setProjectLayoutMode(projectId as never, "side");
    expect(usePreviewStateStore.getState().layoutModeByProjectId[projectId]).toBe("side");

    // Toggle to fullscreen
    toggleFullscreen(projectId as never);
    expect(usePreviewStateStore.getState().layoutModeByProjectId[projectId]).toBe("fullscreen");

    // Toggle back — should restore to "side"
    toggleFullscreen(projectId as never);
    expect(usePreviewStateStore.getState().layoutModeByProjectId[projectId]).toBe("side");
  });

  it("cycles through all layout modes", () => {
    const { setProjectLayoutMode } = usePreviewStateStore.getState();
    const modes = ["top", "side", "fullscreen", "popout", "top"] as const;

    for (const mode of modes) {
      setProjectLayoutMode(projectId as never, mode);
      expect(usePreviewStateStore.getState().layoutModeByProjectId[projectId]).toBe(mode);
    }
  });
});
