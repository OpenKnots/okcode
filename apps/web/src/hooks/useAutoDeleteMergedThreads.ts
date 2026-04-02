import { useEffect, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import type { ThreadId } from "@okcode/contracts";

import type { AppSettings } from "../appSettings";
import { gitStatusQueryOptions } from "../lib/gitReactQuery";
import { readNativeApi } from "../nativeApi";
import { newCommandId } from "../lib/utils";
import { useStore } from "../store";
import { toastManager } from "../components/ui/toast";

/**
 * Duration before a merged-thread countdown toast auto-dismisses (so it stays
 * visible long enough for the user to cancel, but isn't permanent).
 */
const TOAST_VISIBLE_MS = 30_000;

interface MergedThreadTimer {
  timeoutId: ReturnType<typeof setTimeout>;
  toastId: ReturnType<typeof toastManager.add> | null;
}

/**
 * Watches every active thread's git status.  When the associated PR transitions
 * to "merged", starts a countdown and then auto-deletes the thread.
 *
 * The feature is gated behind two app-settings:
 *   - `autoDeleteMergedThreads`            – master toggle  (default off)
 *   - `autoDeleteMergedThreadsDelayMinutes` – countdown duration (default 5 min)
 *
 * A toast is shown so the user can cancel before the timer fires.
 */
export function useAutoDeleteMergedThreads(settings: AppSettings) {
  const threads = useStore((store) => store.threads);
  const projects = useStore((store) => store.projects);

  // Track active timers per thread so we can cancel on setting change or
  // unmount, and avoid double-scheduling.
  const timersRef = useRef<Map<ThreadId, MergedThreadTimer>>(new Map());

  const enabled = settings.autoDeleteMergedThreads;
  const delayMinutes = settings.autoDeleteMergedThreadsDelayMinutes;

  // Build a cwd for each thread (worktree path takes priority).
  const threadCwds = threads.map((thread) => {
    const project = projects.find((p) => p.id === thread.projectId);
    return thread.worktreePath ?? project?.cwd ?? null;
  });

  // Query git status for every thread – the query already polls at 15 s intervals.
  const statusQueries = useQueries({
    queries: threads.map((thread, index) =>
      gitStatusQueryOptions(enabled ? threadCwds[index]! : null),
    ),
  });

  useEffect(() => {
    if (!enabled) {
      // Feature was just toggled off – cancel all pending timers.
      for (const [, timer] of timersRef.current) {
        clearTimeout(timer.timeoutId);
        if (timer.toastId !== null) {
          toastManager.close(timer.toastId);
        }
      }
      timersRef.current.clear();
      return;
    }

    const delayMs = Math.max(1, delayMinutes) * 60_000;

    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i]!;
      const prState = statusQueries[i]?.data?.pr?.state;

      if (prState === "merged" && !timersRef.current.has(thread.id)) {
        // PR just detected as merged – start countdown.
        const threadTitle = thread.title || `Thread ${thread.id.slice(0, 8)}`;
        const minutesLabel =
          delayMinutes === 1 ? "1 minute" : `${delayMinutes} minutes`;

        const toastId = toastManager.add({
          type: "info",
          title: `PR merged – "${threadTitle}" will be deleted`,
          description: `Auto-deleting in ${minutesLabel}. Click Cancel to keep it.`,
          dismissAfterVisibleMs: TOAST_VISIBLE_MS,
          actionProps: {
            children: "Cancel",
            onClick: () => {
              const timer = timersRef.current.get(thread.id);
              if (timer) {
                clearTimeout(timer.timeoutId);
                timersRef.current.delete(thread.id);
              }
              toastManager.add({
                type: "success",
                title: "Auto-delete cancelled",
                description: `"${threadTitle}" will be kept.`,
              });
            },
          },
        });

        const timeoutId = setTimeout(() => {
          void deleteThreadById(thread.id);
          timersRef.current.delete(thread.id);
          toastManager.add({
            type: "success",
            title: "Merged thread deleted",
            description: `"${threadTitle}" was auto-deleted after its PR was merged.`,
          });
        }, delayMs);

        timersRef.current.set(thread.id, { timeoutId, toastId });
      }

      // If a timer exists but the thread is gone (deleted externally), clean up.
      if (prState !== "merged" && timersRef.current.has(thread.id)) {
        const timer = timersRef.current.get(thread.id)!;
        clearTimeout(timer.timeoutId);
        if (timer.toastId !== null) {
          toastManager.close(timer.toastId);
        }
        timersRef.current.delete(thread.id);
      }
    }

    // Also prune timers for threads that no longer exist in the list.
    const currentThreadIds = new Set(threads.map((t) => t.id));
    for (const [threadId, timer] of timersRef.current) {
      if (!currentThreadIds.has(threadId)) {
        clearTimeout(timer.timeoutId);
        if (timer.toastId !== null) {
          toastManager.close(timer.toastId);
        }
        timersRef.current.delete(threadId);
      }
    }
  }, [enabled, delayMinutes, threads, statusQueries]);

  // Cleanup all timers on unmount.
  useEffect(() => {
    return () => {
      for (const [, timer] of timersRef.current) {
        clearTimeout(timer.timeoutId);
      }
      timersRef.current.clear();
    };
  }, []);
}

/**
 * Minimal thread deletion: stops the session, closes the terminal, and
 * dispatches the `thread.delete` command.  Does not handle navigation or
 * worktree cleanup – callers higher up in the tree will react to the
 * projection change.
 */
async function deleteThreadById(threadId: ThreadId): Promise<void> {
  const api = readNativeApi();
  if (!api) return;

  try {
    await api.orchestration
      .dispatchCommand({
        type: "thread.session.stop",
        commandId: newCommandId(),
        threadId,
        createdAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  } catch {
    // Session may already be stopped.
  }

  try {
    await api.terminal.close({ threadId, deleteHistory: true });
  } catch {
    // Terminal may already be closed.
  }

  await api.orchestration.dispatchCommand({
    type: "thread.delete",
    commandId: newCommandId(),
    threadId,
  });
}
