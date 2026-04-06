import { create } from "zustand";

// ── Types ───────────────────────────────────────────────────────────

interface ScreenshotState {
  /** Whether screenshot selection mode is active. */
  active: boolean;
}

interface ScreenshotActions {
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
}

type ScreenshotStore = ScreenshotState & ScreenshotActions;

// ── Store ───────────────────────────────────────────────────────────

export const useScreenshotStore = create<ScreenshotStore>((set, get) => ({
  active: false,

  activate: () => set({ active: true }),
  deactivate: () => set({ active: false }),
  toggle: () => set({ active: !get().active }),
}));
