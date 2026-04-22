import { memo, useState, useCallback, useMemo, useEffect, useRef, useId } from "react";
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
import {
  buildThreadErrorDiagnosticsCopy,
  humanizeThreadError,
  isAuthenticationThreadError,
} from "./threadError";
import {
  getProviderStatusHeading,
  getProviderStatusDescription,
} from "./providerStatusPresentation";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { MessageCopyButton } from "./MessageCopyButton";

interface ErrorNotificationBarProps {
  /** Thread error string (from activeThread.error) */
  threadError: string | null;
  /** Whether to show auth failures as errors */
  showAuthFailuresAsErrors?: boolean;
  /** Whether notification details should start expanded */
  showNotificationDetails?: boolean;
  /** Whether copied diagnostics should include troubleshooting tips */
  includeDiagnosticsTipsInCopy?: boolean;
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
  kind: "connection" | "provider" | "thread-error";
  icon: React.ElementType;
  title: string;
  description: string;
  detailsText?: string | null;
  diagnosticsCopyText?: string | null;
  severity: "error" | "warning" | "info";
  dismissible: boolean;
  onDismiss?: () => void;
}

function buildThreadErrorNotificationId(error: string): string {
  return `thread-error:${error}`;
}

export const ErrorNotificationBar = memo(function ErrorNotificationBar({
  threadError,
  showAuthFailuresAsErrors = true,
  showNotificationDetails = false,
  includeDiagnosticsTipsInCopy = false,
  onDismissThreadError,
  providerStatus,
  transportState,
  isMobileCompanion,
}: ErrorNotificationBarProps) {
  const [isExpanded, setIsExpanded] = useState(showNotificationDetails);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const detailsPanelId = useId();

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
              kind: "connection",
              icon: WifiOffIcon,
              title: "Reconnecting to OK Code",
              description: "Trying to restore the remote session.",
              severity: "warning",
              dismissible: false,
            }
          : transportState === "closed"
            ? {
                id: "connection",
                kind: "connection",
                icon: WifiOffIcon,
                title: "Disconnected from OK Code",
                description: "The remote server is unavailable.",
                severity: "error",
                dismissible: false,
              }
            : {
                id: "connection",
                kind: "connection",
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
        kind: "provider",
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
          id: buildThreadErrorNotificationId(threadError),
          kind: "thread-error",
          icon: CircleAlertIcon,
          title: presentation.title ?? "Error",
          description: presentation.description,
          detailsText: presentation.technicalDetails ?? presentation.description,
          diagnosticsCopyText: buildThreadErrorDiagnosticsCopy(threadError, {
            includeTips: includeDiagnosticsTipsInCopy,
          }),
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
    includeDiagnosticsTipsInCopy,
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

  useEffect(() => {
    if (showNotificationDetails && notifications.length > 0) {
      setIsExpanded(true);
    }
  }, [notifications.length, showNotificationDetails]);

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
    setDismissedIds(new Set(visibleNotifications.filter((n) => n.dismissible).map((n) => n.id)));
  }, [visibleNotifications]);

  // Nothing to show
  if (visibleNotifications.length === 0) return null;

  const primary = visibleNotifications[0]!;
  const PrimaryIcon = primary.icon;
  const count = visibleNotifications.length;
  const countLabel = count === 1 ? "1 notification" : `${count} notifications`;

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
    <div data-slot="error-notification-bar" className="mx-auto w-full max-w-7xl px-3 pt-2 sm:px-5">
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-all duration-200",
          severityBg[highestSeverity],
        )}
      >
        {/* Collapsed bar - always visible */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <PrimaryIcon className={cn("size-3.5 shrink-0", severityColor[primary.severity])} />

          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/90">
            {primary.title}
          </span>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="xs"
              aria-expanded={isExpanded}
              aria-controls={detailsPanelId}
              aria-label={`${isExpanded ? "Hide" : "Show"} ${countLabel}`}
              className={cn(
                "min-w-0 gap-1.5 px-2 text-[10px] font-medium",
                isExpanded && "border-primary/30 bg-accent/70",
              )}
              onClick={() => setIsExpanded((v) => !v)}
            >
              <span className="tabular-nums">{count}</span>
              {isExpanded ? (
                <ChevronUpIcon className="size-3" />
              ) : (
                <ChevronDownIcon className="size-3" />
              )}
            </Button>

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
          <div id={detailsPanelId} className="border-t border-current/5 px-3 pb-2 pt-2">
            {visibleNotifications.map((notif) => {
              const Icon = notif.icon;
              const detailsText = notif.detailsText?.trim() ?? null;
              return (
                <div key={notif.id} className="flex items-start gap-2 py-1.5 text-xs">
                  <Icon className={cn("mt-0.5 size-3 shrink-0", severityColor[notif.severity])} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground/90">{notif.title}</p>
                    <p className="text-muted-foreground">{notif.description}</p>
                    {detailsText && detailsText !== notif.description ? (
                      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-md border border-current/5 bg-background/70 px-2 py-1 font-mono text-[10px] leading-4 text-muted-foreground/80">
                        {detailsText}
                      </pre>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex shrink-0 items-center gap-1">
                    {notif.kind === "thread-error" && notif.diagnosticsCopyText ? (
                      <MessageCopyButton
                        text={notif.diagnosticsCopyText}
                        label="diagnostics"
                        className="size-6 rounded-md"
                      />
                    ) : null}
                    {notif.dismissible ? (
                      <button
                        type="button"
                        aria-label="Dismiss"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground"
                        onClick={() => handleDismiss(notif)}
                      >
                        <XIcon className="size-2.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
