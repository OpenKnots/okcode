import { describe, expect, it } from "vitest";

import { hasBlockingPreviewOverlay, PreviewPanel } from "./PreviewPanel";

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
