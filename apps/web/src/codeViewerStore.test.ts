import { beforeEach, describe, expect, it } from "vitest";

import { makeCodeViewerTabId, useCodeViewerStore } from "./codeViewerStore";

function resetCodeViewerStore() {
  useCodeViewerStore.setState({
    isOpen: false,
    tabs: [],
    activeTabId: null,
    pendingContext: null,
  });
}

describe("codeViewerStore", () => {
  beforeEach(() => {
    resetCodeViewerStore();
  });

  it("initializes draft state from loaded contents", () => {
    const tabId = useCodeViewerStore.getState().openFile("/repo", "src/index.ts");

    useCodeViewerStore.getState().initializeTabContents(tabId, "console.log('hello');");

    const tab = useCodeViewerStore.getState().tabs[0];
    expect(tab?.savedContents).toBe("console.log('hello');");
    expect(tab?.draftContents).toBe("console.log('hello');");
    expect(tab?.isDirty).toBe(false);
  });

  it("tracks dirty state from draft edits and clears it on successful save", () => {
    const tabId = useCodeViewerStore.getState().openFile("/repo", "src/index.ts");
    useCodeViewerStore.getState().initializeTabContents(tabId, "const value = 1;\n");

    useCodeViewerStore.getState().updateDraftContents(tabId, "const value = 2;\n");
    let tab = useCodeViewerStore.getState().tabs[0];
    expect(tab?.isDirty).toBe(true);
    expect(tab?.draftContents).toBe("const value = 2;\n");

    useCodeViewerStore.getState().markTabSaving(tabId);
    useCodeViewerStore.getState().completeTabSave(tabId, "const value = 2;\n");

    tab = useCodeViewerStore.getState().tabs[0];
    expect(tab?.isDirty).toBe(false);
    expect(tab?.isSaving).toBe(false);
    expect(tab?.savedContents).toBe("const value = 2;\n");
    expect(tab?.draftContents).toBe("const value = 2;\n");
  });

  it("preserves dirty edits when a save fails", () => {
    const tabId = useCodeViewerStore.getState().openFile("/repo", "src/index.ts");
    useCodeViewerStore.getState().initializeTabContents(tabId, "const value = 1;\n");
    useCodeViewerStore.getState().updateDraftContents(tabId, "const value = 3;\n");

    useCodeViewerStore.getState().markTabSaving(tabId);
    useCodeViewerStore.getState().failTabSave(tabId, "Disk full");

    const tab = useCodeViewerStore.getState().tabs[0];
    expect(tab?.isDirty).toBe(true);
    expect(tab?.isSaving).toBe(false);
    expect(tab?.draftContents).toBe("const value = 3;\n");
    expect(tab?.savedContents).toBe("const value = 1;\n");
    expect(tab?.lastSaveError).toBe("Disk full");
  });

  it("reverts draft contents back to the saved version", () => {
    const tabId = useCodeViewerStore.getState().openFile("/repo", "README.md");
    useCodeViewerStore.getState().initializeTabContents(tabId, "# Title\n");
    useCodeViewerStore.getState().updateDraftContents(tabId, "# Updated\n");

    useCodeViewerStore.getState().revertDraftContents(tabId);

    const tab = useCodeViewerStore.getState().tabs[0];
    expect(tab?.draftContents).toBe("# Title\n");
    expect(tab?.savedContents).toBe("# Title\n");
    expect(tab?.isDirty).toBe(false);
  });

  it("marks external changes instead of overwriting a dirty draft", () => {
    const tabId = useCodeViewerStore.getState().openFile("/repo", "src/index.ts");
    useCodeViewerStore.getState().initializeTabContents(tabId, "const value = 1;\n");
    useCodeViewerStore.getState().updateDraftContents(tabId, "const value = 2;\n");

    useCodeViewerStore.getState().initializeTabContents(tabId, "const value = 9;\n");

    const tab = useCodeViewerStore.getState().tabs[0];
    expect(tab?.draftContents).toBe("const value = 2;\n");
    expect(tab?.savedContents).toBe("const value = 1;\n");
    expect(tab?.hasExternalChange).toBe(true);
  });

  it("uses cwd-scoped tab ids to avoid collisions", () => {
    const first = useCodeViewerStore.getState().openFile("/repo-a", "src/index.ts");
    const second = useCodeViewerStore.getState().openFile("/repo-b", "src/index.ts");

    expect(first).toBe(makeCodeViewerTabId("/repo-a", "src/index.ts"));
    expect(second).toBe(makeCodeViewerTabId("/repo-b", "src/index.ts"));
    expect(useCodeViewerStore.getState().tabs).toHaveLength(2);
  });
});
