import type { ProjectId, ThreadId } from "@okcode/contracts";
import { create } from "zustand";

interface PersistedPreviewUiState {
  openByThreadId: Record<string, boolean>;
  urlByProjectId: Record<string, string>;
}

interface PreviewStateStore extends PersistedPreviewUiState {
  setThreadOpen: (threadId: ThreadId, open: boolean) => void;
  toggleThreadOpen: (threadId: ThreadId) => void;
  setProjectUrl: (projectId: ProjectId, url: string) => void;
}

const PREVIEW_STATE_STORAGE_KEY = "okcode:desktop-preview:v1";

function readPersistedPreviewUiState(): PersistedPreviewUiState {
  if (typeof window === "undefined") {
    return { openByThreadId: {}, urlByProjectId: {} };
  }

  try {
    const raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY);
    if (!raw) {
      return { openByThreadId: {}, urlByProjectId: {} };
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
      urlByProjectId:
        parsed.urlByProjectId && typeof parsed.urlByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.urlByProjectId).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === "string" &&
                  typeof entry[1] === "string" &&
                  entry[1].trim().length > 0,
              ),
            )
          : {},
    };
  } catch {
    return { openByThreadId: {}, urlByProjectId: {} };
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
        urlByProjectId: state.urlByProjectId,
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
      persistPreviewUiState({
        openByThreadId: nextOpenByThreadId,
        urlByProjectId: state.urlByProjectId,
      });
      return { openByThreadId: nextOpenByThreadId };
    });
  },

  toggleThreadOpen: (threadId) => {
    const current = get().openByThreadId[threadId] === true;
    get().setThreadOpen(threadId, !current);
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
      persistPreviewUiState({
        openByThreadId: state.openByThreadId,
        urlByProjectId: nextUrlByProjectId,
      });
      return { urlByProjectId: nextUrlByProjectId };
    });
  },
}));
