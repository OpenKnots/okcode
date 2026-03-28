import type { ProjectId, ThreadId } from "@okcode/contracts";
import { create } from "zustand";

export type PreviewDock = "left" | "right" | "top" | "bottom";

interface PersistedPreviewUiState {
  openByThreadId: Record<string, boolean>;
  dockByThreadId: Record<string, PreviewDock>;
  sizeByThreadId: Record<string, number>;
  urlByProjectId: Record<string, string>;
  favoriteUrlByProjectId: Record<string, string>;
}

interface PreviewStateStore extends PersistedPreviewUiState {
  setThreadOpen: (threadId: ThreadId, open: boolean) => void;
  toggleThreadOpen: (threadId: ThreadId) => void;
  setThreadDock: (threadId: ThreadId, dock: PreviewDock) => void;
  toggleThreadLayout: (threadId: ThreadId) => void;
  setThreadSize: (threadId: ThreadId, size: number) => void;
  setProjectUrl: (projectId: ProjectId, url: string) => void;
  setProjectFavoriteUrl: (projectId: ProjectId, url: string | null) => void;
  toggleProjectFavorite: (projectId: ProjectId, url: string) => void;
}

const PREVIEW_STATE_STORAGE_KEY = "okcode:desktop-preview:v2";

function createEmptyPersistedPreviewUiState(): PersistedPreviewUiState {
  return {
    openByThreadId: {},
    dockByThreadId: {},
    sizeByThreadId: {},
    urlByProjectId: {},
    favoriteUrlByProjectId: {},
  };
}

function snapshotPreviewUiState(state: {
  openByThreadId: PersistedPreviewUiState["openByThreadId"];
  dockByThreadId: PersistedPreviewUiState["dockByThreadId"];
  sizeByThreadId: PersistedPreviewUiState["sizeByThreadId"];
  urlByProjectId: PersistedPreviewUiState["urlByProjectId"];
  favoriteUrlByProjectId: PersistedPreviewUiState["favoriteUrlByProjectId"];
}): PersistedPreviewUiState {
  return {
    openByThreadId: state.openByThreadId,
    dockByThreadId: state.dockByThreadId,
    sizeByThreadId: state.sizeByThreadId,
    urlByProjectId: state.urlByProjectId,
    favoriteUrlByProjectId: state.favoriteUrlByProjectId,
  };
}

function normalizeUrlRecord(record: unknown): Record<string, string> {
  if (!record || typeof record !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) => {
      if (typeof key !== "string" || typeof value !== "string") {
        return [];
      }

      const normalizedValue = value.trim();
      return normalizedValue.length > 0 ? [[key, normalizedValue] as const] : [];
    }),
  );
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
      openByThreadId:
        parsed.openByThreadId && typeof parsed.openByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.openByThreadId).filter(
                (entry): entry is [string, boolean] =>
                  typeof entry[0] === "string" && entry[1] === true,
              ),
            )
          : {},
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
      urlByProjectId: normalizeUrlRecord(parsed.urlByProjectId),
      favoriteUrlByProjectId: normalizeUrlRecord(parsed.favoriteUrlByProjectId),
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
        dockByThreadId: state.dockByThreadId,
        sizeByThreadId: state.sizeByThreadId,
        urlByProjectId: state.urlByProjectId,
        favoriteUrlByProjectId: state.favoriteUrlByProjectId,
      } satisfies PersistedPreviewUiState),
    );
  } catch {
    // Ignore storage errors to avoid breaking the desktop chat UI.
  }
}

const initialState = readPersistedPreviewUiState();

export const usePreviewStateStore = create<PreviewStateStore>((set, get) => ({
  ...initialState,

  setThreadOpen: (threadId, open) => {
    set((state) => {
      const nextOpenByThreadId = {
        ...state.openByThreadId,
        [threadId]: open,
      };
      persistPreviewUiState(
        snapshotPreviewUiState({
          ...state,
          openByThreadId: nextOpenByThreadId,
        }),
      );
      return { openByThreadId: nextOpenByThreadId };
    });
  },

  toggleThreadOpen: (threadId) => {
    const current = get().openByThreadId[threadId] === true;
    get().setThreadOpen(threadId, !current);
  },

  setThreadDock: (threadId, dock) => {
    set((state) => {
      const nextDockByThreadId = {
        ...state.dockByThreadId,
        [threadId]: dock,
      };
      persistPreviewUiState(
        snapshotPreviewUiState({
          ...state,
          dockByThreadId: nextDockByThreadId,
        }),
      );
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
      persistPreviewUiState(
        snapshotPreviewUiState({
          ...state,
          sizeByThreadId: nextSizeByThreadId,
        }),
      );
      return { sizeByThreadId: nextSizeByThreadId };
    });
  },

  setProjectUrl: (projectId, url) => {
    const normalizedUrl = url.trim();
    set((state) => {
      const nextUrlByProjectId = { ...state.urlByProjectId };
      if (normalizedUrl.length > 0) {
        nextUrlByProjectId[projectId] = normalizedUrl;
      } else {
        delete nextUrlByProjectId[projectId];
      }
      persistPreviewUiState(
        snapshotPreviewUiState({
          ...state,
          urlByProjectId: nextUrlByProjectId,
        }),
      );
      return { urlByProjectId: nextUrlByProjectId };
    });
  },

  setProjectFavoriteUrl: (projectId, url) => {
    const normalizedUrl = url?.trim() ?? "";
    set((state) => {
      const nextFavoriteUrlByProjectId = { ...state.favoriteUrlByProjectId };
      if (normalizedUrl.length > 0) {
        nextFavoriteUrlByProjectId[projectId] = normalizedUrl;
      } else {
        delete nextFavoriteUrlByProjectId[projectId];
      }
      persistPreviewUiState(
        snapshotPreviewUiState({
          ...state,
          favoriteUrlByProjectId: nextFavoriteUrlByProjectId,
        }),
      );
      return { favoriteUrlByProjectId: nextFavoriteUrlByProjectId };
    });
  },

  toggleProjectFavorite: (projectId, url) => {
    const normalizedUrl = url.trim();
    if (normalizedUrl.length === 0) {
      return;
    }

    const currentFavoriteUrl = get().favoriteUrlByProjectId[projectId] ?? null;
    get().setProjectFavoriteUrl(
      projectId,
      currentFavoriteUrl === normalizedUrl ? null : normalizedUrl,
    );
  },
}));
