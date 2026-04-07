import { create } from "zustand";

export type RightPanelTab = "workspace" | "diffs";

interface RightPanelState {
  isOpen: boolean;
  activeTab: RightPanelTab;
  open: (tab?: RightPanelTab) => void;
  close: () => void;
  setActiveTab: (tab: RightPanelTab) => void;
}

const STORAGE_KEY = "okcode:right-panel-tab:v1";

const VALID_TABS: readonly RightPanelTab[] = ["workspace", "diffs"];

export function normalizeRightPanelTab(value: string | null | undefined): RightPanelTab | null {
  if (value === "files" || value === "editor") {
    return "workspace";
  }
  if ((VALID_TABS as readonly string[]).includes(value ?? "")) {
    return value as RightPanelTab;
  }
  return null;
}

function readPersistedTab(): RightPanelTab {
  if (typeof window === "undefined") return "workspace";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeRightPanelTab(raw);
    if (normalized) {
      return normalized;
    }
  } catch {
    // ignore storage errors
  }
  return "workspace";
}

function persistTab(tab: RightPanelTab): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    // ignore storage errors
  }
}

export const useRightPanelStore = create<RightPanelState>((set) => ({
  isOpen: false,
  activeTab: readPersistedTab(),

  open: (tab) => {
    if (tab) {
      persistTab(tab);
      set({ isOpen: true, activeTab: tab });
    } else {
      set({ isOpen: true });
    }
  },

  close: () => set({ isOpen: false }),

  setActiveTab: (tab) => {
    persistTab(tab);
    set({ activeTab: tab, isOpen: true });
  },
}));
