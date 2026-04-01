import { create } from "zustand";

export interface CodeViewerTab {
  cwd: string;
  relativePath: string;
  label: string;
}

export interface CodeViewerPendingContext {
  filePath: string;
  fromLine: number;
  toLine: number;
}

interface CodeViewerState {
  isOpen: boolean;
  tabs: CodeViewerTab[];
  activeTabPath: string | null;
  pendingContext: CodeViewerPendingContext | null;
  open: () => void;
  close: () => void;
  toggle: () => void;
  openFile: (cwd: string, relativePath: string) => void;
  closeTab: (relativePath: string) => void;
  setActiveTab: (relativePath: string) => void;
  closeAllTabs: () => void;
  setPendingContext: (ctx: CodeViewerPendingContext) => void;
  clearPendingContext: () => void;
}

function basenameOf(filePath: string): string {
  const segments = filePath.split("/");
  return segments[segments.length - 1] ?? filePath;
}

export const useCodeViewerStore = create<CodeViewerState>((set) => ({
  isOpen: false,
  tabs: [],
  activeTabPath: null,
  pendingContext: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, tabs: [], activeTabPath: null }),
  toggle: () =>
    set((state) => ({
      isOpen: !state.isOpen,
    })),

  openFile: (cwd, relativePath) =>
    set((state) => {
      const existing = state.tabs.find((tab) => tab.relativePath === relativePath);
      if (existing) {
        return { isOpen: true, activeTabPath: relativePath };
      }
      const newTab: CodeViewerTab = {
        cwd,
        relativePath,
        label: basenameOf(relativePath),
      };
      return {
        isOpen: true,
        tabs: [...state.tabs, newTab],
        activeTabPath: relativePath,
      };
    }),

  closeTab: (relativePath) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.relativePath === relativePath);
      if (index === -1) return state;
      const nextTabs = state.tabs.filter((tab) => tab.relativePath !== relativePath);
      let nextActive = state.activeTabPath;
      if (state.activeTabPath === relativePath) {
        // Activate the nearest tab
        const nearestIndex = Math.min(index, nextTabs.length - 1);
        nextActive = nextTabs[nearestIndex]?.relativePath ?? null;
      }
      // If no tabs left, close the viewer
      if (nextTabs.length === 0) {
        return { isOpen: false, tabs: [], activeTabPath: null };
      }
      return { tabs: nextTabs, activeTabPath: nextActive };
    }),

  setActiveTab: (relativePath) => set({ activeTabPath: relativePath }),

  closeAllTabs: () => set({ isOpen: false, tabs: [], activeTabPath: null }),

  setPendingContext: (ctx) => set({ pendingContext: ctx }),
  clearPendingContext: () => set({ pendingContext: null }),
}));
