import { create } from "zustand";

export type ChatWidgetMode = "minimized" | "expanded";

interface PersistedWidgetState {
  mode: ChatWidgetMode;
  lastThreadId: string | null;
}

interface ChatWidgetStore extends PersistedWidgetState {
  expand: () => void;
  minimize: () => void;
  setLastThreadId: (id: string) => void;
}

const WIDGET_STORAGE_KEY = "okcode:chat-widget:v1";

function createEmptyState(): PersistedWidgetState {
  return {
    mode: "expanded",
    lastThreadId: null,
  };
}

function readPersistedState(): PersistedWidgetState {
  if (typeof window === "undefined") {
    return createEmptyState();
  }

  try {
    const raw = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }

    const parsed = JSON.parse(raw) as Partial<PersistedWidgetState>;
    return {
      mode: parsed.mode === "minimized" || parsed.mode === "expanded" ? parsed.mode : "expanded",
      lastThreadId:
        typeof parsed.lastThreadId === "string" && parsed.lastThreadId.length > 0
          ? parsed.lastThreadId
          : null,
    };
  } catch {
    return createEmptyState();
  }
}

function persistState(state: PersistedWidgetState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      WIDGET_STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        lastThreadId: state.lastThreadId,
      } satisfies PersistedWidgetState),
    );
  } catch {
    // Ignore storage errors.
  }
}

function snapshotState(state: ChatWidgetStore): PersistedWidgetState {
  return {
    mode: state.mode,
    lastThreadId: state.lastThreadId,
  };
}

const initialState = readPersistedState();

export const useChatWidgetStore = create<ChatWidgetStore>((set, get) => ({
  ...initialState,

  expand: () => {
    set(() => {
      const next = { ...snapshotState(get()), mode: "expanded" as const };
      persistState(next);
      return { mode: "expanded" };
    });
  },

  minimize: () => {
    set(() => {
      const next = { ...snapshotState(get()), mode: "minimized" as const };
      persistState(next);
      return { mode: "minimized" };
    });
  },

  setLastThreadId: (id: string) => {
    set(() => {
      const next = { ...snapshotState(get()), lastThreadId: id };
      persistState(next);
      return { lastThreadId: id };
    });
  },
}));
