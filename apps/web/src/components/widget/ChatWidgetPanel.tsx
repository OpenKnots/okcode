import { type ReactNode, memo, useCallback, useRef } from "react";
import { cn } from "~/lib/utils";
import { useChatWidgetStore } from "../../chatWidgetStore";

const SWIPE_THRESHOLD_PX = 80;
const SWIPE_VELOCITY_THRESHOLD = 0.3; // px/ms

/**
 * The expanded panel container for the chat widget.
 * Wraps children (the full chat layout) and provides a swipe-down-to-minimize
 * gesture on the top drag handle.
 */
export const ChatWidgetPanel = memo(function ChatWidgetPanel({
  children,
  expanded,
}: {
  children: ReactNode;
  expanded: boolean;
}) {
  const minimize = useChatWidgetStore((s) => s.minimize);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { y: touch.clientY, time: Date.now() };
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const start = touchStartRef.current;
      const touch = e.changedTouches[0];
      if (!start || !touch) {
        touchStartRef.current = null;
        return;
      }

      const deltaY = touch.clientY - start.y;
      const elapsed = Date.now() - start.time;
      const velocity = elapsed > 0 ? deltaY / elapsed : 0;

      if (deltaY > SWIPE_THRESHOLD_PX || velocity > SWIPE_VELOCITY_THRESHOLD) {
        minimize();
      }
      touchStartRef.current = null;
    },
    [minimize],
  );

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed inset-0 z-[55] flex flex-col bg-background transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
        expanded ? "translate-y-0" : "translate-y-full pointer-events-none",
      )}
    >
      {/* Swipe-down drag handle */}
      <div
        className="flex h-6 shrink-0 cursor-grab items-center justify-center touch-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Chat content */}
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
});
