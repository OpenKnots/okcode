import { memo, useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  CircleAlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
  WifiOffIcon,
  WifiIcon,
} from "lucide-react";
import { type ServerProviderStatus } from "@okcode/contracts";
import type { TransportState } from "../../wsTransport";
import { humanizeThreadError, isAuthenticationThreadError } from "./threadError";
import {
  getProviderStatusHeading,
  getProviderStatusDescription,
} from "./providerStatusPresentation";
import { cn } from "~/lib/utils";

interface ErrorNotificationBarProps {
  /** Thread error string (from activeThread.error) */
  threadError: string | null;
  /** Whether to show auth failures as errors */
  showAuthFailuresAsErrors?: boolean;
  /** Dismiss the thread error */
  onDismissThreadError?: () => void;
  /** Provider health status */
  providerStatus: ServerProviderStatus | null;
  /** Companion transport state (only relevant for mobile companion) */
  transportState?: TransportState;
  /** Whether this is a mobile companion */
  isMobileCompanion?: boolean;
}

interface NotificationItem {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  technicalDetails?: string | null;
  severity: "error" | "warning" | "info";
  dismissible: boolean;
  onDismiss?: () => void;
}

export const ErrorNotificationBar = memo(function ErrorNotificationBar({
  threadError,
  showAuthFailuresAsErrors = true,
  onDismissThreadError,
  providerStatus,
  transportState,
  isMobileCompanion,
}: ErrorNotificationBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Track which notification IDs are currently active so we can
  // re-show a notification if the error clears and returns.
  const prevActiveIdsRef = useRef<Set<string>>(new Set());

  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];

    // Connection status notification (mobile companion only)
    if (isMobileCompanion && transportState && transportState !== "open") {
      const connectionNotif: NotificationItem =
        transportState === "reconnecting"
          ? {
              id: "connection",
              icon: WifiOffIcon,
              title: "Reconnecting to OK Code",
              description: "Trying to restore the remote session.",
              severity: "warning",
              dismissible: false,
            }
          : transportState === "closed"
            ? {
                id: "connection",
                icon: WifiOffIcon,
                title: "Disconnected from OK Code",
                description: "The remote server is unavailable.",
                severity: "error",
                dismissible: false,
              }
            : {
                id: "connection",
                icon: WifiIcon,
                title: "Connecting to OK Code",
                description: "Establishing the remote session connection.",
                severity: "info",
                dismissible: false,
              };
      items.push(connectionNotif);
    }

    // Provider health notification
    if (providerStatus && providerStatus.status !== "ready") {
      const title = getProviderStatusHeading(providerStatus);
      const description = getProviderStatusDescription(providerStatus);
      items.push({
        id: "provider",
        icon: CircleAlertIcon,
        title,
        description,
        severity: providerStatus.status === "error" ? "error" : "warning",
        dismissible: false,
      });
    }

    // Thread error notification
    if (threadError) {
      if (showAuthFailuresAsErrors || !isAuthenticationThreadError(threadError)) {
        const presentation = humanizeThreadError(threadError);
        items.push({
          id: "thread-error",
          icon: CircleAlertIcon,
          title: presentation.title ?? "Error",
          description: presentation.description,
          technicalDetails: presentation.technicalDetails,
          severity: "error",
          dismissible: !!onDismissThreadError,
          ...(onDismissThreadError ? { onDismiss: onDismissThreadError } : {}),
        });
      }
    }

    return items;
  }, [
    threadError,
    showAuthFailuresAsErrors,
    onDismissThreadError,
    providerStatus,
    transportState,
    isMobileCompanion,
  ]);

  // When an error clears and a new one appears for the same source,
  // un-dismiss it so the user sees the new error.
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const prevIds = prevActiveIdsRef.current;

    // Find IDs that were absent last render but are now present (re-appeared)
    const reappeared = new Set<string>();
    for (const id of currentIds) {
      if (!prevIds.has(id)) {
        reappeared.add(id);
      }
    }

    if (reappeared.size > 0) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        for (const id of reappeared) {
          next.delete(id);
        }
        return next.size === prev.size ? prev : next;
      });
    }

    // Collapse expanded view when all errors resolve
    if (currentIds.size === 0 && isExpanded) {
      setIsExpanded(false);
    }

    prevActiveIdsRef.current = currentIds;
  }, [notifications, isExpanded]);

  const visibleNotifications = notifications.filter((n) => !dismissedIds.has(n.id));

  const handleDismiss = useCallback((notif: NotificationItem) => {
    if (notif.onDismiss) {
      notif.onDismiss();
    }
    setDismissedIds((prev) => new Set(prev).add(notif.id));
  }, []);

  const handleDismissAll = useCallback(() => {
    for (const notif of visibleNotifications) {
      if (notif.dismissible && notif.onDismiss) {
        notif.onDismiss();
      }
    }
    setDismissedIds(new Set(notifications.map((n) => n.id)));
  }, [visibleNotifications, notifications]);

  // Nothing to show
  if (visibleNotifications.length === 0) return null;

  const primary = visibleNotifications[0]!;
  const PrimaryIcon = primary.icon;
  const count = visibleNotifications.length;
  const hasMultiple = count > 1;

  const severityColor = {
    error: "text-destructive",
    warning: "text-warning",
    info: "text-info",
  } as const;

  const severityBg = {
    error: "bg-destructive/6 border-destructive/20",
    warning: "bg-warning/6 border-warning/20",
    info: "bg-info/6 border-info/20",
  } as const;

  // Find the highest severity across all notifications
  const highestSeverity = visibleNotifications.reduce<"error" | "warning" | "info">((acc, n) => {
    if (acc === "error" || n.severity === "error") return "error";
    if (acc === "warning" || n.severity === "warning") return "warning";
    return "info";
  }, "info");

  return (
    <div className="mx-auto w-full max-w-7xl px-3 pt-2 sm:px-5">
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-all duration-200",
          severityBg[highestSeverity],
        )}
      >
        {/* Collapsed bar - always visible */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <PrimaryIcon className={cn("size-3.5 shrink-0", severityColor[primary.severity])} />

          <span className="min-w-0 flex-1 truncate text-xs text-foreground/90">
            {primary.title !== "Error" ? (
              <>
                <span className="font-medium">{primary.title}</span>
                <span className="text-muted-foreground"> — {primary.description}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{primary.description}</span>
            )}
          </span>

          <div className="flex shrink-0 items-center gap-1">
            {/* Count badge */}
            {hasMultiple && (
              <span
                className={cn(
                  "inline-flex size-4 items-center justify-center rounded-full text-[10px] font-medium leading-none text-white",
                  highestSeverity === "error"
                    ? "bg-destructive/80"
                    : highestSeverity === "warning"
                      ? "bg-warning/80"
                      : "bg-info/80",
                )}
              >
                {count}
              </span>
            )}

            {/* Expand/collapse toggle */}
            {(hasMultiple || primary.technicalDetails) && (
              <button
                type="button"
                aria-label={isExpanded ? "Collapse notifications" : "Expand notifications"}
                className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
                onClick={() => setIsExpanded((v) => !v)}
              >
                {isExpanded ? (
                  <ChevronUpIcon className="size-3" />
                ) : (
                  <ChevronDownIcon className="size-3" />
                )}
              </button>
            )}

            {/* Dismiss button */}
            <button
              type="button"
              aria-label="Dismiss notifications"
              className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-foreground"
              onClick={handleDismissAll}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        </div>

        {/* Expanded view */}
        {isExpanded && (
          <div className="border-t border-current/5 px-3 pb-2 pt-1">
            {visibleNotifications.map((notif) => {
              const Icon = notif.icon;
              return (
                <div key={notif.id} className="flex items-start gap-2 py-1.5 text-xs">
                  <Icon className={cn("mt-0.5 size-3 shrink-0", severityColor[notif.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground/90">{notif.title}</p>
                    <p className="text-muted-foreground">{notif.description}</p>
                    {notif.technicalDetails && (
                      <details className="mt-1">
                        <summary className="cursor-pointer select-none text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
                          Technical details
                        </summary>
                        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap break-words text-[10px] text-muted-foreground/60">
                          {notif.technicalDetails}
                        </pre>
                      </details>
                    )}
                  </div>
                  {notif.dismissible && (
                    <button
                      type="button"
                      aria-label="Dismiss"
                      className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-foreground"
                      onClick={() => handleDismiss(notif)}
                    >
                      <XIcon className="size-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
