import { useState } from "react";
import { AlertTriangleIcon, ChevronDownIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function PrRuleViolationBanner({
  approvalBlockers,
  onOpenConflictDrawer,
}: {
  approvalBlockers: string[];
  onOpenConflictDrawer: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (approvalBlockers.length === 0) return null;

  const hasConflictBlocker = approvalBlockers.some((blocker) =>
    blocker.toLowerCase().includes("conflict"),
  );

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/8">
      {/* Collapsed header */}
      <button
        className="flex w-full items-center justify-between gap-3 px-3 py-2"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
          <ShieldCheckIcon className="size-3.5 shrink-0" />
          <span>
            {approvalBlockers.length} approval blocker{approvalBlockers.length === 1 ? "" : "s"}
          </span>
        </div>
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-amber-600 transition-transform dark:text-amber-400",
            expanded && "rotate-180",
          )}
        />
      </button>

      {/* Expanded list */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-1.5 px-3 pb-2.5">
            {approvalBlockers.map((blocker) => (
              <div
                className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200"
                key={blocker}
              >
                <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-amber-500" />
                <span>{blocker}</span>
              </div>
            ))}
            {hasConflictBlocker ? (
              <div className="pt-1">
                <Button onClick={onOpenConflictDrawer} size="xs" variant="outline">
                  <ShieldCheckIcon className="size-3.5" />
                  View conflicts
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
