import { memo } from "react";
import { CheckIcon, LoaderIcon } from "lucide-react";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanChecklistItemData {
  /** Display text of the step. */
  text: string;
  /** Execution status. */
  status: "pending" | "inProgress" | "completed";
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
        </p>
      </div>

      {/* Items */}
      <div className="rounded-xl border border-border/50 bg-background/40">
        {items.map((item, index) => (
          <PlanChecklistRow
            key={item.text}
            item={item}
            index={index}
            isLast={index === items.length - 1}
            live={live}
          />
        ))}
      </div>

      {/* Progress summary */}
      {completedCount > 0 && completedCount < items.length ? (
        <div className="flex items-center gap-2.5 px-1">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-emerald-500/70 transition-all duration-500 ease-out"
              style={{
                width: `${Math.round((completedCount / items.length) * 100)}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/50">
            {completedCount}/{items.length}
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
  return (
    <div
      data-slot="plan-checklist-item"
      data-status={item.status}
      className={cn(
        "flex items-start gap-3 px-3.5 py-2.5 transition-colors duration-150",
        !isLast && "border-b border-border/30",
        item.status === "inProgress" && "bg-blue-500/[0.03]",
      )}
    >
      {/* Status indicator */}
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <ChecklistStatusIndicator status={item.status} live={live} />
      </div>

      {/* Text */}
      <p
        className={cn(
          "min-w-0 flex-1 text-[13px] leading-snug",
          item.status === "completed"
            ? "text-muted-foreground/45 line-through decoration-muted-foreground/20"
            : item.status === "inProgress"
              ? "text-foreground/90 font-medium"
              : "text-foreground/70",
        )}
      >
        {item.text}
      </p>

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
  live,
}: {
  status: PlanChecklistItemData["status"];
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

export default PlanChecklist;
export type { PlanChecklistProps };
