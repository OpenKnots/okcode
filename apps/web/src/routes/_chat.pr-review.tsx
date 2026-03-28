import type { GitResolvedPullRequest, GitResolvedPullRequestWithLabels } from "@okcode/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  FolderGit2Icon,
  ExternalLinkIcon,
  FileCodeIcon,
  FilterIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  GridIcon,
  KanbanIcon,
  LayoutListIcon,
  MessageSquareIcon,
  RowsIcon,
  SearchIcon,
  TableIcon,
  UserIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { ToggleGroup, Toggle as ToggleGroupItem } from "~/components/ui/toggle-group";
import { isElectron } from "~/env";
import { gitListPullRequestsQueryOptions } from "~/lib/gitReactQuery";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import type { Project } from "~/types";

// ── Types ────────────────────────────────────────────────────────────

type ViewMode = "table" | "list" | "kanban";
type ListSubMode = "grid" | "rows";
type PullRequestState = "open" | "closed" | "merged";
const EMPTY_PULL_REQUESTS: readonly GitResolvedPullRequestWithLabels[] = [];

// ── Helpers ──────────────────────────────────────────────────────────

function useProjects(): Project[] {
  return useStore((store) => store.projects);
}

function projectLabel(project: Project): string {
  return project.name.trim().length > 0 ? project.name : project.cwd;
}

function prStateIcon(state: string, className?: string) {
  const cls = className ?? "size-4";
  switch (state) {
    case "open":
      return <GitPullRequestIcon className={cls} />;
    case "merged":
      return <GitMergeIcon className={cls} />;
    case "closed":
      return <XCircleIcon className={cls} />;
    default:
      return <CircleDotIcon className={cls} />;
  }
}

function prStateTone(state: string) {
  switch (state) {
    case "open":
      return {
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
        border: "border-emerald-500/20 dark:border-emerald-400/20",
      };
    case "merged":
      return {
        text: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-500/10 dark:bg-violet-400/10",
        border: "border-violet-500/20 dark:border-violet-400/20",
      };
    case "closed":
      return {
        text: "text-zinc-500 dark:text-zinc-400",
        bg: "bg-zinc-500/10 dark:bg-zinc-400/10",
        border: "border-zinc-500/20 dark:border-zinc-400/20",
      };
    default:
      return {
        text: "text-muted-foreground",
        bg: "bg-muted/50",
        border: "border-border",
      };
  }
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function labelColor(hex: string): { bg: string; text: string } {
  if (!hex || hex.length < 6) return { bg: "bg-muted/60", text: "text-muted-foreground" };
  // Parse hex color and determine light vs dark
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    bg: `bg-[#${hex}]/15 dark:bg-[#${hex}]/20`,
    text: luminance > 0.5 ? `text-[#${hex}]` : `text-[#${hex}]`,
  };
}

// ── Section wrapper (conversation-style) ────────────────────────────

function ReviewSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-1 duration-300", className)}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

// ── Label Badge ──────────────────────────────────────────────────────

function LabelBadge({
  label,
  onClick,
  active,
}: {
  label: { name: string; color: string };
  onClick?: () => void;
  active?: boolean;
}) {
  const colors = labelColor(label.color);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
        active
          ? "border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/20"
          : `border-transparent ${colors.bg} ${colors.text} hover:opacity-80`,
        onClick && "cursor-pointer",
      )}
    >
      <span
        className="size-2 rounded-full shrink-0"
        style={{
          backgroundColor: label.color ? `#${label.color}` : undefined,
        }}
      />
      {label.name}
    </button>
  );
}

// ── State Filter Badge ───────────────────────────────────────────────

function StateBadge({
  state,
  count,
  active,
  onClick,
}: {
  state: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  const tone = prStateTone(state);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-all",
        active
          ? cn(tone.text, tone.bg, tone.border)
          : "border-border text-muted-foreground hover:bg-muted/30",
      )}
    >
      {prStateIcon(state, "size-3")}
      {state}
      {typeof count === "number" ? (
        <span className="ml-0.5 tabular-nums text-[10px] opacity-60">{count}</span>
      ) : null}
    </button>
  );
}

// ── View Mode Toolbar ────────────────────────────────────────────────

function ViewModeToolbar({
  viewMode,
  onViewModeChange,
  listSubMode,
  onListSubModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  listSubMode: ListSubMode;
  onListSubModeChange: (mode: ListSubMode) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        variant="outline"
        size="xs"
        value={[viewMode]}
        onValueChange={(values) => {
          const v = values[values.length - 1];
          if (v) onViewModeChange(v as ViewMode);
        }}
      >
        <ToggleGroupItem value="table" aria-label="Table view">
          <TableIcon className="size-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" aria-label="List view">
          <LayoutListIcon className="size-3.5" />
        </ToggleGroupItem>
        <ToggleGroupItem value="kanban" aria-label="Kanban view">
          <KanbanIcon className="size-3.5" />
        </ToggleGroupItem>
      </ToggleGroup>

      {viewMode === "list" && (
        <ToggleGroup
          variant="outline"
          size="xs"
          value={[listSubMode]}
          onValueChange={(values) => {
            const v = values[values.length - 1];
            if (v) onListSubModeChange(v as ListSubMode);
          }}
        >
          <ToggleGroupItem value="rows" aria-label="Rows layout">
            <RowsIcon className="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid layout">
            <GridIcon className="size-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  );
}

// ── Label Filter Bar ─────────────────────────────────────────────────

function LabelFilterBar({
  allLabels,
  activeLabel,
  onLabelChange,
  searchQuery,
  onSearchChange,
}: {
  allLabels: Array<{ name: string; color: string }>;
  activeLabel: string | null;
  onLabelChange: (label: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-xs/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Local filters</p>
          <p className="text-xs text-muted-foreground">
            Search and label filters apply only to the loaded pull requests below.
          </p>
        </div>
        {(searchQuery.length > 0 || activeLabel) && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              onSearchChange("");
              onLabelChange(null);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9 h-8 text-sm"
          placeholder="Search pull requests..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>

      {/* Labels */}
      {allLabels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterIcon className="size-3 text-muted-foreground shrink-0 mr-1" />
          {activeLabel && (
            <button
              type="button"
              onClick={() => onLabelChange(null)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <XIcon className="size-2.5" />
              Clear
            </button>
          )}
          {allLabels.map((label) => (
            <LabelBadge
              key={label.name}
              label={label}
              active={activeLabel === label.name}
              onClick={() => onLabelChange(activeLabel === label.name ? null : label.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeToolbar({
  projects,
  selectedProjectId,
  onProjectChange,
  state,
  onStateChange,
  viewMode,
  onViewModeChange,
  listSubMode,
  onListSubModeChange,
}: {
  projects: readonly Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  state: PullRequestState;
  onStateChange: (state: PullRequestState) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  listSubMode: ListSubMode;
  onListSubModeChange: (mode: ListSubMode) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 shadow-xs/5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="grid gap-4 sm:grid-cols-2 xl:flex-1">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Repository in focus
            </p>
            <Select
              value={selectedProjectId}
              onValueChange={(value) => {
                if (value) onProjectChange(value);
              }}
            >
              <SelectTrigger aria-label="Repository in focus" className="w-full">
                <FolderGit2Icon className="size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                {projects.map((project) => (
                  <SelectItem hideIndicator key={project.id} value={project.id}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {projectLabel(project)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{project.cwd}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              GitHub scope
            </p>
            <div className="flex flex-wrap gap-2">
              {(["open", "merged", "closed"] as const).map((candidate) => (
                <StateBadge
                  key={candidate}
                  state={candidate}
                  active={state === candidate}
                  onClick={() => onStateChange(candidate)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              State is applied server-side when fetching PRs for the selected repo.
            </p>
          </div>
        </div>

        <div className="flex justify-start xl:justify-end">
          <ViewModeToolbar
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            listSubMode={listSubMode}
            onListSubModeChange={onListSubModeChange}
          />
        </div>
      </div>
    </div>
  );
}

function AppliedScopeSummary({
  project,
  state,
  searchQuery,
  activeLabel,
}: {
  project: Project;
  state: PullRequestState;
  searchQuery: string;
  activeLabel: string | null;
}) {
  const scopeItems = [
    { label: "Repo", value: projectLabel(project) },
    { label: "State", value: state },
    ...(searchQuery.trim().length > 0 ? [{ label: "Search", value: searchQuery.trim() }] : []),
    ...(activeLabel ? [{ label: "Label", value: activeLabel }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scopeItems.map((item) => (
        <span
          key={`${item.label}:${item.value}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground"
        >
          <span className="font-medium text-foreground">{item.label}</span>
          <span className="max-w-[20rem] truncate">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function PREmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="max-w-sm text-center space-y-2">
        <GitPullRequestIcon className="mx-auto size-6 text-muted-foreground/30" />
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Table View ───────────────────────────────────────────────────────

function PRTableView({
  pullRequests,
  onSelect,
  emptyState,
}: {
  pullRequests: readonly GitResolvedPullRequestWithLabels[];
  onSelect: (pr: GitResolvedPullRequestWithLabels) => void;
  emptyState: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                PR
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Title
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                Labels
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                Branch
              </th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                Author
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Updated
              </th>
            </tr>
          </thead>
          <tbody>
            {pullRequests.map((pr) => {
              const tone = prStateTone(pr.state);
              return (
                <tr
                  key={pr.number}
                  onClick={() => onSelect(pr)}
                  className="border-t border-border first:border-t-0 transition-colors hover:bg-muted/20 cursor-pointer group"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className={tone.text}>{prStateIcon(pr.state, "size-3.5")}</span>
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        #{pr.number}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {pr.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1 flex-wrap">
                      {pr.labels.slice(0, 3).map((label) => (
                        <LabelBadge key={label.name} label={label} />
                      ))}
                      {pr.labels.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{pr.labels.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {pr.headBranch}
                    </code>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="size-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{pr.author}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatRelativeTime(pr.updatedAt)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pullRequests.length === 0 && emptyState}
    </div>
  );
}

// ── List View: Rows ──────────────────────────────────────────────────

function PRListRowsView({
  pullRequests,
  onSelect,
  emptyState,
}: {
  pullRequests: readonly GitResolvedPullRequestWithLabels[];
  onSelect: (pr: GitResolvedPullRequestWithLabels) => void;
  emptyState: ReactNode;
}) {
  if (pullRequests.length === 0) {
    return emptyState;
  }

  return (
    <div className="space-y-2">
      {pullRequests.map((pr) => {
        const tone = prStateTone(pr.state);
        return (
          <button
            key={pr.number}
            type="button"
            onClick={() => onSelect(pr)}
            className="w-full text-left rounded-xl border border-border bg-card p-4 transition-all hover:bg-muted/20 hover:shadow-sm group"
          >
            <div className="flex items-start gap-3">
              <span className={cn("mt-0.5 shrink-0", tone.text)}>
                {prStateIcon(pr.state, "size-4")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {pr.title}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                    #{pr.number}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <GitBranchIcon className="size-3" />
                    <code className="font-mono">{pr.headBranch}</code>
                  </div>
                  <ArrowRightIcon className="size-2.5 opacity-40" />
                  <code className="font-mono">{pr.baseBranch}</code>
                  <span className="mx-1 opacity-30">|</span>
                  <div className="flex items-center gap-1">
                    <UserIcon className="size-3" />
                    {pr.author}
                  </div>
                  <span className="tabular-nums">{formatRelativeTime(pr.updatedAt)}</span>
                </div>
                {pr.labels.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    {pr.labels.map((label) => (
                      <LabelBadge key={label.name} label={label} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── List View: Grid ──────────────────────────────────────────────────

function PRListGridView({
  pullRequests,
  onSelect,
  emptyState,
}: {
  pullRequests: readonly GitResolvedPullRequestWithLabels[];
  onSelect: (pr: GitResolvedPullRequestWithLabels) => void;
  emptyState: ReactNode;
}) {
  if (pullRequests.length === 0) {
    return emptyState;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pullRequests.map((pr) => {
        const tone = prStateTone(pr.state);
        return (
          <button
            key={pr.number}
            type="button"
            onClick={() => onSelect(pr)}
            className="text-left rounded-2xl border border-border bg-card not-dark:bg-clip-padding p-4 shadow-xs/5 transition-all hover:shadow-md hover:border-border/80 group flex flex-col"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                  tone.text,
                  tone.bg,
                  tone.border,
                )}
              >
                {prStateIcon(pr.state, "size-3")}
                {pr.state}
              </span>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                #{pr.number}
              </span>
            </div>

            <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
              {pr.title}
            </h3>

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranchIcon className="size-3 shrink-0" />
                <code className="font-mono truncate">{pr.headBranch}</code>
              </div>

              {pr.labels.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {pr.labels.slice(0, 2).map((label) => (
                    <LabelBadge key={label.name} label={label} />
                  ))}
                  {pr.labels.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{pr.labels.length - 2}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <div className="flex items-center gap-1">
                  <UserIcon className="size-3" />
                  {pr.author}
                </div>
                <span className="tabular-nums">{formatRelativeTime(pr.updatedAt)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Kanban View ──────────────────────────────────────────────────────

function KanbanColumn({
  title,
  state,
  pullRequests,
  onSelect,
}: {
  title: string;
  state: string;
  pullRequests: readonly GitResolvedPullRequestWithLabels[];
  onSelect: (pr: GitResolvedPullRequestWithLabels) => void;
}) {
  const tone = prStateTone(state);

  return (
    <div className="flex flex-col min-w-[280px] max-w-[360px] flex-1">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={tone.text}>{prStateIcon(state, "size-3.5")}</span>
        <span className="text-sm font-medium text-foreground capitalize">{title}</span>
        <Badge variant="outline" size="sm" className="ml-auto tabular-nums">
          {pullRequests.length}
        </Badge>
      </div>

      {/* Column content */}
      <div className="flex-1 space-y-2 rounded-xl bg-muted/20 border border-border/50 p-2 min-h-[200px]">
        {pullRequests.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[100px]">
            <p className="text-xs text-muted-foreground/50">No PRs</p>
          </div>
        ) : (
          pullRequests.map((pr) => (
            <button
              key={pr.number}
              type="button"
              onClick={() => onSelect(pr)}
              className="w-full text-left rounded-lg border border-border bg-card p-3 shadow-xs/5 transition-all hover:shadow-sm hover:border-border/80 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  #{pr.number}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {formatRelativeTime(pr.updatedAt)}
                </span>
              </div>
              <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                {pr.title}
              </h4>

              {pr.labels.length > 0 && (
                <div className="mt-2 flex items-center gap-1 flex-wrap">
                  {pr.labels.slice(0, 3).map((label) => (
                    <LabelBadge key={label.name} label={label} />
                  ))}
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <UserIcon className="size-2.5" />
                  {pr.author}
                </div>
                <div className="flex items-center gap-1 truncate">
                  <GitBranchIcon className="size-2.5 shrink-0" />
                  <code className="font-mono truncate">{pr.headBranch}</code>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PRKanbanView({
  pullRequests,
  onSelect,
  emptyState,
}: {
  pullRequests: readonly GitResolvedPullRequestWithLabels[];
  onSelect: (pr: GitResolvedPullRequestWithLabels) => void;
  emptyState: ReactNode;
}) {
  if (pullRequests.length === 0) {
    return emptyState;
  }

  const grouped = useMemo(() => {
    const open: GitResolvedPullRequestWithLabels[] = [];
    const merged: GitResolvedPullRequestWithLabels[] = [];
    const closed: GitResolvedPullRequestWithLabels[] = [];

    for (const pr of pullRequests) {
      switch (pr.state) {
        case "open":
          open.push(pr);
          break;
        case "merged":
          merged.push(pr);
          break;
        case "closed":
          closed.push(pr);
          break;
      }
    }

    return { open, merged, closed };
  }, [pullRequests]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      <KanbanColumn title="Open" state="open" pullRequests={grouped.open} onSelect={onSelect} />
      <KanbanColumn
        title="Merged"
        state="merged"
        pullRequests={grouped.merged}
        onSelect={onSelect}
      />
      <KanbanColumn
        title="Closed"
        state="closed"
        pullRequests={grouped.closed}
        onSelect={onSelect}
      />
    </div>
  );
}

// ── PR Detail (single PR review) ─────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
}

const REVIEW_CHECKLIST: ChecklistItem[] = [
  {
    id: "purpose",
    label: "Purpose is clear",
    description: "The PR title and description explain what this change does and why.",
  },
  {
    id: "scope",
    label: "Scope is reasonable",
    description: "Changes are focused and don't mix unrelated concerns.",
  },
  {
    id: "tests",
    label: "Tests cover the change",
    description: "New or modified behavior has corresponding test coverage.",
  },
  {
    id: "breaking",
    label: "No breaking changes",
    description: "Public APIs, configs, and contracts remain backward compatible.",
  },
  {
    id: "security",
    label: "Security reviewed",
    description: "No secrets, injections, or permission escalation concerns.",
  },
  {
    id: "performance",
    label: "Performance considered",
    description: "No N+1 queries, unbounded loops, or memory leaks introduced.",
  },
];

function ReviewChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const completedCount = checked.size;
  const totalCount = REVIEW_CHECKLIST.length;
  const allComplete = completedCount === totalCount;

  return (
    <ReviewSection>
      <SectionLabel>Review checklist</SectionLabel>
      <div className="overflow-hidden rounded-2xl border border-border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none">
        {/* Progress header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {allComplete ? "All checks passed" : "Review items"}
          </span>
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              allComplete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {completedCount}/{totalCount}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mx-4 mb-3 h-1 overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              allComplete ? "bg-emerald-500 dark:bg-emerald-400" : "bg-primary",
            )}
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        <Separator />

        {/* Items */}
        <div>
          {REVIEW_CHECKLIST.map((item) => {
            const isChecked = checked.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 border-t border-border px-4 py-3 text-left transition-colors first:border-t-0",
                  "hover:bg-muted/30",
                  isChecked && "bg-muted/15",
                )}
                onClick={() => toggle(item.id)}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                    isChecked
                      ? "border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-emerald-950"
                      : "border-border bg-background",
                  )}
                >
                  {isChecked ? <CheckCircle2Icon className="size-3" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isChecked ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </ReviewSection>
  );
}

function ReviewNotes() {
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState<Array<{ id: string; text: string }>>([]);

  const handleAddNote = useCallback(() => {
    const trimmed = notes.trim();
    if (trimmed.length === 0) return;
    setSavedNotes((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed }]);
    setNotes("");
  }, [notes]);

  return (
    <ReviewSection>
      <SectionLabel>Notes</SectionLabel>
      <div className="overflow-hidden rounded-2xl border border-border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5">
        {savedNotes.length > 0 ? (
          <div className="border-b border-border">
            {savedNotes.map((note, index) => (
              <div key={note.id} className="border-t border-border px-4 py-3 first:border-t-0">
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Note {index + 1}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="px-4 py-3">
          <textarea
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background"
            placeholder="Add a review note..."
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAddNote();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter to save
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={handleAddNote}
              disabled={notes.trim().length === 0}
            >
              Add note
            </Button>
          </div>
        </div>
      </div>
    </ReviewSection>
  );
}

function QuickActions({ pr }: { pr: GitResolvedPullRequest }) {
  return (
    <ReviewSection>
      <SectionLabel>Actions</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {pr.url ? (
          <Button
            size="sm"
            variant="outline"
            render={<a href={pr.url} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLinkIcon className="size-3.5" />
            Open on GitHub
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled>
          <FileCodeIcon className="size-3.5" />
          View diff
        </Button>
        <Button size="sm" variant="outline" disabled>
          <MessageSquareIcon className="size-3.5" />
          Start review thread
        </Button>
      </div>
    </ReviewSection>
  );
}

function PRHeader({ pr }: { pr: GitResolvedPullRequest }) {
  const tone = prStateTone(pr.state);

  return (
    <ReviewSection>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                  tone.text,
                  tone.bg,
                  tone.border,
                )}
              >
                {prStateIcon(pr.state)}
                {pr.state}
              </span>
              <span className="text-sm text-muted-foreground">#{pr.number}</span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground leading-snug">
              {pr.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranchIcon className="size-3.5 shrink-0" />
          <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-foreground">
            {pr.headBranch}
          </code>
          <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground/60" />
          <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-foreground">
            {pr.baseBranch}
          </code>
        </div>

        {pr.url ? (
          <a
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3" />
            View on GitHub
          </a>
        ) : null}
      </div>
    </ReviewSection>
  );
}

function PRSummaryCard({ pr }: { pr: GitResolvedPullRequest }) {
  const tone = prStateTone(pr.state);

  return (
    <ReviewSection>
      <SectionLabel>At a glance</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card not-dark:bg-clip-padding p-4 shadow-xs/5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Status
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={tone.text}>{prStateIcon(pr.state)}</span>
            <span className={cn("text-sm font-semibold capitalize", tone.text)}>{pr.state}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card not-dark:bg-clip-padding p-4 shadow-xs/5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Source
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground font-mono">
            {pr.headBranch}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card not-dark:bg-clip-padding p-4 shadow-xs/5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Target
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-foreground font-mono">
            {pr.baseBranch}
          </p>
        </div>
      </div>
    </ReviewSection>
  );
}

function BranchContext({ pr }: { pr: GitResolvedPullRequest }) {
  return (
    <ReviewSection>
      <SectionLabel>Branch context</SectionLabel>
      <div className="overflow-hidden rounded-2xl border border-border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5">
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
              <GitBranchIcon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Source branch</p>
              <code className="text-xs font-mono text-muted-foreground">{pr.headBranch}</code>
            </div>
          </div>

          <div className="ml-4 border-l-2 border-dashed border-border pl-7 py-1">
            <ArrowRightIcon className="size-3 -ml-[1.9rem] text-muted-foreground/50 rotate-90" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
              <GitBranchIcon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Target branch</p>
              <code className="text-xs font-mono text-muted-foreground">{pr.baseBranch}</code>
            </div>
          </div>
        </div>
      </div>
    </ReviewSection>
  );
}

function PRReviewContent({
  pr,
  project,
  onBack,
}: {
  pr: GitResolvedPullRequest;
  project: Project;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowRightIcon className="size-3 rotate-180" />
        Back to all PRs in {projectLabel(project)}
      </button>
      <PRHeader pr={pr} />
      <Separator />
      <PRSummaryCard pr={pr} />
      <BranchContext pr={pr} />
      <Separator className="!my-8" />
      <ReviewChecklist />
      <ReviewNotes />
      <Separator className="!my-8" />
      <QuickActions pr={pr} />
    </div>
  );
}

// ── PR List (main dashboard) ─────────────────────────────────────────

function PRListDashboard({
  project,
  projects,
  selectedProjectId,
  onProjectChange,
}: {
  project: Project;
  projects: readonly Project[];
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [listSubMode, setListSubMode] = useState<ListSubMode>("rows");
  const [stateFilter, setStateFilter] = useState<PullRequestState>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [selectedPr, setSelectedPr] = useState<GitResolvedPullRequestWithLabels | null>(null);

  const listQuery = useQuery(
    gitListPullRequestsQueryOptions({
      cwd: project.cwd,
      state: stateFilter,
    }),
  );

  const pullRequests = listQuery.data?.pullRequests ?? EMPTY_PULL_REQUESTS;

  useEffect(() => {
    setSelectedPr(null);
  }, [project.id, stateFilter]);

  useEffect(() => {
    setSearchQuery("");
    setActiveLabel(null);
  }, [project.id]);

  // Extract unique labels
  const allLabels = useMemo(() => {
    const labelMap = new Map<string, { name: string; color: string }>();
    for (const pr of pullRequests) {
      for (const label of pr.labels) {
        if (!labelMap.has(label.name)) {
          labelMap.set(label.name, label);
        }
      }
    }
    return Array.from(labelMap.values()).toSorted((a, b) => a.name.localeCompare(b.name));
  }, [pullRequests]);

  // Filter PRs
  const filteredPRs = useMemo(() => {
    let filtered = pullRequests;

    if (activeLabel) {
      filtered = filtered.filter((pr) => pr.labels.some((l) => l.name === activeLabel));
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (pr) =>
          pr.title.toLowerCase().includes(q) ||
          pr.headBranch.toLowerCase().includes(q) ||
          pr.author.toLowerCase().includes(q) ||
          `#${pr.number}`.includes(q) ||
          pr.labels.some((l) => l.name.toLowerCase().includes(q)),
      );
    }

    return filtered;
  }, [pullRequests, activeLabel, searchQuery]);

  const hasLocalFilters = searchQuery.trim().length > 0 || activeLabel !== null;
  const emptyState = hasLocalFilters ? (
    <PREmptyState
      title={`No ${stateFilter} pull requests match the current filters.`}
      description={`The selected repository is ${projectLabel(project)}. Clear the search or label filter to see all loaded ${stateFilter} pull requests.`}
    />
  ) : (
    <PREmptyState
      title={`No ${stateFilter} pull requests found for ${projectLabel(project)}.`}
      description="Try a different repository or switch the GitHub state filter."
    />
  );

  // If a PR is selected, show the detail view
  if (selectedPr) {
    return <PRReviewContent pr={selectedPr} project={project} onBack={() => setSelectedPr(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pull Requests</h1>
          <p className="text-sm text-muted-foreground">
            {listQuery.isLoading
              ? "Loading pull requests..."
              : `Showing ${filteredPRs.length} of ${pullRequests.length} ${stateFilter} pull request${pullRequests.length === 1 ? "" : "s"} for ${projectLabel(project)}.`}
          </p>
        </div>
        <AppliedScopeSummary
          project={project}
          state={stateFilter}
          searchQuery={searchQuery}
          activeLabel={activeLabel}
        />
      </div>

      <ScopeToolbar
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={onProjectChange}
        state={stateFilter}
        onStateChange={setStateFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        listSubMode={listSubMode}
        onListSubModeChange={setListSubMode}
      />

      {/* Loading state */}
      {listQuery.isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Spinner className="size-5" />
            <span className="text-sm">Loading pull requests...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {listQuery.isError && !listQuery.isLoading && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">
            {listQuery.error instanceof Error
              ? listQuery.error.message
              : "Failed to load pull requests."}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => listQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Loaded state */}
      {!listQuery.isLoading && !listQuery.isError && (
        <>
          <LabelFilterBar
            allLabels={allLabels}
            activeLabel={activeLabel}
            onLabelChange={setActiveLabel}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {viewMode === "table" && (
            <PRTableView
              pullRequests={filteredPRs}
              onSelect={setSelectedPr}
              emptyState={emptyState}
            />
          )}

          {viewMode === "list" && listSubMode === "rows" && (
            <PRListRowsView
              pullRequests={filteredPRs}
              onSelect={setSelectedPr}
              emptyState={emptyState}
            />
          )}

          {viewMode === "list" && listSubMode === "grid" && (
            <PRListGridView
              pullRequests={filteredPRs}
              onSelect={setSelectedPr}
              emptyState={emptyState}
            />
          )}

          {viewMode === "kanban" && (
            <PRKanbanView
              pullRequests={filteredPRs}
              onSelect={setSelectedPr}
              emptyState={emptyState}
            />
          )}
        </>
      )}
    </div>
  );
}

// ── Route view ───────────────────────────────────────────────────────

function PRReviewRouteView() {
  const projects = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId((current) =>
      current && projects.some((project) => project.id === current) ? current : projects[0]!.id,
    );
  }, [projects]);

  const selectedProject =
    (selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : null) ??
    null;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {/* Header */}
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <GitPullRequestIcon className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">PR Review</span>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <div className="flex items-center gap-2">
              <GitPullRequestIcon className="size-3.5 text-muted-foreground/70" />
              <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
                PR Review
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-6 py-8", "max-w-5xl")}>
            {selectedProject ? (
              <PRListDashboard
                project={selectedProject}
                projects={projects}
                selectedProjectId={selectedProjectId ?? selectedProject.id}
                onProjectChange={setSelectedProjectId}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center py-20">
                <div className="text-center space-y-2">
                  <GitPullRequestIcon className="mx-auto size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    Open a project to review pull requests.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/pr-review")({
  component: PRReviewRouteView,
});
