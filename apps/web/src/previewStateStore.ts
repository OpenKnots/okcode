import type { ThreadId } from "@okcode/contracts";
import { create } from "zustand";

import type { BrowserPresetId } from "./lib/browserPresets";

export type PreviewDock = "left" | "right" | "top" | "bottom";

interface PersistedPreviewUiState {
  globalOpen: boolean;
  dockByThreadId: Record<string, PreviewDock>;
  sizeByThreadId: Record<string, number>;
  presetByThreadId: Record<string, BrowserPresetId>;
  favoriteUrls: string[];
}

interface PreviewStateStore extends PersistedPreviewUiState {
  setGlobalOpen: (open: boolean) => void;
  toggleGlobalOpen: () => void;
  setThreadDock: (threadId: ThreadId, dock: PreviewDock) => void;
  toggleThreadLayout: (threadId: ThreadId) => void;
  setThreadSize: (threadId: ThreadId, size: number) => void;
  setThreadPreset: (threadId: ThreadId, preset: BrowserPresetId | null) => void;
  addFavoriteUrl: (url: string) => void;
  removeFavoriteUrl: (url: string) => void;
  toggleFavoriteUrl: (url: string) => void;
}

const PREVIEW_STATE_STORAGE_KEY = "okcode:desktop-preview:v3";

const VALID_PRESETS = new Set<string>(["mobile", "tablet", "laptop", "desktop", "ultrawide"]);

function isValidPresetId(value: unknown): value is BrowserPresetId {
  return typeof value === "string" && VALID_PRESETS.has(value);
}

function createEmptyPersistedPreviewUiState(): PersistedPreviewUiState {
  return {
    globalOpen: false,
    dockByThreadId: {},
    sizeByThreadId: {},
    presetByThreadId: {},
    favoriteUrls: [],
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
    const raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY);
    if (!raw) {
      return createEmptyPersistedPreviewUiState();
    }

    const parsed = JSON.parse(raw) as Partial<PersistedPreviewUiState>;
    return {
      globalOpen: parsed.globalOpen === true,
      dockByThreadId:
        parsed.dockByThreadId && typeof parsed.dockByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.dockByThreadId).filter(
                (entry): entry is [string, PreviewDock] =>
                  typeof entry[0] === "string" &&
                  (entry[1] === "left" ||
                    entry[1] === "right" ||
                    entry[1] === "top" ||
                    entry[1] === "bottom"),
              ),
            )
          : {},
      sizeByThreadId:
        parsed.sizeByThreadId && typeof parsed.sizeByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.sizeByThreadId).flatMap(([threadId, size]) => {
                const normalizedSize = normalizePreviewSize(size);
                return typeof threadId === "string" && normalizedSize !== null
                  ? [[threadId, normalizedSize] as const]
                  : [];
              }),
            )
          : {},
      presetByThreadId:
        parsed.presetByThreadId && typeof parsed.presetByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.presetByThreadId).filter(
                (entry): entry is [string, BrowserPresetId] =>
                  typeof entry[0] === "string" && isValidPresetId(entry[1]),
              ),
            )
          : {},
      favoriteUrls: Array.isArray(parsed.favoriteUrls)
        ? parsed.favoriteUrls.filter(
            (u): u is string => typeof u === "string" && u.trim().length > 0,
          )
        : [],
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
        globalOpen: state.globalOpen,
        dockByThreadId: state.dockByThreadId,
        sizeByThreadId: state.sizeByThreadId,
        presetByThreadId: state.presetByThreadId,
        favoriteUrls: state.favoriteUrls,
      } satisfies PersistedPreviewUiState),
    );
  } catch {
    // Ignore storage errors to avoid breaking the desktop chat UI.
  }
}

function snapshotState(state: PreviewStateStore): PersistedPreviewUiState {
  return {
    globalOpen: state.globalOpen,
    dockByThreadId: state.dockByThreadId,
    sizeByThreadId: state.sizeByThreadId,
    presetByThreadId: state.presetByThreadId,
    favoriteUrls: state.favoriteUrls,
  };
}

const initialState = readPersistedPreviewUiState();

export const usePreviewStateStore = create<PreviewStateStore>((set, get) => ({
  ...initialState,

  setGlobalOpen: (open) => {
    set((state) => {
      const next = { ...snapshotState(state), globalOpen: open };
      persistPreviewUiState(next);
      return { globalOpen: open };
    });
  },

  toggleGlobalOpen: () => {
    get().setGlobalOpen(!get().globalOpen);
  },

  setThreadDock: (threadId, dock) => {
    set((state) => {
      const nextDockByThreadId = {
        ...state.dockByThreadId,
        [threadId]: dock,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        dockByThreadId: nextDockByThreadId,
      });
      return { dockByThreadId: nextDockByThreadId };
    });
  },

  toggleThreadLayout: (threadId) => {
    const current = get().dockByThreadId[threadId] ?? "right";
    get().setThreadDock(
      threadId,
      current === "left"
        ? "top"
        : current === "right"
          ? "bottom"
          : current === "top"
            ? "left"
            : "right",
    );
  },

  setThreadSize: (threadId, size) => {
    const normalizedSize = normalizePreviewSize(size);
    if (normalizedSize === null) {
      return;
    }
    set((state) => {
      const nextSizeByThreadId = {
        ...state.sizeByThreadId,
        [threadId]: normalizedSize,
      };
      persistPreviewUiState({
        ...snapshotState(state),
        sizeByThreadId: nextSizeByThreadId,
      });
      return { sizeByThreadId: nextSizeByThreadId };
    });
  },

  setThreadPreset: (threadId, preset) => {
    set((state) => {
      const nextPresetByThreadId = { ...state.presetByThreadId };
      if (preset === null) {
        delete nextPresetByThreadId[threadId];
      } else {
        nextPresetByThreadId[threadId] = preset;
      }
      persistPreviewUiState({
        ...snapshotState(state),
        presetByThreadId: nextPresetByThreadId,
      });
      return { presetByThreadId: nextPresetByThreadId };
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
}));
