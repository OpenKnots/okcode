import { describe, expect, it } from "vitest";
import { normalizeRightPanelTab } from "./rightPanelStore";

describe("normalizeRightPanelTab", () => {
  it("maps legacy files and editor tabs into the workspace tab", () => {
    expect(normalizeRightPanelTab("files")).toBe("workspace");
    expect(normalizeRightPanelTab("editor")).toBe("workspace");
  });

  it("preserves supported tabs and rejects invalid values", () => {
    expect(normalizeRightPanelTab("workspace")).toBe("workspace");
    expect(normalizeRightPanelTab("diffs")).toBe("diffs");
    expect(normalizeRightPanelTab("unknown")).toBeNull();
    expect(normalizeRightPanelTab(null)).toBeNull();
  });
});
