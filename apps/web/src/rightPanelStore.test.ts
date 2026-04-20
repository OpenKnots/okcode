import { afterEach, describe, expect, it } from "vitest";
import { useRightPanelStore, normalizeRightPanelTab } from "./rightPanelStore";

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

describe("useRightPanelStore setActiveTab", () => {
  afterEach(() => {
    useRightPanelStore.setState({
      isOpen: false,
      activeTab: "workspace",
    });
  });

  it("can retarget the active tab without opening the panel", () => {
    useRightPanelStore.setState({
      isOpen: false,
      activeTab: "diffs",
    });

    useRightPanelStore.getState().setActiveTab("workspace", false);

    expect(useRightPanelStore.getState().activeTab).toBe("workspace");
    expect(useRightPanelStore.getState().isOpen).toBe(false);
  });
});
