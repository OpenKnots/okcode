import { create } from "zustand";

export interface CodeViewerTab {
  cwd: string;
  relativePath: string;
  label: string;
}

interface CodeViewerState {
  tabs: CodeViewerTab[];
  activeTabPath: string | null;
  openFile: (cwd: string, relativePath: string) => void;
  closeTab: (relativePath: string) => void;
  setActiveTab: (relativePath: string) => void;
  closeAllTabs: () => void;
}

function basenameOf(filePath: string): string {
  const segments = filePath.split("/");
  return segments[segments.length - 1] ?? filePath;
}

export const useCodeViewerStore = create<CodeViewerState>((set) => ({
  tabs: [],
  activeTabPath: null,

  openFile: (cwd, relativePath) =>
    set((state) => {
      const existing = state.tabs.find((tab) => tab.relativePath === relativePath);
      if (existing) {
        return { activeTabPath: relativePath };
      }
      const newTab: CodeViewerTab = {
        cwd,
        relativePath,
        label: basenameOf(relativePath),
      };
      return {
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
      return { tabs: nextTabs, activeTabPath: nextActive };
    }),

  setActiveTab: (relativePath) => set({ activeTabPath: relativePath }),

  closeAllTabs: () => set({ tabs: [], activeTabPath: null }),
}));
