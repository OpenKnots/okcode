import type { ProjectId } from "@okcode/contracts";
import { create } from "zustand";

import type { BrowserPresetId } from "./lib/browserPresets";

export type PreviewDock = "left" | "right" | "top" | "bottom";

interface PersistedPreviewUiState {
  openByProjectId: Record<string, boolean>;
  dockByProjectId: Record<string, PreviewDock>;
  sizeByProjectId: Record<string, number>;
  presetByProjectId: Record<string, BrowserPresetId>;
  favoriteUrls: string[];
}

interface PreviewStateStore extends PersistedPreviewUiState {
  setProjectOpen: (projectId: ProjectId, open: boolean) => void;
  toggleProjectOpen: (projectId: ProjectId) => void;
  setProjectDock: (projectId: ProjectId, dock: PreviewDock) => void;
  toggleProjectLayout: (projectId: ProjectId) => void;
  setProjectSize: (projectId: ProjectId, size: number) => void;
  setProjectPreset: (projectId: ProjectId, preset: BrowserPresetId | null) => void;
  addFavoriteUrl: (url: string) => void;
  removeFavoriteUrl: (url: string) => void;
  toggleFavoriteUrl: (url: string) => void;
}

const PREVIEW_STATE_STORAGE_KEY = "okcode:desktop-preview:v4";

const VALID_PRESETS = new Set<string>(["mobile", "tablet", "laptop", "desktop", "ultrawide"]);

function isValidPresetId(value: unknown): value is BrowserPresetId {
  return typeof value === "string" && VALID_PRESETS.has(value);
}

function createEmptyPersistedPreviewUiState(): PersistedPreviewUiState {
  return {
    openByProjectId: {},
    dockByProjectId: {},
    sizeByProjectId: {},
    presetByProjectId: {},
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
      openByProjectId:
        parsed.openByProjectId && typeof parsed.openByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.openByProjectId).filter(
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
        openByProjectId: state.openByProjectId,
        dockByProjectId: state.dockByProjectId,
        sizeByProjectId: state.sizeByProjectId,
        presetByProjectId: state.presetByProjectId,
        favoriteUrls: state.favoriteUrls,
      } satisfies PersistedPreviewUiState),
    );
  } catch {
    // Ignore storage errors to avoid breaking the desktop chat UI.
  }
}

function snapshotState(state: PreviewStateStore): PersistedPreviewUiState {
  return {
    openByProjectId: state.openByProjectId,
    dockByProjectId: state.dockByProjectId,
    sizeByProjectId: state.sizeByProjectId,
    presetByProjectId: state.presetByProjectId,
    favoriteUrls: state.favoriteUrls,
  };
}

const initialState = readPersistedPreviewUiState();

export const usePreviewStateStore = create<PreviewStateStore>((set, get) => ({
  ...initialState,

  setProjectOpen: (projectId, open) => {
    set((state) => {
      const nextOpenByProjectId = { ...state.openByProjectId, [projectId]: open };
      persistPreviewUiState({ ...snapshotState(state), openByProjectId: nextOpenByProjectId });
      return { openByProjectId: nextOpenByProjectId };
    });
  },

  toggleProjectOpen: (projectId) => {
    get().setProjectOpen(projectId, !(get().openByProjectId[projectId] ?? false));
  },

  setProjectDock: (projectId, dock) => {
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

  toggleProjectLayout: (projectId) => {
    const current = get().dockByProjectId[projectId] ?? "right";
    get().setProjectDock(
      projectId,
      current === "left"
        ? "top"
        : current === "right"
          ? "bottom"
          : current === "top"
            ? "left"
            : "right",
    );
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
