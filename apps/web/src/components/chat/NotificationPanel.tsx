import { memo, useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "lucide-react";

import { Popover, PopoverTrigger, PopoverPopup } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { useNotificationStore, selectUnreadCount } from "~/notificationStore";
import type { Notification } from "~/notificationStore";

// ── Helpers ──────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function groupBySource(notifications: Notification[]): Map<Notification["source"], Notification[]> {
  const groups = new Map<Notification["source"], Notification[]>();
  for (const n of notifications) {
    const list = groups.get(n.source);
    if (list) {
      list.push(n);
    } else {
      groups.set(n.source, [n]);
    }
  }
  return groups;
}

// ── Component ────────────────────────────────────────────────────────

export const NotificationPanel = memo(function NotificationPanel() {
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore(selectUnreadCount);
  const dismissNotification = useNotificationStore((s) => s.dismissNotification);
  const dismissAll = useNotificationStore((s) => s.dismissAll);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const [open, setOpen] = useState(false);
  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-mark all as read after 2 s while panel is open
  useEffect(() => {
    if (open && unreadCount > 0) {
      markReadTimer.current = setTimeout(() => {
        markAllRead();
      }, 2000);
    }
    return () => {
      if (markReadTimer.current) {
        clearTimeout(markReadTimer.current);
        markReadTimer.current = null;
      }
    };
  }, [open, unreadCount, markAllRead]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, []);

  const grouped = groupBySource(notifications);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="relative inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent [-webkit-app-region:no-drag]"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          />
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverPopup side="bottom" align="end" className="w-80">
        {/* Header */}
        <div className="-mx-4 -mt-4 flex items-center justify-between border-b border-border/50 px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {notifications.length > 0 && (
            <Button variant="ghost" size="xs" onClick={dismissAll}>
              Dismiss All
            </Button>
          )}
        </div>

        {/* Notification list */}
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="-mx-4 -mb-4 max-h-80 overflow-y-auto">
            {[...grouped.entries()].map(([source, items]) => (
              <div key={source}>
                <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {source}
                </div>
                {items.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex flex-col gap-1.5 border-b border-border/50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {notification.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimeAgo(notification.timestamp)}
                      </span>
                    </div>
                    {notification.description && (
                      <p className="text-xs text-muted-foreground">{notification.description}</p>
                    )}
                    {notification.actions && notification.actions.length > 0 && (
                      <div className="mt-0.5 flex gap-1.5">
                        {notification.actions.map((action, i) => (
                          <Button
                            key={i}
                            size="xs"
                            variant={
                              action.variant === "primary"
                                ? "default"
                                : action.variant === "destructive"
                                  ? "destructive"
                                  : "outline"
                            }
                            onClick={() => {
                              action.onAction();
                              dismissNotification(notification.id);
                            }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
});
