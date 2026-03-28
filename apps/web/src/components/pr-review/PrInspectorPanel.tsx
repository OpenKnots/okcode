import type { NativeApi, PrConflictAnalysis, PrReviewConfig } from "@okcode/contracts";
import { useEffect, useRef, type ReactNode } from "react";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MessageSquareIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import type { InspectorTab } from "./pr-review-utils";

export function PrInspectorPanel({
  collapsed,
  onToggleCollapsed,
  onExpandToTab,
  unresolvedThreadCount,
  hasBlockedWorkflow,
  children,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onExpandToTab?: (tab: InspectorTab) => void;
  unresolvedThreadCount: number;
  hasBlockedWorkflow: boolean;
  children: ReactNode;
}) {
  if (collapsed) {
    return (
      <div className="flex min-h-0 w-12 flex-col items-center border-l border-border/70 bg-background/96 py-2 gap-1">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onToggleCollapsed}
          title="Expand inspector"
          className="mb-2"
        >
          <ChevronsLeftIcon className="size-4" />
        </Button>
        <Tooltip>
          <TooltipTrigger
            onClick={() => onExpandToTab?.("threads")}
            render={
              <button
                type="button"
                className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
              />
            }
          >
            <MessageSquareIcon className="size-4" />
            {unresolvedThreadCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                {unresolvedThreadCount > 9 ? "9+" : unresolvedThreadCount}
              </span>
            ) : null}
          </TooltipTrigger>
          <TooltipPopup side="left" sideOffset={8}>
            Threads ({unresolvedThreadCount} open)
          </TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            onClick={() => onExpandToTab?.("workflow")}
            render={
              <button
                type="button"
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-muted/50",
                  hasBlockedWorkflow
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              />
            }
          >
            <SparklesIcon className="size-4" />
            {hasBlockedWorkflow ? (
              <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500" />
            ) : null}
          </TooltipTrigger>
          <TooltipPopup side="left" sideOffset={8}>
            Workflow {hasBlockedWorkflow ? "(blocked)" : ""}
          </TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            onClick={() => onExpandToTab?.("people")}
            render={
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
              />
            }
          >
            <UsersIcon className="size-4" />
          </TooltipTrigger>
          <TooltipPopup side="left" sideOffset={8}>
            People
          </TooltipPopup>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-[360px] flex-col border-l border-border/70">
      <div className="flex h-10 items-center justify-end px-2 border-b border-border/70">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={onToggleCollapsed}
          title="Collapse inspector"
        >
          <ChevronsRightIcon className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
