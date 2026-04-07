import { create } from "zustand";

interface WorktreeCleanupState {
  open: boolean;
}

interface WorktreeCleanupActions {
  openDialog: () => void;
  closeDialog: () => void;
}

type WorktreeCleanupStore = WorktreeCleanupState & WorktreeCleanupActions;

export const useWorktreeCleanupStore = create<WorktreeCleanupStore>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));
