import { memo } from "react";
import { CheckIcon, LoaderIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "./ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanChecklistItemData {
  /** Display text of the step. */
  text: string;
  /** Execution status. */
  status: "pending" | "inProgress" | "completed";
  /** Optional supporting note shown below the step. */
  note?: string;
  /** Optional status label override shown beside the step. */
  statusText?: string;
  /** Optional badge tone for the status label override. */
  statusTone?: "success" | "info" | "warning";
}

interface PlanChecklistProps {
  /** Checklist items to render. */
  items: PlanChecklistItemData[];
  /**
   * Completion mode label shown in the header.
   * @default "Completed In Order"
   */
  completionMode?: string;
  /** Whether the checklist represents a live execution (enables animated indicators). */
  live?: boolean;
  /** Additional class names for the outer container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PlanChecklist = memo(function PlanChecklist({
  items,
  completionMode = "Completed In Order",
  live = false,
  className,
}: PlanChecklistProps) {
  if (items.length === 0) return null;

  const completedCount = items.filter((item) => item.status === "completed").length;

  return (
    <div data-slot="plan-checklist" className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] text-muted-foreground/60">
          <span className="tabular-nums font-medium text-muted-foreground/80">{items.length}</span>{" "}
          {items.length === 1 ? "To-do" : "To-dos"}
          <span className="mx-1.5 text-muted-foreground/30">&middot;</span>
          <span>{completionMode}</span>
          {completedCount > 0 ? (
            <>
              <span className="mx-1.5 text-muted-foreground/30">&middot;</span>
              <span className="font-medium text-emerald-700/80 dark:text-emerald-300/85">
                {completedCount === items.length ? "All done" : `${completedCount} done`}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border/50 bg-background/40">
        {items.map((item, index) => (
          <PlanChecklistRow
            key={`${item.text}:${item.note ?? ""}:${item.statusText ?? item.status}`}
            item={item}
            index={index}
            isLast={index === items.length - 1}
            live={live}
          />
        ))}
      </div>

      {/* Progress summary */}
      {completedCount > 0 ? (
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all duration-500 ease-out"
              style={{
                width: `${Math.round((completedCount / items.length) * 100)}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-emerald-700/80 dark:text-emerald-300/80">
            {completedCount === items.length ? "Done" : `${completedCount}/${items.length} done`}
          </span>
        </div>
      ) : null}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

const PlanChecklistRow = memo(function PlanChecklistRow({
  item,
  index,
  isLast,
  live,
}: {
  item: PlanChecklistItemData;
  index: number;
  isLast: boolean;
  live: boolean;
}) {
  const statusBadge = resolveChecklistStatusBadge(item);

  return (
    <div
      data-slot="plan-checklist-item"
      data-status={item.status}
      className={cn(
        "flex items-start gap-3 px-3.5 py-2.5 transition-colors duration-150",
        !isLast && "border-b border-border/30",
        item.status === "completed" && "bg-emerald-500/[0.04]",
        item.status === "inProgress" &&
          (item.statusTone === "warning" ? "bg-amber-500/[0.06]" : "bg-blue-500/[0.03]"),
      )}
    >
      {/* Status indicator */}
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <ChecklistStatusIndicator status={item.status} statusTone={item.statusTone} live={live} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13px] leading-snug",
            item.status === "completed"
              ? "text-emerald-800 dark:text-emerald-200/95"
              : item.status === "inProgress"
                ? "font-medium text-foreground/90"
                : "text-foreground/70",
          )}
        >
          {item.text}
        </p>
        {item.note ? (
          <p
            className={cn(
              "mt-1 text-[11px] leading-relaxed",
              item.statusTone === "warning"
                ? "text-amber-800/80 dark:text-amber-200/80"
                : "text-muted-foreground/65",
            )}
          >
            {item.note}
          </p>
        ) : null}
      </div>

      {statusBadge ? (
        <Badge size="sm" variant={statusBadge.variant} className="mt-0.5 shrink-0">
          {statusBadge.label}
        </Badge>
      ) : null}

      {/* Item number */}
      <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-muted-foreground/25">
        {index + 1}
      </span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function ChecklistStatusIndicator({
  status,
  statusTone,
  live,
}: {
  status: PlanChecklistItemData["status"];
  statusTone?: PlanChecklistItemData["statusTone"];
  live: boolean;
}) {
  if (status === "completed") {
    return (
      <span className="flex size-[18px] items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 ring-1 ring-emerald-500/25">
        <CheckIcon className="size-3" strokeWidth={2.5} />
      </span>
    );
  }

  if (status === "inProgress") {
    if (statusTone === "warning") {
      return (
        <span className="flex size-[18px] items-center justify-center rounded-full bg-amber-500/10 text-amber-700 ring-1 ring-amber-400/30 dark:text-amber-300">
          <span className="text-[11px] font-semibold leading-none">?</span>
        </span>
      );
    }
    return (
      <span className="flex size-[18px] items-center justify-center rounded-full bg-blue-500/10 text-blue-400 ring-1 ring-blue-400/30">
        {live ? (
          <LoaderIcon className="size-3 animate-spin" />
        ) : (
          <span className="size-2 rounded-full bg-blue-400" />
        )}
      </span>
    );
  }

  // pending
  return (
    <span className="flex size-[18px] items-center justify-center rounded-full ring-1 ring-border/60">
      <span className="size-1.5 rounded-full bg-muted-foreground/20" />
    </span>
  );
}

function resolveChecklistStatusBadge(
  item: PlanChecklistItemData,
): { label: string; variant: "success" | "info" | "warning" } | null {
  if (item.statusText && item.statusTone) {
    return {
      label: item.statusText,
      variant: item.statusTone,
    };
  }

  if (item.status === "completed") {
    return { label: "Done", variant: "success" };
  }

  if (item.status === "inProgress") {
    return { label: "Working", variant: "info" };
  }

  return null;
}

export default PlanChecklist;
export type { PlanChecklistProps };
