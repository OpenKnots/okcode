import { DEFAULT_TERMINAL_ID, type TerminalEvent, type TerminalOpenInput } from "@okcode/contracts";
import { create } from "zustand";

import { readNativeApi } from "./nativeApi";

export type TerminalLaunchStatus = "idle" | "opening" | "open" | "error";

export interface TerminalLaunchState {
  readonly status: TerminalLaunchStatus;
  readonly errorMessage: string | null;
  readonly lastRequestKey: string | null;
}

interface TerminalLaunchStoreState {
  readonly stateByKey: Record<string, TerminalLaunchState>;
  readonly setOpening: (threadId: string, terminalId: string, requestKey: string) => void;
  readonly setOpen: (threadId: string, terminalId: string) => void;
  readonly setError: (threadId: string, terminalId: string, message: string) => void;
  readonly clear: (threadId: string, terminalId: string) => void;
}

const DEFAULT_TERMINAL_LAUNCH_STATE: TerminalLaunchState = Object.freeze({
  status: "idle",
  errorMessage: null,
  lastRequestKey: null,
});

const inFlightRequests = new Map<string, { requestKey: string; promise: Promise<void> }>();

function toTerminalLaunchKey(threadId: string, terminalId: string): string {
  return `${threadId}\u0000${terminalId}`;
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 100) / 100;
}

function markTerminalPerformance(step: string, threadId: string, terminalId: string): void {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return;
  }
  try {
    performance.mark(`okcode:terminal:${step}:${threadId}:${terminalId}`);
  } catch {
    // Best-effort instrumentation only.
  }
}

function stableStringifyEnv(env: Record<string, string> | undefined): string {
  if (!env) return "";
  return JSON.stringify(
    Object.entries(env).toSorted(([left], [right]) => left.localeCompare(right)),
  );
}

export function buildTerminalLaunchRequestKey(input: TerminalOpenInput): string {
  return JSON.stringify({
    threadId: input.threadId,
    terminalId: input.terminalId ?? DEFAULT_TERMINAL_ID,
    cwd: input.cwd,
    cols: input.cols ?? null,
    rows: input.rows ?? null,
    env: stableStringifyEnv(input.env),
  });
}

export function selectTerminalLaunchState(
  stateByKey: Record<string, TerminalLaunchState>,
  threadId: string,
  terminalId: string,
): TerminalLaunchState {
  return stateByKey[toTerminalLaunchKey(threadId, terminalId)] ?? DEFAULT_TERMINAL_LAUNCH_STATE;
}

export const useTerminalLaunchStore = create<TerminalLaunchStoreState>()((set) => ({
  stateByKey: {},
  setOpening: (threadId, terminalId, requestKey) =>
    set((state) => {
      const key = toTerminalLaunchKey(threadId, terminalId);
      const previous = state.stateByKey[key];
      if (
        previous?.status === "opening" &&
        previous.lastRequestKey === requestKey &&
        previous.errorMessage === null
      ) {
        return state;
      }
      return {
        stateByKey: {
          ...state.stateByKey,
          [key]: {
            status: "opening",
            errorMessage: null,
            lastRequestKey: requestKey,
          },
        },
      };
    }),
  setOpen: (threadId, terminalId) =>
    set((state) => {
      const key = toTerminalLaunchKey(threadId, terminalId);
      const previous = state.stateByKey[key] ?? DEFAULT_TERMINAL_LAUNCH_STATE;
      if (previous.status === "open" && previous.errorMessage === null) {
        return state;
      }
      return {
        stateByKey: {
          ...state.stateByKey,
          [key]: {
            ...previous,
            status: "open",
            errorMessage: null,
          },
        },
      };
    }),
  setError: (threadId, terminalId, message) =>
    set((state) => {
      const key = toTerminalLaunchKey(threadId, terminalId);
      const previous = state.stateByKey[key] ?? DEFAULT_TERMINAL_LAUNCH_STATE;
      if (previous.status === "error" && previous.errorMessage === message) {
        return state;
      }
      return {
        stateByKey: {
          ...state.stateByKey,
          [key]: {
            ...previous,
            status: "error",
            errorMessage: message,
          },
        },
      };
    }),
  clear: (threadId, terminalId) =>
    set((state) => {
      const key = toTerminalLaunchKey(threadId, terminalId);
      if (state.stateByKey[key] === undefined) {
        return state;
      }
      const { [key]: _removed, ...rest } = state.stateByKey;
      return { stateByKey: rest };
    }),
}));

export function useTerminalLaunchState(threadId: string, terminalId: string): TerminalLaunchState {
  return useTerminalLaunchStore((state) =>
    selectTerminalLaunchState(state.stateByKey, threadId, terminalId),
  );
}

export function clearTerminalLaunchState(threadId: string, terminalId: string): void {
  useTerminalLaunchStore.getState().clear(threadId, terminalId);
  inFlightRequests.delete(toTerminalLaunchKey(threadId, terminalId));
}

export function applyTerminalLaunchEvent(event: TerminalEvent): void {
  const terminalId = event.terminalId ?? DEFAULT_TERMINAL_ID;
  const store = useTerminalLaunchStore.getState();
  const previous = selectTerminalLaunchState(store.stateByKey, event.threadId, terminalId);

  if (event.type === "started" || event.type === "restarted" || event.type === "output") {
    store.setOpen(event.threadId, terminalId);
    if (previous.status !== "open") {
      markTerminalPerformance("ready", event.threadId, terminalId);
    }
    return;
  }

  if (event.type === "error") {
    store.setError(event.threadId, terminalId, event.message);
    markTerminalPerformance("error", event.threadId, terminalId);
    return;
  }

  if (event.type === "exited") {
    store.clear(event.threadId, terminalId);
  }
}

export async function ensureTerminalOpen(input: TerminalOpenInput): Promise<void> {
  const api = readNativeApi();
  const terminalId = input.terminalId ?? DEFAULT_TERMINAL_ID;
  const terminalKey = toTerminalLaunchKey(input.threadId, terminalId);
  const requestKey = buildTerminalLaunchRequestKey({ ...input, terminalId });
  const launchState = selectTerminalLaunchState(
    useTerminalLaunchStore.getState().stateByKey,
    input.threadId,
    terminalId,
  );

  if (launchState.status === "open" && launchState.lastRequestKey === requestKey) {
    return;
  }
  if (launchState.status === "opening" && launchState.lastRequestKey === requestKey) {
    return;
  }

  const existingRequest = inFlightRequests.get(terminalKey);
  if (existingRequest && existingRequest.requestKey === requestKey) {
    return existingRequest.promise;
  }

  if (!api) {
    const message = "Terminal API is unavailable.";
    useTerminalLaunchStore.getState().setError(input.threadId, terminalId, message);
    throw new Error(message);
  }

  const startedAt = typeof performance !== "undefined" ? performance.now() : null;
  useTerminalLaunchStore.getState().setOpening(input.threadId, terminalId, requestKey);
  markTerminalPerformance("intent", input.threadId, terminalId);

  const request = api.terminal
    .open({ ...input, terminalId })
    .then((snapshot) => {
      if (snapshot.status === "error") {
        const message = "Terminal failed to start.";
        useTerminalLaunchStore.getState().setError(input.threadId, terminalId, message);
        throw new Error(message);
      }
      if (startedAt !== null && typeof performance !== "undefined") {
        try {
          performance.measure(
            `okcode:terminal:open:${input.threadId}:${terminalId}`,
            `okcode:terminal:intent:${input.threadId}:${terminalId}`,
          );
        } catch {
          // Best-effort instrumentation only.
        }
        const durationMs = roundDuration(performance.now() - startedAt);
        if (durationMs >= 0) {
          markTerminalPerformance("open-response", input.threadId, terminalId);
        }
      }
    })
    .catch((error) => {
      const message =
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Failed to open terminal.";
      useTerminalLaunchStore.getState().setError(input.threadId, terminalId, message);
      throw error;
    })
    .finally(() => {
      if (inFlightRequests.get(terminalKey)?.promise === request) {
        inFlightRequests.delete(terminalKey);
      }
    });

  inFlightRequests.set(terminalKey, { requestKey, promise: request });
  return request;
}
