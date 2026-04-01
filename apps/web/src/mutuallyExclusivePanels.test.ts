import { describe, expect, it } from "vitest";

import { resolveExclusivePanelAction } from "./mutuallyExclusivePanels";

describe("resolveExclusivePanelAction", () => {
  // ─── Diff opens while code viewer is already open ──────────────────
  it("returns 'close-code-viewer' when diff transitions open while code viewer is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ false,
      /* diffOpen */ true,
      /* prevCodeViewerOpen */ true,
      /* codeViewerOpen */ true,
      /* prevPreviewOpen */ false,
      /* previewOpen */ false,
    );
    expect(result).toEqual(["close-code-viewer"]);
  });

  // ─── Code viewer opens while diff is already open ──────────────────
  it("returns 'close-diff' when code viewer transitions open while diff is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ true,
      /* diffOpen */ true,
      /* prevCodeViewerOpen */ false,
      /* codeViewerOpen */ true,
      /* prevPreviewOpen */ false,
      /* previewOpen */ false,
    );
    expect(result).toEqual(["close-diff"]);
  });

  // ─── Preview opens while diff is already open ──────────────────────
  it("returns 'close-diff' when preview transitions open while diff is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ true,
      /* diffOpen */ true,
      /* prevCodeViewerOpen */ false,
      /* codeViewerOpen */ false,
      /* prevPreviewOpen */ false,
      /* previewOpen */ true,
    );
    expect(result).toEqual(["close-diff"]);
  });

  // ─── Preview opens while code viewer is already open ───────────────
  it("returns 'close-code-viewer' when preview transitions open while code viewer is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ false,
      /* diffOpen */ false,
      /* prevCodeViewerOpen */ true,
      /* codeViewerOpen */ true,
      /* prevPreviewOpen */ false,
      /* previewOpen */ true,
    );
    expect(result).toEqual(["close-code-viewer"]);
  });

  // ─── Diff opens while preview is already open ──────────────────────
  it("returns 'close-preview' when diff transitions open while preview is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ false,
      /* diffOpen */ true,
      /* prevCodeViewerOpen */ false,
      /* codeViewerOpen */ false,
      /* prevPreviewOpen */ true,
      /* previewOpen */ true,
    );
    expect(result).toEqual(["close-preview"]);
  });

  // ─── Code viewer opens while preview is already open ───────────────
  it("returns 'close-preview' when code viewer transitions open while preview is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ false,
      /* diffOpen */ false,
      /* prevCodeViewerOpen */ false,
      /* codeViewerOpen */ true,
      /* prevPreviewOpen */ true,
      /* previewOpen */ true,
    );
    expect(result).toEqual(["close-preview"]);
  });

  // ─── Diff opens while both code viewer and preview are open ────────
  it("closes both code viewer and preview when diff opens", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ false,
      /* diffOpen */ true,
      /* prevCodeViewerOpen */ true,
      /* codeViewerOpen */ true,
      /* prevPreviewOpen */ true,
      /* previewOpen */ true,
    );
    expect(result).toEqual(expect.arrayContaining(["close-code-viewer", "close-preview"]));
    expect(result).toHaveLength(2);
  });

  // ─── No-op cases ──────────────────────────────────────────────────
  it("returns empty array when no panels are open", () => {
    expect(resolveExclusivePanelAction(false, false, false, false, false, false)).toEqual([]);
  });

  it("returns empty array when only diff is open (no transition)", () => {
    expect(resolveExclusivePanelAction(true, true, false, false, false, false)).toEqual([]);
  });

  it("returns empty array when only code viewer is open (no transition)", () => {
    expect(resolveExclusivePanelAction(false, false, true, true, false, false)).toEqual([]);
  });

  it("returns empty array when only preview is open (no transition)", () => {
    expect(resolveExclusivePanelAction(false, false, false, false, true, true)).toEqual([]);
  });

  it("returns empty array when diff opens but no other panels are open", () => {
    expect(resolveExclusivePanelAction(false, true, false, false, false, false)).toEqual([]);
  });

  it("returns empty array when code viewer opens but no other panels are open", () => {
    expect(resolveExclusivePanelAction(false, false, false, true, false, false)).toEqual([]);
  });

  it("returns empty array when preview opens but no other panels are open", () => {
    expect(resolveExclusivePanelAction(false, false, false, false, false, true)).toEqual([]);
  });

  it("returns empty array when diff closes (others still closed)", () => {
    expect(resolveExclusivePanelAction(true, false, false, false, false, false)).toEqual([]);
  });

  it("returns empty array when code viewer closes (others still closed)", () => {
    expect(resolveExclusivePanelAction(false, false, true, false, false, false)).toEqual([]);
  });

  it("returns empty array when preview closes (others still closed)", () => {
    expect(resolveExclusivePanelAction(false, false, false, false, true, false)).toEqual([]);
  });

  // ─── Edge: all were already open (no transition) ───────────────────
  it("returns empty array when all were already open (no transition)", () => {
    expect(resolveExclusivePanelAction(true, true, true, true, true, true)).toEqual([]);
  });

  // ─── Edge: both diff and code viewer transition open simultaneously ─
  it("prefers closing code viewer when diff and code viewer open simultaneously (diff wins)", () => {
    const result = resolveExclusivePanelAction(false, true, false, true, false, false);
    expect(result).toEqual(["close-code-viewer"]);
  });

  // ─── Simulation panel tests ──────────────────────────────────────
  it("returns 'close-simulation' when diff transitions open while simulation is open", () => {
    const result = resolveExclusivePanelAction(
      false,
      true,
      false,
      false,
      false,
      false,
      /* prevSimulationOpen */ true,
      /* simulationOpen */ true,
    );
    expect(result).toEqual(["close-simulation"]);
  });

  it("closes diff, code viewer, and preview when simulation opens", () => {
    const result = resolveExclusivePanelAction(
      true,
      true,
      true,
      true,
      true,
      true,
      /* prevSimulationOpen */ false,
      /* simulationOpen */ true,
    );
    expect(result).toEqual(
      expect.arrayContaining(["close-diff", "close-code-viewer", "close-preview"]),
    );
    expect(result).toHaveLength(3);
  });

  it("returns empty array when simulation opens but no other panels are open", () => {
    const result = resolveExclusivePanelAction(
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    );
    expect(result).toEqual([]);
  });

  it("returns empty array when only simulation is open (no transition)", () => {
    const result = resolveExclusivePanelAction(
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      true,
    );
    expect(result).toEqual([]);
  });

  it("closes simulation when code viewer opens", () => {
    const result = resolveExclusivePanelAction(false, false, false, true, false, false, true, true);
    expect(result).toEqual(["close-simulation"]);
  });

  it("closes simulation when preview opens", () => {
    const result = resolveExclusivePanelAction(false, false, false, false, false, true, true, true);
    expect(result).toEqual(["close-simulation"]);
  });

  it("backward-compatible: works without simulation args", () => {
    const result = resolveExclusivePanelAction(false, true, true, true, false, false);
    expect(result).toEqual(["close-code-viewer"]);
  });
});
