import { create } from "zustand";

export type CodeViewerMode = "view" | "edit";

export interface CodeViewerTab {
  tabId: string;
  cwd: string;
  relativePath: string;
  label: string;
  savedContents: string | null;
  draftContents: string | null;
  isDirty: boolean;
  isSaving: boolean;
  lastSaveError: string | null;
  mode: CodeViewerMode;
  hasExternalChange: boolean;
}

export interface CodeViewerPendingContext {
  filePath: string;
  fromLine: number;
  toLine: number;
}

interface CodeViewerState {
  isOpen: boolean;
  tabs: CodeViewerTab[];
  activeTabId: string | null;
  pendingContext: CodeViewerPendingContext | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openFile: (cwd: string, relativePath: string, mode?: CodeViewerMode) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;
  setPendingContext: (ctx: CodeViewerPendingContext) => void;
  clearPendingContext: () => void;
  initializeTabContents: (tabId: string, contents: string, mode?: CodeViewerMode) => void;
  updateDraftContents: (tabId: string, contents: string) => void;
  revertDraftContents: (tabId: string) => void;
  setTabMode: (tabId: string, mode: CodeViewerMode) => void;
  markTabSaving: (tabId: string) => void;
  completeTabSave: (tabId: string, contents: string) => void;
  failTabSave: (tabId: string, message: string) => void;
  markExternalChange: (tabId: string, hasExternalChange: boolean) => void;
  hasDirtyTabs: () => boolean;
}

function basenameOf(filePath: string): string {
  const segments = filePath.split("/");
  return segments[segments.length - 1] ?? filePath;
}

export function makeCodeViewerTabId(cwd: string, relativePath: string): string {
  return `${cwd}::${relativePath}`;
}

function isMarkdownPath(relativePath: string): boolean {
  return /\.(md|markdown|mdown|mkd)$/i.test(relativePath);
}

function defaultModeForPath(relativePath: string): CodeViewerMode {
  return isMarkdownPath(relativePath) ? "view" : "edit";
}

function updateTab(
  tabs: CodeViewerTab[],
  tabId: string,
  updater: (tab: CodeViewerTab) => CodeViewerTab,
): CodeViewerTab[] {
  return tabs.map((tab) => (tab.tabId === tabId ? updater(tab) : tab));
}

export const useCodeViewerStore = create<CodeViewerState>((set, get) => ({
  isOpen: false,
  tabs: [],
  activeTabId: null,
  pendingContext: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, tabs: [], activeTabId: null }),
  toggle: () =>
    set((state) => ({
      isOpen: !state.isOpen,
    })),

  openFile: (cwd, relativePath, mode) => {
    const tabId = makeCodeViewerTabId(cwd, relativePath);
    set((state) => {
      const existing = state.tabs.find((tab) => tab.tabId === tabId);
      if (existing) {
        const nextMode = mode ?? existing.mode;
        return {
          isOpen: true,
          activeTabId: tabId,
          tabs:
            nextMode === existing.mode
              ? state.tabs
              : updateTab(state.tabs, tabId, (tab) => ({ ...tab, mode: nextMode })),
        };
      }
      const newTab: CodeViewerTab = {
        tabId,
        cwd,
        relativePath,
        label: basenameOf(relativePath),
        savedContents: null,
        draftContents: null,
        isDirty: false,
        isSaving: false,
        lastSaveError: null,
        mode: mode ?? defaultModeForPath(relativePath),
        hasExternalChange: false,
      };
      return {
        isOpen: true,
        tabs: [...state.tabs, newTab],
        activeTabId: tabId,
      };
    });
    return tabId;
  },

  closeTab: (tabId) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.tabId === tabId);
      if (index === -1) return state;
      const nextTabs = state.tabs.filter((tab) => tab.tabId !== tabId);
      let nextActive = state.activeTabId;
      if (state.activeTabId === tabId) {
        const nearestIndex = Math.min(index, nextTabs.length - 1);
        nextActive = nextTabs[nearestIndex]?.tabId ?? null;
      }
      if (nextTabs.length === 0) {
        return { isOpen: false, tabs: [], activeTabId: null };
      }
      return { tabs: nextTabs, activeTabId: nextActive };
    }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  closeAllTabs: () => set({ isOpen: false, tabs: [], activeTabId: null }),

  setPendingContext: (ctx) => set({ pendingContext: ctx }),
  clearPendingContext: () => set({ pendingContext: null }),

  initializeTabContents: (tabId, contents, mode) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => {
        if (tab.isDirty) {
          if (tab.savedContents !== contents) {
            return {
              ...tab,
              hasExternalChange: true,
            };
          }
          return tab;
        }
        return {
          ...tab,
          savedContents: contents,
          draftContents: contents,
          isDirty: false,
          isSaving: false,
          lastSaveError: null,
          hasExternalChange: false,
          mode: mode ?? tab.mode,
        };
      }),
    })),

  updateDraftContents: (tabId, contents) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({
        ...tab,
        draftContents: contents,
        isDirty: tab.savedContents !== contents,
        lastSaveError: null,
      })),
    })),

  revertDraftContents: (tabId) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({
        ...tab,
        draftContents: tab.savedContents,
        isDirty: false,
        lastSaveError: null,
        hasExternalChange: false,
      })),
    })),

  setTabMode: (tabId, mode) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({ ...tab, mode })),
    })),

  markTabSaving: (tabId) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({
        ...tab,
        isSaving: true,
        lastSaveError: null,
      })),
    })),

  completeTabSave: (tabId, contents) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({
        ...tab,
        savedContents: contents,
        draftContents: contents,
        isDirty: false,
        isSaving: false,
        lastSaveError: null,
        hasExternalChange: false,
      })),
    })),

  failTabSave: (tabId, message) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({
        ...tab,
        isSaving: false,
        lastSaveError: message,
      })),
    })),

  markExternalChange: (tabId, hasExternalChange) =>
    set((state) => ({
      tabs: updateTab(state.tabs, tabId, (tab) => ({
        ...tab,
        hasExternalChange,
      })),
    })),

  hasDirtyTabs: () => get().tabs.some((tab) => tab.isDirty),
}));
