import type { GitResolvedPullRequestWithLabels } from "@okcode/contracts";
import { useId } from "react";
import { ArrowRightIcon, ChevronsLeftIcon, ChevronsRightIcon, SearchIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Spinner } from "~/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { SectionHeading } from "~/components/review/ReviewChrome";
import { projectLabel } from "~/components/review/reviewUtils";
import type { Project } from "~/types";
import { Button } from "~/components/ui/button";
import {
  type PullRequestState,
  formatRelativeTime,
  labelStyle,
  stateBadgeClassName,
  stateIcon,
  stateTone,
} from "./pr-review-utils";

export function PrListRail({
  projects,
  selectedProjectId,
  onProjectChange,
  pullRequests,
  selectedPrNumber,
  onSelectPr,
  pullRequestState,
  onPullRequestStateChange,
  searchQuery,
  onSearchQueryChange,
  isLoading,
  collapsed,
  onToggleCollapsed,
}: {
  projects: readonly Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  pullRequests: readonly GitResolvedPullRequestWithLabels[];
  selectedPrNumber: number | null;
  onSelectPr: (pullRequest: GitResolvedPullRequestWithLabels) => void;
  pullRequestState: PullRequestState;
  onPullRequestStateChange: (state: PullRequestState) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isLoading: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const panelId = useId();

  return (
    <aside
      id={panelId}
      aria-label="Pull request list"
      className={cn(
        "flex min-h-0 flex-col border-r border-border/70 bg-background/95",
        "transition-[width] duration-200 ease-in-out overflow-hidden",
        collapsed ? "w-12" : "w-80",
      )}
    >
      {collapsed ? (
        /* ---------- Collapsed icon rail ---------- */
        <div className="flex min-h-0 flex-1 w-12 shrink-0 flex-col items-center py-2">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onToggleCollapsed}
            aria-expanded={false}
            aria-controls={panelId}
            aria-label="Expand pull request list"
            className="mb-2"
          >
            <ChevronsRightIcon className="size-4" />
          </Button>
          <ScrollArea className="min-h-0 flex-1 w-full">
            <div className="flex flex-col items-center gap-1 px-1">
              {pullRequests.map((pullRequest) => {
                const isSelected = selectedPrNumber === pullRequest.number;
                return (
                  <Tooltip key={pullRequest.number}>
                    <TooltipTrigger
                      onClick={() => onSelectPr(pullRequest)}
                      render={
                        <button
                          type="button"
                          aria-label={`PR #${pullRequest.number}: ${pullRequest.title}`}
                          aria-current={isSelected ? "true" : undefined}
                          className={cn(
                            "flex size-8 items-center justify-center rounded-lg transition-colors",
                            isSelected
                              ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground hover:bg-muted/50",
                          )}
                        />
                      }
                    >
                      {stateIcon(pullRequest.state, "size-4")}
                    </TooltipTrigger>
                    <TooltipPopup side="right" sideOffset={8}>
                      <p className="font-medium">
                        #{pullRequest.number} {pullRequest.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pullRequest.headBranch} &rarr; {pullRequest.baseBranch}
                      </p>
                    </TooltipPopup>
                  </Tooltip>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : (
        /* ---------- Expanded rail ---------- */
        <>
          <div className="border-b border-border/70 px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <SectionHeading
                action={
                  <Badge className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    Repo rules
                  </Badge>
                }
                detail="Scope is explicit here: repo focus, GitHub fetch state, and local search."
                eyebrow="Review Scope"
                title="Pull requests"
              />
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={onToggleCollapsed}
                aria-expanded={true}
                aria-controls={panelId}
                aria-label="Collapse pull request list"
                className="shrink-0 mt-0.5"
              >
                <ChevronsLeftIcon className="size-4" />
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">Repository</span>
                <Select
                  value={selectedProjectId ?? undefined}
                  onValueChange={(value) => {
                    if (typeof value === "string") onProjectChange(value);
                  }}
                >
                  <SelectTrigger aria-label="Focused repository">
                    <SelectValue placeholder="Choose repo" />
                  </SelectTrigger>
                  <SelectPopup>
                    {projects.map((project) => (
                      <SelectItem hideIndicator key={project.id} value={project.id}>
                        {projectLabel(project)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
              <div className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">GitHub state</span>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Filter by pull request state"
                >
                  {(["open", "merged", "closed"] as const).map((state) => (
                    <button
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                        stateBadgeClassName(state, pullRequestState === state),
                      )}
                      key={state}
                      onClick={() => onPullRequestStateChange(state)}
                      type="button"
                      aria-pressed={pullRequestState === state}
                    >
                      {stateIcon(state, "size-3.5")}
                      {state}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Filter locally by title, branch, author, label"
                  aria-label="Filter pull requests"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span aria-live="polite">{pullRequests.length} results in local view</span>
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Spinner className="size-3" />
                Syncing
              </span>
            ) : null}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 px-2 pb-3">
              {pullRequests.length === 0 ? (
                <div
                  className="mx-2 mt-2 rounded-2xl border border-dashed border-border/70 bg-muted/25 px-4 py-6 text-sm text-muted-foreground"
                  role="status"
                >
                  No pull requests match this repo and GitHub state. Local filters are not hiding
                  anything else right now.
                </div>
              ) : (
                pullRequests.map((pullRequest) => {
                  const isSelected = selectedPrNumber === pullRequest.number;
                  return (
                    <button
                      className={cn(
                        "group w-full rounded-2xl border border-transparent px-3 py-3 text-left transition-all",
                        isSelected
                          ? "border-amber-500/25 bg-amber-500/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "hover:border-border/70 hover:bg-muted/40",
                      )}
                      key={pullRequest.number}
                      onClick={() => onSelectPr(pullRequest)}
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border",
                            isSelected
                              ? "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300"
                              : "border-border/70 bg-background text-muted-foreground",
                          )}
                        >
                          {stateIcon(pullRequest.state, "size-4")}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="truncate font-medium text-sm text-foreground">
                                #{pullRequest.number} {pullRequest.title}
                              </p>
                              <span
                                className={cn(
                                  "shrink-0 text-[11px] capitalize",
                                  stateTone(pullRequest.state),
                                )}
                              >
                                {pullRequest.state}
                              </span>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {pullRequest.headBranch}{" "}
                              <ArrowRightIcon className="mx-1 inline size-3" />{" "}
                              {pullRequest.baseBranch}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">
                              @{pullRequest.author}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(pullRequest.updatedAt)}
                            </span>
                            {pullRequest.labels.slice(0, 2).map((label) => (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/80"
                                key={label.name}
                              >
                                <span
                                  className="size-1.5 rounded-full"
                                  style={labelStyle(label.color)}
                                />
                                {label.name}
                              </span>
                            ))}
                            {pullRequest.labels.length > 2 ? (
                              <span className="text-[11px] text-muted-foreground">
                                +{pullRequest.labels.length - 2}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </aside>
  );
}
