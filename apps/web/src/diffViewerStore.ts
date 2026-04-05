import { type ThreadId, type TurnId } from "@okcode/contracts";
import { create } from "zustand";

interface DiffViewerState {
  isOpen: boolean;
  threadId: ThreadId | null;
  selectedTurnId: TurnId | null;
  selectedFilePath: string | null;
  openConversation: (threadId: ThreadId) => void;
  openTurnDiff: (threadId: ThreadId, turnId: TurnId, filePath?: string) => void;
  close: () => void;
  setSelectedTurn: (turnId: TurnId | null) => void;
  setSelectedFilePath: (filePath: string | null) => void;
}

export const useDiffViewerStore = create<DiffViewerState>((set) => ({
  isOpen: false,
  threadId: null,
  selectedTurnId: null,
  selectedFilePath: null,

  openConversation: (threadId) =>
    set({
      isOpen: true,
      threadId,
      selectedTurnId: null,
      selectedFilePath: null,
    }),

  openTurnDiff: (threadId, turnId, filePath) =>
    set({
      isOpen: true,
      threadId,
      selectedTurnId: turnId,
      selectedFilePath: filePath ?? null,
    }),

  close: () =>
    set({
      isOpen: false,
      threadId: null,
      selectedTurnId: null,
      selectedFilePath: null,
    }),

  setSelectedTurn: (turnId) =>
    set((state) => ({
      ...state,
      selectedTurnId: turnId,
      selectedFilePath: null,
    })),

  setSelectedFilePath: (filePath) =>
    set((state) => ({
      ...state,
      selectedFilePath: filePath,
    })),
}));
