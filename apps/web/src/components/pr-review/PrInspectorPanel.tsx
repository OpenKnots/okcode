import { useId, type ReactNode } from "react";
import {
  BookOpenCheckIcon,
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
  hasAgentFindings = false,
  agentReviewRunning = false,
  children,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onExpandToTab?: (tab: InspectorTab) => void;
  unresolvedThreadCount: number;
  hasBlockedWorkflow: boolean;
  hasAgentFindings?: boolean;
  agentReviewRunning?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();

  return (
    <aside
      id={panelId}
      aria-label="Pull request inspector"
      className={cn(
        "flex min-h-0 flex-col border-l border-border/70",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-12 bg-background/96" : "w-[360px]",
      )}
    >
      {collapsed ? (
        /* ---------- Collapsed icon rail ---------- */
        <div className="flex min-h-0 flex-1 w-12 shrink-0 flex-col items-center py-2 gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onToggleCollapsed}
            aria-expanded={false}
            aria-controls={panelId}
            aria-label="Expand inspector panel"
            className="mb-2"
          >
            <ChevronsLeftIcon className="size-4" />
          </Button>

          {/* AI */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onExpandToTab?.("ai")}
              render={
                <button
                  type="button"
                  aria-label={`AI findings${hasAgentFindings ? ", findings available" : ""}`}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-muted/50",
                    agentReviewRunning
                      ? "text-indigo-500 animate-pulse"
                      : hasAgentFindings
                        ? "text-indigo-500"
                        : "text-muted-foreground",
                  )}
                />
              }
            >
              <SparklesIcon className="size-4" />
              {hasAgentFindings ? (
                <span
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-indigo-500"
                  aria-hidden="true"
                />
              ) : null}
            </TooltipTrigger>
            <TooltipPopup side="left" sideOffset={8}>
              AI Findings
              {agentReviewRunning ? " (running)" : hasAgentFindings ? " (available)" : ""}
            </TooltipPopup>
          </Tooltip>

          {/* Threads */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onExpandToTab?.("threads")}
              render={
                <button
                  type="button"
                  aria-label={`Threads, ${unresolvedThreadCount} unresolved`}
                  className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
                />
              }
            >
              <MessageSquareIcon className="size-4" />
              {unresolvedThreadCount > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-700 dark:text-amber-300"
                  aria-hidden="true"
                >
                  {unresolvedThreadCount > 9 ? "9+" : unresolvedThreadCount}
                </span>
              ) : null}
            </TooltipTrigger>
            <TooltipPopup side="left" sideOffset={8}>
              Threads ({unresolvedThreadCount} open)
            </TooltipPopup>
          </Tooltip>

          {/* Workflow */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onExpandToTab?.("workflow")}
              render={
                <button
                  type="button"
                  aria-label={`Workflow${hasBlockedWorkflow ? ", blocked" : ""}`}
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
                <span
                  className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
              ) : null}
            </TooltipTrigger>
            <TooltipPopup side="left" sideOffset={8}>
              Workflow {hasBlockedWorkflow ? "(blocked)" : ""}
            </TooltipPopup>
          </Tooltip>

          {/* Rules */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onExpandToTab?.("rules")}
              render={
                <button
                  type="button"
                  aria-label="Rules"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50"
                />
              }
            >
              <BookOpenCheckIcon className="size-4" />
            </TooltipTrigger>
            <TooltipPopup side="left" sideOffset={8}>
              Rules
            </TooltipPopup>
          </Tooltip>

          {/* People */}
          <Tooltip>
            <TooltipTrigger
              onClick={() => onExpandToTab?.("people")}
              render={
                <button
                  type="button"
                  aria-label="People"
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
      ) : (
        /* ---------- Expanded panel ---------- */
        <>
          <div className="flex h-10 items-center justify-end px-2 border-b border-border/70">
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onToggleCollapsed}
              aria-expanded={true}
              aria-controls={panelId}
              aria-label="Collapse inspector panel"
            >
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </>
      )}
    </aside>
  );
}
