import { useMemo } from "react";

import { useStore } from "../store";
import { useChatWidgetStore } from "../chatWidgetStore";
import { derivePendingApprovals, derivePendingUserInputs, derivePhase } from "../session-logic";

export type ChatWidgetTone = "idle" | "running" | "attention" | "error";

export interface ChatWidgetStatus {
  label: string;
  tone: ChatWidgetTone;
  threadTitle: string | null;
}

/**
 * Derives a compact status summary for the chat widget bubble from the
 * most-recently-active thread tracked by the widget store.
 */
export function useChatWidgetStatus(): ChatWidgetStatus {
  const lastThreadId = useChatWidgetStore((s) => s.lastThreadId);
  const thread = useStore((s) =>
    lastThreadId ? (s.threads.find((t) => t.id === lastThreadId) ?? null) : null,
  );

  return useMemo(() => {
    if (!thread) {
      return { label: "No active thread", tone: "idle" as const, threadTitle: null };
    }

    const phase = derivePhase(thread.session);
    const pendingApprovals = derivePendingApprovals(thread.activities);
    const pendingInputs = derivePendingUserInputs(thread.activities);

    if (thread.error) {
      return { label: "Error", tone: "error" as const, threadTitle: thread.title };
    }

    if (pendingApprovals.length > 0) {
      return { label: "Approval needed", tone: "attention" as const, threadTitle: thread.title };
    }

    if (pendingInputs.length > 0) {
      return { label: "Input needed", tone: "attention" as const, threadTitle: thread.title };
    }

    if (phase === "running") {
      return { label: "Running...", tone: "running" as const, threadTitle: thread.title };
    }

    if (phase === "connecting") {
      return { label: "Connecting...", tone: "running" as const, threadTitle: thread.title };
    }

    if (phase === "disconnected") {
      return { label: "Disconnected", tone: "idle" as const, threadTitle: thread.title };
    }

    return { label: "Ready", tone: "idle" as const, threadTitle: thread.title };
  }, [thread]);
}
