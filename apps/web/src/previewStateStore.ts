import type { ProjectId, ThreadId } from "@okcode/contracts";
import { create } from "zustand";

import type { BrowserPresetId } from "./lib/browserPresets";

export type PreviewDock = "left" | "right" | "top" | "bottom";
export type PreviewOrientation = "portrait" | "landscape";
export type PreviewLayoutMode = "top" | "side" | "fullscreen" | "popout";

export interface CustomViewport {
  width: number;
  height: number;
}

interface PersistedPreviewUiState {
  openByThreadId: Record<string, boolean>;
  dockByProjectId: Record<string, PreviewDock>;
  sizeByProjectId: Record<string, number>;
  presetByProjectId: Record<string, BrowserPresetId>;
  orientationByProjectId: Record<string, PreviewOrientation>;
  customViewportByProjectId: Record<string, CustomViewport>;
  favoriteUrls: string[];
  layoutModeByProjectId: Record<string, PreviewLayoutMode>;
  /** Stores the mode to restore when exiting fullscreen. Not user-facing. */
  previousLayoutModeByProjectId: Record<string, PreviewLayoutMode>;
}

interface PreviewStateStore extends PersistedPreviewUiState {
  setThreadOpen: (threadId: ThreadId, open: boolean) => void;
  toggleThreadOpen: (threadId: ThreadId) => void;
  setProjectDock: (projectId: ProjectId, dock: PreviewDock) => void;
  toggleProjectLayout: (projectId: ProjectId) => void;
  setProjectSize: (projectId: ProjectId, size: number) => void;
  setProjectPreset: (projectId: ProjectId, preset: BrowserPresetId | null) => void;
  setProjectOrientation: (projectId: ProjectId, orientation: PreviewOrientation) => void;
  toggleProjectOrientation: (projectId: ProjectId) => void;
  setCustomViewport: (projectId: ProjectId, viewport: CustomViewport) => void;
  addFavoriteUrl: (url: string) => void;
  removeFavoriteUrl: (url: string) => void;
  toggleFavoriteUrl: (url: string) => void;
  setProjectLayoutMode: (projectId: ProjectId, mode: PreviewLayoutMode) => void;
  toggleFullscreen: (projectId: ProjectId) => void;
}

const PREVIEW_STATE_STORAGE_KEY = "okcode:desktop-preview:v6";
const PREVIEW_STATE_STORAGE_KEY_V5 = "okcode:desktop-preview:v5";
const PREVIEW_STATE_STORAGE_KEY_V4 = "okcode:desktop-preview:v4";

const VALID_PRESETS = new Set<string>([
  "mobile",
  "tablet",
  "laptop",
  "desktop",
  "ultrawide",
  "custom",
]);
const VALID_ORIENTATIONS = new Set<string>(["portrait", "landscape"]);
const VALID_LAYOUT_MODES = new Set<string>(["top", "side", "fullscreen", "popout"]);

function isValidPresetId(value: unknown): value is BrowserPresetId {
  return typeof value === "string" && VALID_PRESETS.has(value);
}

function isValidOrientation(value: unknown): value is PreviewOrientation {
  return typeof value === "string" && VALID_ORIENTATIONS.has(value);
}

function isValidLayoutMode(value: unknown): value is PreviewLayoutMode {
  return typeof value === "string" && VALID_LAYOUT_MODES.has(value);
}

function isValidCustomViewport(value: unknown): value is CustomViewport {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.width === "number" &&
    Number.isFinite(v.width) &&
    typeof v.height === "number" &&
    Number.isFinite(v.height)
  );
}

function clampCustomViewport(viewport: CustomViewport): CustomViewport {
  return {
    width: Math.max(320, Math.min(3840, Math.round(viewport.width))),
    height: Math.max(320, Math.min(2160, Math.round(viewport.height))),
  };
}

function createEmptyPersistedPreviewUiState(): PersistedPreviewUiState {
  return {
    openByThreadId: {},
    dockByProjectId: {},
    sizeByProjectId: {},
    presetByProjectId: {},
    orientationByProjectId: {},
    customViewportByProjectId: {},
    favoriteUrls: [],
    layoutModeByProjectId: {},
    previousLayoutModeByProjectId: {},
  };
}

function normalizePreviewSize(size: unknown): number | null {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return null;
  }
  return Math.max(180, Math.round(size));
}

function readPersistedPreviewUiState(): PersistedPreviewUiState {
  if (typeof window === "undefined") {
    return createEmptyPersistedPreviewUiState();
  }

  try {
    // Try v6 first, then older keys for migration.
    let raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY_V5);
    }
    if (!raw) {
      raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY_V4);
    }
    if (!raw) {
      return createEmptyPersistedPreviewUiState();
    }

    const parsed = JSON.parse(raw) as Partial<PersistedPreviewUiState>;
    return {
      openByThreadId:
        parsed.openByThreadId && typeof parsed.openByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.openByThreadId).filter(
                (entry): entry is [string, boolean] =>
                  typeof entry[0] === "string" && typeof entry[1] === "boolean",
              ),
            )
          : {},
      dockByProjectId:
        parsed.dockByProjectId && typeof parsed.dockByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.dockByProjectId).filter(
                (entry): entry is [string, PreviewDock] =>
                  typeof entry[0] === "string" &&
                  (entry[1] === "left" ||
                    entry[1] === "right" ||
                    entry[1] === "top" ||
                    entry[1] === "bottom"),
              ),
            )
          : {},
      sizeByProjectId:
        parsed.sizeByProjectId && typeof parsed.sizeByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.sizeByProjectId).flatMap(([projectId, size]) => {
                const normalizedSize = normalizePreviewSize(size);
                return typeof projectId === "string" && normalizedSize !== null
                  ? [[projectId, normalizedSize] as const]
                  : [];
              }),
            )
          : {},
      presetByProjectId:
        parsed.presetByProjectId && typeof parsed.presetByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.presetByProjectId).filter(
                (entry): entry is [string, BrowserPresetId] =>
                  typeof entry[0] === "string" && isValidPresetId(entry[1]),
              ),
            )
          : {},
      orientationByProjectId:
        parsed.orientationByProjectId && typeof parsed.orientationByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.orientationByProjectId).filter(
                (entry): entry is [string, PreviewOrientation] =>
                  typeof entry[0] === "string" && isValidOrientation(entry[1]),
              ),
            )
          : {},
      customViewportByProjectId:
        parsed.customViewportByProjectId && typeof parsed.customViewportByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.customViewportByProjectId).flatMap(([projectId, viewport]) =>
                typeof projectId === "string" && isValidCustomViewport(viewport)
                  ? [[projectId, clampCustomViewport(viewport)] as const]
                  : [],
              ),
            )
          : {},
      favoriteUrls: Array.isArray(parsed.favoriteUrls)
        ? parsed.favoriteUrls.filter(
            (u): u is string => typeof u === "string" && u.trim().length > 0,
          )
        : [],
      layoutModeByProjectId:
        parsed.layoutModeByProjectId && typeof parsed.layoutModeByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.layoutModeByProjectId).filter(
                (entry): entry is [string, PreviewLayoutMode] =>
                  typeof entry[0] === "string" && isValidLayoutMode(entry[1]),
              ),
            )
          : {},
      previousLayoutModeByProjectId:
        parsed.previousLayoutModeByProjectId &&
        typeof parsed.previousLayoutModeByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.previousLayoutModeByProjectId).filter(
                (entry): entry is [string, PreviewLayoutMode] =>
                  typeof entry[0] === "string" && isValidLayoutMode(entry[1]),
              ),
            )
          : {},
    };
  } catch {
    return createEmptyPersistedPreviewUiState();
  }
}

function persistPreviewUiState(state: PersistedPreviewUiState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PREVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        openByThreadId: state.openByThreadId,
        dockByProjectId: state.dockByProjectId,
        sizeByProjectId: state.sizeByProjectId,
        presetByProjectId: state.presetByProjectId,
        orientationByProjectId: state.orientationByProjectId,
        customViewportByProjectId: state.customViewportByProjectId,
        favoriteUrls: state.favoriteUrls,
        layoutModeByProjectId: state.layoutModeByProjectId,
        previousLayoutModeByProjectId: state.previousLayoutModeByProjectId,
      } satisfies PersistedPreviewUiState),
    );
  } catch {
    // Ignore storage errors to avoid breaking the desktop chat UI.
  }
}

function snapshotState(state: PreviewStateStore): PersistedPreviewUiState {
  return {
    openByThreadId: state.openByThreadId,
    dockByProjectId: state.dockByProjectId,
    sizeByProjectId: state.sizeByProjectId,
    presetByProjectId: state.presetByProjectId,
    orientationByProjectId: state.orientationByProjectId,
    customViewportByProjectId: state.customViewportByProjectId,
    favoriteUrls: state.favoriteUrls,
    layoutModeByProjectId: state.layoutModeByProjectId,
    previousLayoutModeByProjectId: state.previousLayoutModeByProjectId,
  };
}

const initialState = readPersistedPreviewUiState();

export const usePreviewStateStore = create<PreviewStateStore>((set, get) => ({
  ...initialState,

  setThreadOpen: (threadId, open) => {
    set((state) => {
      const nextOpenByThreadId = { ...state.openByThreadId, [threadId]: open };
      persistPreviewUiState({ ...snapshotState(state), openByThreadId: nextOpenByThreadId });
      return { openByThreadId: nextOpenByThreadId };
    });
  },

  toggleThreadOpen: (threadId) => {
    get().setThreadOpen(threadId, !(get().openByThreadId[threadId] ?? false));
  },

  setProjectDock: (projectId, _dock) => {
    // Browser is locked to "top" position for a stable, predictable layout.
    const dock: PreviewDock = "top";
    set((state) => {
      const nextDockByProjectId = {
        ...state.dockByProjectId,
        [projectId]: dock,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        dockByProjectId: nextDockByProjectId,
      });
      return { dockByProjectId: nextDockByProjectId };
    });
  },

  toggleProjectLayout: (_projectId) => {
    // No-op: browser layout switching stays explicit in the preview controls.
  },

  setProjectSize: (projectId, size) => {
    const normalizedSize = normalizePreviewSize(size);
    if (normalizedSize === null) {
      return;
    }
    set((state) => {
      const nextSizeByProjectId = {
        ...state.sizeByProjectId,
        [projectId]: normalizedSize,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        sizeByProjectId: nextSizeByProjectId,
      });
      return { sizeByProjectId: nextSizeByProjectId };
    });
  },

  setProjectPreset: (projectId, preset) => {
    set((state) => {
      const nextPresetByProjectId = { ...state.presetByProjectId };
      if (preset === null) {
        delete nextPresetByProjectId[projectId];
      } else {
        nextPresetByProjectId[projectId] = preset;
      }
      persistPreviewUiState({
        ...snapshotState(state),
        presetByProjectId: nextPresetByProjectId,
      });
      return { presetByProjectId: nextPresetByProjectId };
    });
  },

  setProjectOrientation: (projectId, orientation) => {
    set((state) => {
      const nextOrientationByProjectId = {
        ...state.orientationByProjectId,
        [projectId]: orientation,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        orientationByProjectId: nextOrientationByProjectId,
      });
      return { orientationByProjectId: nextOrientationByProjectId };
    });
  },

  toggleProjectOrientation: (projectId) => {
    const current = get().orientationByProjectId[projectId] ?? "portrait";
    get().setProjectOrientation(projectId, current === "portrait" ? "landscape" : "portrait");
  },

  setCustomViewport: (projectId, viewport) => {
    const clamped = clampCustomViewport(viewport);
    set((state) => {
      const nextCustomViewportByProjectId = {
        ...state.customViewportByProjectId,
        [projectId]: clamped,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        customViewportByProjectId: nextCustomViewportByProjectId,
      });
      return { customViewportByProjectId: nextCustomViewportByProjectId };
    });
  },

  addFavoriteUrl: (url) => {
    const normalized = url.trim();
    if (normalized.length === 0) return;
    set((state) => {
      if (state.favoriteUrls.includes(normalized)) return state;
      const nextFavorites = [...state.favoriteUrls, normalized];
      persistPreviewUiState({ ...snapshotState(state), favoriteUrls: nextFavorites });
      return { favoriteUrls: nextFavorites };
    });
  },

  removeFavoriteUrl: (url) => {
    const normalized = url.trim();
    set((state) => {
      const nextFavorites = state.favoriteUrls.filter((u) => u !== normalized);
      persistPreviewUiState({ ...snapshotState(state), favoriteUrls: nextFavorites });
      return { favoriteUrls: nextFavorites };
    });
  },

  toggleFavoriteUrl: (url) => {
    const normalized = url.trim();
    if (normalized.length === 0) return;
    if (get().favoriteUrls.includes(normalized)) {
      get().removeFavoriteUrl(normalized);
    } else {
      get().addFavoriteUrl(normalized);
    }
  },

  setProjectLayoutMode: (projectId, mode) => {
    set((state) => {
      const currentMode = state.layoutModeByProjectId[projectId] ?? "side";
      const nextLayoutModeByProjectId = {
        ...state.layoutModeByProjectId,
        [projectId]: mode,
      };
      // Store the previous mode so we can restore from fullscreen
      const nextPreviousLayoutModeByProjectId = {
        ...state.previousLayoutModeByProjectId,
        [projectId]: currentMode,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        layoutModeByProjectId: nextLayoutModeByProjectId,
        previousLayoutModeByProjectId: nextPreviousLayoutModeByProjectId,
      });
      return {
        layoutModeByProjectId: nextLayoutModeByProjectId,
        previousLayoutModeByProjectId: nextPreviousLayoutModeByProjectId,
      };
    });
  },

  toggleFullscreen: (projectId) => {
    const current = get().layoutModeByProjectId[projectId] ?? "side";
    if (current === "fullscreen") {
      // Restore previous mode
      const previous = get().previousLayoutModeByProjectId[projectId] ?? "side";
      get().setProjectLayoutMode(projectId, previous);
    } else {
      get().setProjectLayoutMode(projectId, "fullscreen");
    }
  },
}));
