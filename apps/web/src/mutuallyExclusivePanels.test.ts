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
    );
    expect(result).toBe("close-code-viewer");
  });

  // ─── Code viewer opens while diff is already open ──────────────────
  it("returns 'close-diff' when code viewer transitions open while diff is open", () => {
    const result = resolveExclusivePanelAction(
      /* prevDiffOpen */ true,
      /* diffOpen */ true,
      /* prevCodeViewerOpen */ false,
      /* codeViewerOpen */ true,
    );
    expect(result).toBe("close-diff");
  });

  // ─── No-op cases ──────────────────────────────────────────────────
  it("returns null when neither panel is open", () => {
    expect(resolveExclusivePanelAction(false, false, false, false)).toBeNull();
  });

  it("returns null when only diff is open (no transition)", () => {
    expect(resolveExclusivePanelAction(true, true, false, false)).toBeNull();
  });

  it("returns null when only code viewer is open (no transition)", () => {
    expect(resolveExclusivePanelAction(false, false, true, true)).toBeNull();
  });

  it("returns null when diff opens but code viewer is closed", () => {
    expect(resolveExclusivePanelAction(false, true, false, false)).toBeNull();
  });

  it("returns null when code viewer opens but diff is closed", () => {
    expect(resolveExclusivePanelAction(false, false, false, true)).toBeNull();
  });

  it("returns null when diff closes (code viewer still closed)", () => {
    expect(resolveExclusivePanelAction(true, false, false, false)).toBeNull();
  });

  it("returns null when code viewer closes (diff still closed)", () => {
    expect(resolveExclusivePanelAction(false, false, true, false)).toBeNull();
  });

  // ─── Edge: both were already open (no transition) ─────────────────
  it("returns null when both were already open (no transition)", () => {
    expect(resolveExclusivePanelAction(true, true, true, true)).toBeNull();
  });

  // ─── Edge: both transition open simultaneously ────────────────────
  it("prefers closing code viewer when both open simultaneously (diff wins)", () => {
    // Both transition false → true in the same tick. Diff check runs first,
    // so code viewer gets closed.
    const result = resolveExclusivePanelAction(false, true, false, true);
    expect(result).toBe("close-code-viewer");
  });
});
