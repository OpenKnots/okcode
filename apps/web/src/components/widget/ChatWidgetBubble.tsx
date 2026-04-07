import { memo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircleIcon } from "lucide-react";

import { useChatWidgetStore } from "../../chatWidgetStore";
import { useMobileConnectionState } from "../../hooks/useMobileConnectionState";
import { useChatWidgetStatus, type ChatWidgetTone } from "../../hooks/useChatWidgetStatus";

const TONE_DOT_CLASSES: Record<ChatWidgetTone, string> = {
  idle: "bg-emerald-500 dark:bg-emerald-400",
  running: "bg-blue-500 dark:bg-blue-400 animate-pulse",
  attention: "bg-amber-500 dark:bg-amber-400 animate-pulse",
  error: "bg-red-500 dark:bg-red-400",
};

/**
 * The minimized floating pill/bubble for the chat widget.
 * Shows connection status, thread title, and activity status.
 * Tapping expands back to the full chat.
 */
export const ChatWidgetBubble = memo(function ChatWidgetBubble() {
  const expand = useChatWidgetStore((s) => s.expand);
  const lastThreadId = useChatWidgetStore((s) => s.lastThreadId);
  const navigate = useNavigate();
  const connectionState = useMobileConnectionState();
  const { label, tone, threadTitle } = useChatWidgetStatus();

  const isDisconnected = connectionState === "disconnected" || connectionState === "reconnecting";

  const handleClick = useCallback(() => {
    expand();
    if (lastThreadId) {
      void navigate({ to: "/$threadId", params: { threadId: lastThreadId } });
    }
  }, [expand, lastThreadId, navigate]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-[max(env(safe-area-inset-bottom,16px),16px)] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-border/60 bg-card/90 px-4 py-2.5 shadow-2xl shadow-black/20 backdrop-blur-md transition-transform duration-200 active:scale-95 dark:border-border/40 dark:bg-card/80 dark:shadow-black/40"
      aria-label="Expand chat"
    >
      {/* Status dot */}
      <span className="relative flex size-2.5 shrink-0">
        {isDisconnected ? (
          <span className="size-2.5 rounded-full bg-red-500 dark:bg-red-400" />
        ) : (
          <span className={`size-2.5 rounded-full ${TONE_DOT_CLASSES[tone]}`} />
        )}
      </span>

      {/* Thread title or app name */}
      <span className="max-w-[180px] truncate text-sm font-medium text-foreground">
        {threadTitle ?? "OK Code"}
      </span>

      {/* Activity label */}
      <span className="shrink-0 text-xs text-muted-foreground">
        {isDisconnected ? "Offline" : label}
      </span>

      {/* Chat icon */}
      <MessageCircleIcon className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
});
