import { create } from "zustand";
import type { ProjectId, ThreadId } from "@okcode/contracts";

// ── MRU (Most Recently Used) constants ──────────────────────────────
const MRU_MAX_PROJECTS = 20;
const MRU_MAX_THREADS = 50;

// ── Types ───────────────────────────────────────────────────────────

export type CommandPaletteMode =
  | "commands" // Default: search all commands
  | "projects" // Drill-in: project list
  | "threads"; // Drill-in: thread list (scoped to a project or global)

interface CommandPaletteState {
  /** Whether the command palette dialog is open. */
  open: boolean;
  /** Current display mode (top-level commands vs. drill-in views). */
  mode: CommandPaletteMode;
  /** When in "threads" mode, optionally scope to a specific project. */
  scopedProjectId: ProjectId | null;
  /** Most recently used project IDs (newest first). */
  mruProjectIds: ProjectId[];
  /** Most recently used thread IDs (newest first). */
  mruThreadIds: ThreadId[];
}

interface CommandPaletteActions {
  openPalette: (mode?: CommandPaletteMode) => void;
  closePalette: () => void;
  togglePalette: () => void;
  setMode: (mode: CommandPaletteMode, scopedProjectId?: ProjectId | null) => void;
  /** Record a project as recently used (pushes to front of MRU stack). */
  pushMruProject: (projectId: ProjectId) => void;
  /** Record a thread as recently used (pushes to front of MRU stack). */
  pushMruThread: (threadId: ThreadId) => void;
}

type CommandPaletteStore = CommandPaletteState & CommandPaletteActions;

// ── Helpers ─────────────────────────────────────────────────────────

function pushToFront<T>(list: T[], item: T, max: number): T[] {
  const filtered = list.filter((existing) => existing !== item);
  const next = [item, ...filtered];
  return next.length > max ? next.slice(0, max) : next;
}

// ── Store ───────────────────────────────────────────────────────────

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  // State
  open: false,
  mode: "commands",
  scopedProjectId: null,
  mruProjectIds: [],
  mruThreadIds: [],

  // Actions
  openPalette: (mode = "commands") =>
    set({ open: true, mode, scopedProjectId: null }),

  closePalette: () =>
    set({ open: false, mode: "commands", scopedProjectId: null }),

  togglePalette: () =>
    set((state) =>
      state.open
        ? { open: false, mode: "commands", scopedProjectId: null }
        : { open: true, mode: "commands", scopedProjectId: null },
    ),

  setMode: (mode, scopedProjectId = null) =>
    set({ mode, scopedProjectId }),

  pushMruProject: (projectId) =>
    set((state) => ({
      mruProjectIds: pushToFront(state.mruProjectIds, projectId, MRU_MAX_PROJECTS),
    })),

  pushMruThread: (threadId) =>
    set((state) => ({
      mruThreadIds: pushToFront(state.mruThreadIds, threadId, MRU_MAX_THREADS),
    })),
}));
