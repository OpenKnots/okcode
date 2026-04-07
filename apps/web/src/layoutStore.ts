/**
 * Persisted store for saved layout presets.
 *
 * A "layout" captures which panels are open, their sizes, and dock positions
 * so users can save and restore their preferred panel arrangements. The data
 * is persisted to localStorage alongside other `okcode:` prefixed settings.
 *
 * Follows the same manual-persistence pattern used by `previewStateStore.ts`
 * and `simulationViewerStore.ts`.
 */

import { create } from "zustand";

// ─── Types ──────────────────────────────────────────────────────────

export type LayoutPanel = "none" | "code-viewer" | "diff-viewer" | "preview" | "simulation";
export type LayoutPreviewDock = "left" | "right" | "top" | "bottom";

export interface LayoutSidebarWidths {
  /** Thread sidebar (left). Null = keep the current/default width. */
  threadSidebar: number | null;
  /** Code viewer sidebar (right). Null = keep the current/default width. */
  codeViewer: number | null;
  /** Diff viewer sidebar (right). Null = keep the current/default width. */
  diffViewer: number | null;
  /** Simulation sidebar (right). Null = keep the current/default width. */
  simulation: number | null;
}

export interface SavedLayout {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Which right-side panel is active, or "none" for chat-only. */
  activePanel: LayoutPanel;
  /** Whether the terminal drawer should be open. */
  terminalOpen: boolean;
  /** Terminal drawer height in px. Null = keep the current height. */
  terminalHeight: number | null;
  /** Sidebar widths in px. Null entries = keep the current/default width. */
  sidebarWidths: LayoutSidebarWidths;
  /** Preview dock position. Null = keep the current position. */
  previewDock: LayoutPreviewDock | null;
  /** Preview panel size in px. Null = keep the current size. */
  previewSize: number | null;
}

// ─── Constants ──────────────────────────────────────────────────────

const LAYOUT_STORAGE_KEY = "okcode:saved-layouts:v1";
const MAX_SAVED_LAYOUTS = 32;

const VALID_PANELS = new Set<string>([
  "none",
  "code-viewer",
  "diff-viewer",
  "preview",
  "simulation",
]);
const VALID_DOCKS = new Set<string>(["left", "right", "top", "bottom"]);

// ─── Validation helpers ─────────────────────────────────────────────

function isValidPanel(value: unknown): value is LayoutPanel {
  return typeof value === "string" && VALID_PANELS.has(value);
}

function isValidDock(value: unknown): value is LayoutPreviewDock {
  return typeof value === "string" && VALID_DOCKS.has(value);
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isFinitePositiveOrNull(value: unknown): value is number | null {
  return value === null || isFinitePositive(value);
}

function normalizeSidebarWidths(raw: unknown): LayoutSidebarWidths {
  const defaults: LayoutSidebarWidths = {
    threadSidebar: null,
    codeViewer: null,
    diffViewer: null,
    simulation: null,
  };
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    threadSidebar: isFinitePositiveOrNull(obj.threadSidebar) ? obj.threadSidebar : null,
    codeViewer: isFinitePositiveOrNull(obj.codeViewer) ? obj.codeViewer : null,
    diffViewer: isFinitePositiveOrNull(obj.diffViewer) ? obj.diffViewer : null,
    simulation: isFinitePositiveOrNull(obj.simulation) ? obj.simulation : null,
  };
}

function normalizeLayout(raw: unknown): SavedLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== "string" || obj.id.trim().length === 0) return null;
  if (typeof obj.name !== "string" || obj.name.trim().length === 0) return null;

  const now = Date.now();
  return {
    id: obj.id.trim(),
    name: obj.name.trim().slice(0, 128),
    createdAt:
      typeof obj.createdAt === "number" && Number.isFinite(obj.createdAt) ? obj.createdAt : now,
    updatedAt:
      typeof obj.updatedAt === "number" && Number.isFinite(obj.updatedAt) ? obj.updatedAt : now,
    activePanel: isValidPanel(obj.activePanel) ? obj.activePanel : "none",
    terminalOpen: typeof obj.terminalOpen === "boolean" ? obj.terminalOpen : false,
    terminalHeight: isFinitePositiveOrNull(obj.terminalHeight) ? obj.terminalHeight : null,
    sidebarWidths: normalizeSidebarWidths(obj.sidebarWidths),
    previewDock: isValidDock(obj.previewDock) ? obj.previewDock : null,
    previewSize: isFinitePositiveOrNull(obj.previewSize) ? obj.previewSize : null,
  };
}

// ─── Persistence ────────────────────────────────────────────────────

interface PersistedLayoutState {
  savedLayouts: SavedLayout[];
  activeLayoutId: string | null;
}

function createEmptyPersistedState(): PersistedLayoutState {
  return { savedLayouts: [], activeLayoutId: null };
}

function readPersistedState(): PersistedLayoutState {
  if (typeof window === "undefined") return createEmptyPersistedState();
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return createEmptyPersistedState();
    const parsed = JSON.parse(raw) as Partial<PersistedLayoutState>;

    const layouts: SavedLayout[] = [];
    if (Array.isArray(parsed.savedLayouts)) {
      for (const entry of parsed.savedLayouts) {
        if (layouts.length >= MAX_SAVED_LAYOUTS) break;
        const layout = normalizeLayout(entry);
        if (layout) layouts.push(layout);
      }
    }

    const activeLayoutId =
      typeof parsed.activeLayoutId === "string" &&
      layouts.some((l) => l.id === parsed.activeLayoutId)
        ? parsed.activeLayoutId
        : null;

    return { savedLayouts: layouts, activeLayoutId };
  } catch {
    return createEmptyPersistedState();
  }
}

function persistState(state: PersistedLayoutState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        savedLayouts: state.savedLayouts,
        activeLayoutId: state.activeLayoutId,
      } satisfies PersistedLayoutState),
    );
  } catch {
    // Ignore storage errors to avoid breaking the UI.
  }
}

function snapshotPersisted(state: LayoutStoreState): PersistedLayoutState {
  return {
    savedLayouts: state.savedLayouts,
    activeLayoutId: state.activeLayoutId,
  };
}

// ─── Store ──────────────────────────────────────────────────────────

interface LayoutStoreState extends PersistedLayoutState {
  /** Add or overwrite a saved layout. */
  saveLayout: (layout: SavedLayout) => void;
  /** Partially update a saved layout by ID. Updates `updatedAt` automatically. */
  updateLayout: (
    id: string,
    patch: Partial<
      Pick<
        SavedLayout,
        | "name"
        | "activePanel"
        | "terminalOpen"
        | "terminalHeight"
        | "sidebarWidths"
        | "previewDock"
        | "previewSize"
      >
    >,
  ) => void;
  /** Delete a saved layout by ID. */
  deleteLayout: (id: string) => void;
  /** Rename a saved layout by ID. */
  renameLayout: (id: string, name: string) => void;
  /** Mark a layout as the currently active layout (or null to clear). */
  setActiveLayoutId: (id: string | null) => void;
  /** Reorder saved layouts by providing the desired order of IDs. */
  reorderLayouts: (orderedIds: string[]) => void;
}

const initialState = readPersistedState();

export const useLayoutStore = create<LayoutStoreState>((set) => ({
  ...initialState,

  saveLayout: (layout) => {
    set((state) => {
      const existingIndex = state.savedLayouts.findIndex((l) => l.id === layout.id);
      let nextLayouts: SavedLayout[];
      if (existingIndex >= 0) {
        nextLayouts = [...state.savedLayouts];
        nextLayouts[existingIndex] = layout;
      } else {
        if (state.savedLayouts.length >= MAX_SAVED_LAYOUTS) return state;
        nextLayouts = [...state.savedLayouts, layout];
      }
      const next: PersistedLayoutState = {
        savedLayouts: nextLayouts,
        activeLayoutId: layout.id,
      };
      persistState(next);
      return next;
    });
  },

  updateLayout: (id, patch) => {
    set((state) => {
      const index = state.savedLayouts.findIndex((l) => l.id === id);
      if (index < 0) return state;
      const existing = state.savedLayouts[index]!;
      const updated: SavedLayout = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        name: patch.name !== undefined ? patch.name.trim().slice(0, 128) : existing.name,
      };
      const nextLayouts = [...state.savedLayouts];
      nextLayouts[index] = updated;
      const next = { ...snapshotPersisted(state), savedLayouts: nextLayouts };
      persistState(next);
      return next;
    });
  },

  deleteLayout: (id) => {
    set((state) => {
      const nextLayouts = state.savedLayouts.filter((l) => l.id !== id);
      if (nextLayouts.length === state.savedLayouts.length) return state;
      const nextActiveId = state.activeLayoutId === id ? null : state.activeLayoutId;
      const next: PersistedLayoutState = {
        savedLayouts: nextLayouts,
        activeLayoutId: nextActiveId,
      };
      persistState(next);
      return next;
    });
  },

  renameLayout: (id, name) => {
    const trimmed = name.trim().slice(0, 128);
    if (trimmed.length === 0) return;
    set((state) => {
      const index = state.savedLayouts.findIndex((l) => l.id === id);
      if (index < 0) return state;
      const existing = state.savedLayouts[index]!;
      if (existing.name === trimmed) return state;
      const nextLayouts = [...state.savedLayouts];
      nextLayouts[index] = { ...existing, name: trimmed, updatedAt: Date.now() };
      const next = { ...snapshotPersisted(state), savedLayouts: nextLayouts };
      persistState(next);
      return next;
    });
  },

  setActiveLayoutId: (id) => {
    set((state) => {
      if (state.activeLayoutId === id) return state;
      if (id !== null && !state.savedLayouts.some((l) => l.id === id)) return state;
      const next = { ...snapshotPersisted(state), activeLayoutId: id };
      persistState(next);
      return next;
    });
  },

  reorderLayouts: (orderedIds) => {
    set((state) => {
      const layoutMap = new Map(state.savedLayouts.map((l) => [l.id, l]));
      const reordered: SavedLayout[] = [];
      const seen = new Set<string>();
      for (const id of orderedIds) {
        const layout = layoutMap.get(id);
        if (layout && !seen.has(id)) {
          reordered.push(layout);
          seen.add(id);
        }
      }
      // Append any layouts not mentioned in the order (defensive).
      for (const layout of state.savedLayouts) {
        if (!seen.has(layout.id)) {
          reordered.push(layout);
        }
      }
      const next = { ...snapshotPersisted(state), savedLayouts: reordered };
      persistState(next);
      return next;
    });
  },
}));
