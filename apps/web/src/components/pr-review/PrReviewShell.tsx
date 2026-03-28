import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata, Virtualizer } from "@pierre/diffs/react";
import type {
  GitHubUserPreview,
  GitResolvedPullRequestWithLabels,
  NativeApi,
  PrConflictAnalysis,
  PrReviewConfig,
  PrReviewParticipant,
  PrReviewThread,
  PrWorkflowDefinition,
} from "@okcode/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Schema } from "effect";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BookOpenTextIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  FileCode2Icon,
  FolderGit2Icon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  PanelRightIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCheckIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { openInPreferredEditor } from "~/editorPreferences";
import { useTheme } from "~/hooks/useTheme";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { gitListPullRequestsQueryOptions } from "~/lib/gitReactQuery";
import {
  invalidatePrReviewQueries,
  prReviewConfigQueryOptions,
  prReviewConflictsQueryOptions,
  prReviewDashboardQueryOptions,
  prReviewPatchQueryOptions,
  prReviewUserPreviewQueryOptions,
} from "~/lib/prReviewReactQuery";
import { buildPatchCacheKey, resolveDiffThemeName } from "~/lib/diffRendering";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet";
import { Spinner } from "~/components/ui/spinner";
import { Textarea } from "~/components/ui/textarea";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import type { Project } from "~/types";

type PullRequestState = "open" | "closed" | "merged";
type InspectorTab = "threads" | "workflow" | "people";

type RenderablePatch =
  | {
      kind: "files";
      files: FileDiffMetadata[];
    }
  | {
      kind: "raw";
      text: string;
      reason: string;
    };

const TEXT_DRAFT_SCHEMA = Schema.String;

const PR_REVIEW_DIFF_UNSAFE_CSS = `
[data-diff],
[data-file],
[data-diffs-header],
[data-error-wrapper],
[data-virtualizer-buffer] {
  --diffs-bg: color-mix(in srgb, var(--card) 92%, var(--background)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--card) 92%, var(--background)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--card) 92%, var(--background)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;
  --diffs-bg-context-override: color-mix(in srgb, var(--background) 97%, var(--foreground));
  --diffs-bg-hover-override: color-mix(in srgb, var(--background) 95%, var(--foreground));
  --diffs-bg-separator-override: color-mix(in srgb, var(--background) 96%, var(--foreground));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--background) 92%, var(--foreground));
  --diffs-bg-addition-override: color-mix(in srgb, var(--background) 90%, #1f9d55);
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--background) 86%, #1f9d55);
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--background) 82%, #1f9d55);
  --diffs-bg-deletion-override: color-mix(in srgb, var(--background) 90%, #dc6b2f);
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--background) 86%, #dc6b2f);
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--background) 82%, #dc6b2f);
  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  background-color: color-mix(in srgb, var(--card) 96%, var(--foreground)) !important;
  border-block-color: var(--border) !important;
  color: var(--foreground) !important;
}
`;

function projectLabel(project: Project): string {
  return project.name.trim().length > 0 ? project.name : project.cwd;
}

function joinPath(base: string, relativePath: string): string {
  return `${base.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;
}

function formatRelativeTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function stateTone(state: PullRequestState | string) {
  switch (state) {
    case "open":
      return "text-emerald-500";
    case "merged":
      return "text-sky-500";
    case "closed":
      return "text-muted-foreground";
    default:
      return "text-amber-500";
  }
}

function stateBadgeClassName(state: PullRequestState | string, active = false) {
  if (active) {
    switch (state) {
      case "open":
        return "border-emerald-500/30 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300";
      case "merged":
        return "border-sky-500/30 bg-sky-500/12 text-sky-600 dark:text-sky-300";
      case "closed":
        return "border-border bg-muted/70 text-foreground";
      default:
        return "border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-300";
    }
  }
  return "border-border/70 bg-background text-muted-foreground hover:bg-muted/45";
}

function stateIcon(state: PullRequestState | string, className = "size-4") {
  switch (state) {
    case "open":
      return <GitPullRequestIcon className={className} />;
    case "merged":
      return <GitMergeIcon className={className} />;
    case "closed":
      return <XCircleIcon className={className} />;
    default:
      return <CircleDotIcon className={className} />;
  }
}

function threadTone(state: PrReviewThread["state"]) {
  switch (state) {
    case "resolved":
      return "border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-300";
    case "outdated":
      return "border-border bg-muted/45 text-muted-foreground";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}

function labelStyle(hex: string) {
  if (!hex) return undefined;
  return { backgroundColor: `#${hex}` };
}

function summarizeFileDiffStats(fileDiff: FileDiffMetadata): {
  additions: number;
  deletions: number;
} {
  return fileDiff.hunks.reduce(
    (summary, hunk) => ({
      additions: summary.additions + hunk.additionLines,
      deletions: summary.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
}

function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}

function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

function parseRenderablePatch(
  patch: string | undefined,
  scope = "pr-review",
): RenderablePatch | null {
  if (!patch || patch.trim().length === 0) return null;
  const normalizedPatch = patch.trim();
  try {
    const parsed = parsePatchFiles(normalizedPatch, buildPatchCacheKey(normalizedPatch, scope));
    const files = parsed.flatMap((entry) => entry.files);
    if (files.length === 0) {
      return {
        kind: "raw",
        text: normalizedPatch,
        reason: "Unsupported diff format. Showing raw patch instead.",
      };
    }
    return { kind: "files", files };
  } catch {
    return {
      kind: "raw",
      text: normalizedPatch,
      reason: "Failed to parse patch. Showing raw patch instead.",
    };
  }
}

function extractMentionQuery(
  value: string,
  selectionStart: number | null,
): { query: string; from: number; to: number } | null {
  if (selectionStart === null) return null;
  const beforeCursor = value.slice(0, selectionStart);
  const match = beforeCursor.match(/(^|\s)@([a-zA-Z0-9-]{0,39})$/);
  if (!match) return null;
  const query = match[2] ?? "";
  return {
    query,
    from: selectionStart - query.length - 1,
    to: selectionStart,
  };
}

function mergeMentionCandidates(
  participants: readonly PrReviewParticipant[],
  users: readonly GitHubUserPreview[],
  query: string,
): GitHubUserPreview[] {
  const normalizedQuery = query.trim().toLowerCase();
  const entries: GitHubUserPreview[] = [];
  const seen = new Set<string>();

  const maybePush = (user: GitHubUserPreview | null) => {
    if (!user) return;
    if (
      normalizedQuery.length > 0 &&
      !user.login.toLowerCase().includes(normalizedQuery) &&
      !(user.name ?? "").toLowerCase().includes(normalizedQuery)
    ) {
      return;
    }
    if (seen.has(user.login)) return;
    seen.add(user.login);
    entries.push(user);
  };

  for (const participant of participants) {
    maybePush(participant.user);
  }
  for (const user of users) {
    maybePush(user);
  }

  return entries.slice(0, 8);
}

function shortCommentPreview(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, 96) || "Empty comment";
}

function requiredChecksState(
  config: PrReviewConfig,
  checks: readonly { name: string; status: string; conclusion: string | null }[],
) {
  const requiredChecks = config.rules.requiredChecks;
  if (requiredChecks.length === 0) {
    return { failing: [] as string[], pending: [] as string[] };
  }
  const failing: string[] = [];
  const pending: string[] = [];
  for (const requiredCheck of requiredChecks) {
    const match = checks.find((entry) => entry.name === requiredCheck);
    if (!match) {
      pending.push(requiredCheck);
      continue;
    }
    const conclusion = match.conclusion?.toLowerCase();
    const status = match.status.toLowerCase();
    if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") {
      continue;
    }
    if (status === "completed") {
      failing.push(requiredCheck);
    } else {
      pending.push(requiredCheck);
    }
  }
  return { failing, pending };
}

function resolveWorkflow(
  config: PrReviewConfig | undefined,
  workflowId: string | null,
): PrWorkflowDefinition | null {
  if (!config) return null;
  if (workflowId) {
    const explicit = config.workflows.find((entry) => entry.id === workflowId);
    if (explicit) return explicit;
  }
  return (
    config.workflows.find((entry) => entry.id === config.defaultWorkflowId) ??
    config.workflows[0] ??
    null
  );
}

async function openPathInEditor(targetPath: string) {
  await openInPreferredEditor(ensureNativeApi(), targetPath);
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="text-foreground/80">{icon}</span>
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <div className="space-y-1">
          <h2 className="font-semibold text-base text-foreground">{title}</h2>
          {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function PrUserHoverCard({
  cwd,
  login,
  className,
  children,
}: {
  cwd: string | null;
  login: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const previewQuery = useQuery(
    prReviewUserPreviewQueryOptions({
      cwd: open ? cwd : null,
      login: open ? login : null,
    }),
  );

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 120);
  };

  useEffect(() => () => clearCloseTimeout(), []);

  const preview = previewQuery.data;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          "rounded-sm text-amber-700 underline decoration-amber-500/30 underline-offset-2 transition-colors hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200",
          className,
        )}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => {
          clearCloseTimeout();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        render={<button type="button" />}
      >
        {children ?? `@${login}`}
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        className="w-72"
        onMouseEnter={clearCloseTimeout}
        onMouseLeave={scheduleClose}
      >
        {previewQuery.isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Spinner className="size-3.5" />
            Loading GitHub profile...
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <img
                alt={preview?.login ?? login}
                className="size-11 rounded-full border border-border/70 object-cover"
                src={preview?.avatarUrl ?? `https://github.com/${login}.png`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm text-foreground">
                  {preview?.name ?? login}
                </p>
                <p className="truncate text-xs text-muted-foreground">@{preview?.login ?? login}</p>
              </div>
            </div>
            {preview?.bio ? <p className="text-sm text-foreground/85">{preview.bio}</p> : null}
            <div className="grid gap-1 text-xs text-muted-foreground">
              {preview?.company ? <span>{preview.company}</span> : null}
              {preview?.location ? <span>{preview.location}</span> : null}
            </div>
            <Button
              className="w-full justify-center"
              onClick={() => {
                void ensureNativeApi().shell.openExternal(
                  preview?.url ?? `https://github.com/${preview?.login ?? login}`,
                );
              }}
              size="sm"
              variant="outline"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open GitHub profile
            </Button>
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
}

function PrCommentBody({ body, cwd }: { body: string; cwd: string | null }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-6 text-foreground/88">
      {lines.map((line, lineIndex) => {
        const segments = line.split(/(@[a-zA-Z0-9-]+)/g);
        return (
          <p key={`${lineIndex}:${line}`}>
            {segments.map((segment, segmentIndex) => {
              if (/^@[a-zA-Z0-9-]+$/.test(segment)) {
                return (
                  <PrUserHoverCard
                    cwd={cwd}
                    key={`${lineIndex}:${segmentIndex}`}
                    login={segment.slice(1)}
                  >
                    {segment}
                  </PrUserHoverCard>
                );
              }
              return <span key={`${lineIndex}:${segmentIndex}`}>{segment}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

function PrMentionComposer({
  cwd,
  participants,
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 4,
  autoFocus = false,
}: {
  cwd: string | null;
  participants: readonly PrReviewParticipant[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  rows?: number;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const mentionQueryState = useMemo(
    () => extractMentionQuery(value, selectionStart),
    [selectionStart, value],
  );
  const deferredMentionQuery = useDeferredValue(mentionQueryState?.query ?? "");
  const userSearchQuery = useQuery(
    prReviewUserPreviewQueryOptions({
      cwd: null,
      login: null,
    }),
  );
  void userSearchQuery;
  const searchQuery = useQuery(
    prReviewUserPreviewQueryOptions({
      cwd: null,
      login: null,
    }),
  );
  void searchQuery;
  const remoteSearchQuery = useQuery({
    ...prReviewConfigQueryOptions(null),
    enabled: false,
  });
  void remoteSearchQuery;
  const mentionSearchQuery = useQuery({
    queryKey: ["prReview", "mention-search", cwd, deferredMentionQuery],
    queryFn: async () => {
      if (!cwd || deferredMentionQuery.trim().length === 0) {
        return { users: [] };
      }
      return ensureNativeApi().prReview.searchUsers({
        cwd,
        query: deferredMentionQuery.trim(),
        limit: 8,
      });
    },
    enabled: cwd !== null && deferredMentionQuery.trim().length > 0,
    staleTime: 30_000,
  });

  const suggestions = useMemo(
    () =>
      mergeMentionCandidates(
        participants,
        mentionSearchQuery.data?.users ?? [],
        mentionQueryState?.query ?? "",
      ),
    [mentionQueryState?.query, mentionSearchQuery.data?.users, participants],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [mentionQueryState?.query]);

  const replaceMention = (login: string) => {
    if (!mentionQueryState || !textareaRef.current) return;
    const nextValue =
      value.slice(0, mentionQueryState.from) + `@${login} ` + value.slice(mentionQueryState.to);
    const nextCursor = mentionQueryState.from + login.length + 2;
    onChange(nextValue);
    queueMicrotask(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      setSelectionStart(nextCursor);
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setSelectionStart(event.target.selectionStart);
        }}
        onClick={(event) => setSelectionStart(event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (!mentionQueryState || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            const nextUser = suggestions[activeIndex];
            if (nextUser) replaceMention(nextUser.login);
          }
        }}
        onSelect={(event) => setSelectionStart(event.currentTarget.selectionStart)}
      />
      {mentionQueryState ? (
        <div className="rounded-xl border border-border/70 bg-background/95">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Mention people
            </span>
            {mentionSearchQuery.isFetching ? (
              <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No matching collaborators.</p>
          ) : (
            <div className="p-1">
              {suggestions.map((user, index) => (
                <button
                  key={user.login}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/70",
                    index === activeIndex && "bg-muted/70",
                  )}
                  onClick={() => replaceMention(user.login)}
                  type="button"
                >
                  <img
                    alt={user.login}
                    className="size-7 rounded-full border border-border/70"
                    src={user.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name ?? user.login}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">@{user.login}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PrListRail({
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
}) {
  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-r border-border/70 bg-background/95">
      <div className="border-b border-border/70 px-4 py-4">
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
            <div className="flex flex-wrap gap-2">
              {(["open", "merged", "closed"] as const).map((state) => (
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                    stateBadgeClassName(state, pullRequestState === state),
                  )}
                  key={state}
                  onClick={() => onPullRequestStateChange(state)}
                  type="button"
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
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
        <span>{pullRequests.length} results in local view</span>
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
            <div className="mx-2 mt-2 rounded-2xl border border-dashed border-border/70 bg-muted/25 px-4 py-6 text-sm text-muted-foreground">
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
                          {pullRequest.headBranch} <ArrowRightIcon className="mx-1 inline size-3" />{" "}
                          {pullRequest.baseBranch}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">@{pullRequest.author}</span>
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
    </aside>
  );
}

function PrFileCommentComposer({
  cwd,
  participants,
  path,
  defaultLine,
  onSubmit,
  disabled = false,
}: {
  cwd: string | null;
  participants: readonly PrReviewParticipant[];
  path: string;
  defaultLine: number;
  onSubmit: (input: { line: number; body: string }) => Promise<void>;
  disabled?: boolean;
}) {
  const [line, setLine] = useState(String(defaultLine));
  const draftKey = `okcode:pr-review:file-draft:${cwd ?? "unknown"}:${path}:${line}`;
  const [body, setBody] = useLocalStorage(draftKey, "", TEXT_DRAFT_SCHEMA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLine(String(defaultLine));
  }, [defaultLine]);

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/90 p-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Line
          <Input
            className="h-8 w-24"
            disabled={disabled || isSubmitting}
            inputMode="numeric"
            min={1}
            type="number"
            value={line}
            onChange={(event) => setLine(event.target.value)}
          />
        </label>
        <span className="text-xs text-muted-foreground">Creates a review thread on {path}</span>
      </div>
      <PrMentionComposer
        cwd={cwd}
        disabled={disabled || isSubmitting}
        participants={participants}
        placeholder="Add a review comment. Use @ to mention collaborators."
        value={body}
        onChange={setBody}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={disabled || isSubmitting || body.trim().length === 0}
          onClick={() => {
            const nextLine = Number.parseInt(line, 10);
            if (!Number.isFinite(nextLine) || nextLine < 1) return;
            setIsSubmitting(true);
            void onSubmit({ body: body.trim(), line: nextLine }).then(
              () => {
                setBody("");
                setIsSubmitting(false);
              },
              () => {
                setIsSubmitting(false);
              },
            );
          }}
          size="sm"
        >
          {isSubmitting ? (
            <Spinner className="size-3.5" />
          ) : (
            <MessageSquareIcon className="size-3.5" />
          )}
          Add comment
        </Button>
      </div>
    </div>
  );
}

function PrWorkspace({
  project,
  patch,
  dashboard,
  selectedFilePath,
  selectedThreadId,
  onSelectFilePath,
  onSelectThreadId,
  onCreateThread,
}: {
  project: Project;
  patch: string | null;
  dashboard: Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;
  selectedFilePath: string | null;
  selectedThreadId: string | null;
  onSelectFilePath: (path: string) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onCreateThread: (input: { path: string; line: number; body: string }) => Promise<void>;
}) {
  const { resolvedTheme } = useTheme();
  const renderablePatch = useMemo(
    () =>
      parseRenderablePatch(
        patch ?? undefined,
        `pr-review:${dashboard?.pullRequest.number ?? "none"}`,
      ),
    [dashboard?.pullRequest.number, patch],
  );

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Select a pull request to load the review cockpit.
      </div>
    );
  }

  const threadsByPath = dashboard.threads.reduce<Record<string, PrReviewThread[]>>(
    (acc, thread) => {
      if (!thread.path) return acc;
      if (!acc[thread.path]) acc[thread.path] = [];
      acc[thread.path]!.push(thread);
      return acc;
    },
    {},
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--background)_86%,var(--foreground))_0%,transparent_54%)]">
      <div className="border-b border-border/70 px-5 py-4">
        <SectionHeading
          action={
            <Button
              onClick={() => {
                void ensureNativeApi().shell.openExternal(dashboard.pullRequest.url);
              }}
              size="sm"
              variant="outline"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open on GitHub
            </Button>
          }
          detail={`${projectLabel(project)} is in focus. Diff and file-level comments are scoped to PR #${dashboard.pullRequest.number}.`}
          eyebrow="Workspace"
          title={dashboard.pullRequest.title}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <StatPill
            icon={<GitBranchIcon className="size-3.5" />}
            label="Branches"
            value={`${dashboard.pullRequest.headBranch} -> ${dashboard.pullRequest.baseBranch}`}
          />
          <StatPill
            icon={<MessageSquareIcon className="size-3.5" />}
            label="Threads"
            value={`${dashboard.pullRequest.unresolvedThreadCount}/${dashboard.pullRequest.totalThreadCount} open`}
          />
          <StatPill
            icon={<FileCode2Icon className="size-3.5" />}
            label="Files"
            value={dashboard.files.length}
          />
        </div>
      </div>

      {!renderablePatch ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No patch is available for this pull request.
        </div>
      ) : renderablePatch.kind === "raw" ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
            <p className="mb-3 text-sm text-muted-foreground">{renderablePatch.reason}</p>
            <pre className="overflow-auto whitespace-pre-wrap text-xs leading-6 text-foreground/85">
              {renderablePatch.text}
            </pre>
          </div>
        </div>
      ) : (
        <Virtualizer className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-3">
          {renderablePatch.files.map((fileDiff) => {
            const filePath = resolveFileDiffPath(fileDiff);
            const fileKey = `${buildFileDiffRenderKey(fileDiff)}:${resolvedTheme}`;
            const fileThreads = threadsByPath[filePath] ?? [];
            const isSelected = selectedFilePath === filePath;
            const firstCommentLine = fileThreads[0]?.line ?? 1;
            const stats = summarizeFileDiffStats(fileDiff);
            return (
              <section
                className={cn(
                  "mb-4 overflow-hidden rounded-[24px] border bg-background/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors",
                  isSelected ? "border-amber-500/30" : "border-border/70",
                )}
                data-review-file={filePath}
                key={fileKey}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => onSelectFilePath(filePath)}
                    type="button"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileCode2Icon className="size-4 text-muted-foreground" />
                      <span className="truncate">{filePath}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      +{stats.additions} / -{stats.deletions} · {fileThreads.length} conversation
                      {fileThreads.length === 1 ? "" : "s"}
                    </p>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {fileThreads.slice(0, 2).map((thread) => (
                      <button
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                          threadTone(thread.state),
                          selectedThreadId === thread.id && "ring-1 ring-amber-500/30",
                        )}
                        key={thread.id}
                        onClick={() => {
                          onSelectFilePath(filePath);
                          onSelectThreadId(thread.id);
                        }}
                        type="button"
                      >
                        <MessageSquareIcon className="size-3" />L{thread.line ?? "?"}
                      </button>
                    ))}
                    {fileThreads.length > 2 ? (
                      <span className="text-[11px] text-muted-foreground">
                        +{fileThreads.length - 2} more
                      </span>
                    ) : null}
                    <Button
                      onClick={() => {
                        void openPathInEditor(joinPath(project.cwd, filePath));
                      }}
                      size="xs"
                      variant="outline"
                    >
                      Open
                    </Button>
                  </div>
                </div>
                <div className="p-3">
                  <FileDiff
                    fileDiff={fileDiff}
                    options={{
                      diffStyle: "unified",
                      lineDiffType: "none",
                      overflow: "wrap",
                      theme: resolveDiffThemeName(resolvedTheme),
                      themeType: resolvedTheme,
                      unsafeCSS: PR_REVIEW_DIFF_UNSAFE_CSS,
                    }}
                  />
                </div>
                <div className="space-y-3 border-t border-border/70 bg-muted/18 px-4 py-4">
                  <PrFileCommentComposer
                    cwd={project.cwd}
                    defaultLine={firstCommentLine}
                    participants={dashboard.pullRequest.participants}
                    path={filePath}
                    onSubmit={(input) => onCreateThread({ ...input, path: filePath })}
                  />
                  {fileThreads.length > 0 ? (
                    <div className="space-y-2">
                      {fileThreads.map((thread) => {
                        const firstComment = thread.comments[0];
                        return (
                          <button
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                              threadTone(thread.state),
                              selectedThreadId === thread.id && "ring-1 ring-amber-500/30",
                            )}
                            key={thread.id}
                            onClick={() => {
                              onSelectFilePath(filePath);
                              onSelectThreadId(thread.id);
                            }}
                            type="button"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-medium">
                                {firstComment?.author?.login
                                  ? `@${firstComment.author.login}`
                                  : "Conversation"}{" "}
                                · L{thread.line ?? "?"}
                              </p>
                              <p className="truncate text-xs text-current/80">
                                {shortCommentPreview(firstComment?.body ?? "")}
                              </p>
                            </div>
                            <ChevronRightIcon className="size-4 shrink-0 opacity-60" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No conversations on this file yet.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </Virtualizer>
      )}
    </div>
  );
}

function PrWorkflowPanel({
  config,
  workflowId,
  onWorkflowIdChange,
  workflowSteps,
  conflicts,
  onRunStep,
  onOpenRules,
  onOpenWorkflow,
}: {
  config: PrReviewConfig | undefined;
  workflowId: string | null;
  onWorkflowIdChange: (workflowId: string) => void;
  workflowSteps: readonly { stepId: string; status: string; detail: string | null }[];
  conflicts: PrConflictAnalysis | undefined;
  onRunStep: (stepId: string, requiresConfirmation: boolean, title: string) => Promise<void>;
  onOpenRules: () => void;
  onOpenWorkflow: (relativePath: string) => void;
}) {
  const workflow = resolveWorkflow(config, workflowId);
  const workflowStepMap = new Map(workflowSteps.map((step) => [step.stepId, step]));
  const isPreviewingNonDefault = workflow?.id !== config?.defaultWorkflowId;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Repo workflow
            </p>
            <h3 className="mt-1 font-semibold text-sm text-foreground">
              {config?.source === "default" ? "Using default repo workflow" : "Loaded from .okcode"}
            </h3>
          </div>
          <Button onClick={onOpenRules} size="xs" variant="outline">
            <BookOpenTextIcon className="size-3.5" />
            Review rules
          </Button>
        </div>
        {config ? (
          <Select value={workflow?.id} onValueChange={(value) => onWorkflowIdChange(String(value))}>
            <SelectTrigger aria-label="Workflow definition" size="sm">
              <SelectValue placeholder="Select workflow" />
            </SelectTrigger>
            <SelectPopup>
              {config.workflows.map((entry) => (
                <SelectItem hideIndicator key={entry.id} value={entry.id}>
                  {entry.title}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
        {workflow ? (
          <div className="rounded-2xl border border-border/70 bg-background/90 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm text-foreground">{workflow.title}</p>
                {workflow.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
                ) : null}
              </div>
              <Button
                onClick={() => onOpenWorkflow(workflow.relativePath)}
                size="xs"
                variant="outline"
              >
                <FileCode2Icon className="size-3.5" />
                Open file
              </Button>
            </div>
            {isPreviewingNonDefault ? (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                The repo default workflow is still the active one. This panel is previewing an
                alternate workflow definition.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {config?.issues.length ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="space-y-1 text-amber-800 dark:text-amber-200">
              {config.issues.map((issue) => (
                <p key={`${issue.path}:${issue.message}`}>
                  {issue.path}: {issue.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {workflow ? (
        <div className="space-y-3">
          {workflow.steps.map((step, index) => {
            const resolution = workflowStepMap.get(step.id);
            const status = resolution?.status ?? "todo";
            return (
              <div
                className="rounded-2xl border border-border/70 bg-background/92 px-3 py-3"
                key={step.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-[11px] font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <p className="font-medium text-sm text-foreground">{step.title}</p>
                      <Badge variant={status === "done" ? "secondary" : "outline"}>{status}</Badge>
                    </div>
                    {step.description ? (
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    ) : null}
                    {resolution?.detail ? (
                      <p className="text-xs text-muted-foreground">{resolution.detail}</p>
                    ) : null}
                    {step.kind === "conflictAnalysis" && conflicts ? (
                      <p className="text-xs text-muted-foreground">{conflicts.summary}</p>
                    ) : null}
                    {step.skillSet ? (
                      <p className="text-xs text-muted-foreground">Skill set: {step.skillSet}</p>
                    ) : null}
                  </div>
                  <Button
                    disabled={isPreviewingNonDefault}
                    onClick={() => {
                      void onRunStep(step.id, step.requiresConfirmation, step.title);
                    }}
                    size="xs"
                    variant={status === "done" ? "secondary" : "outline"}
                  >
                    {status === "done" ? (
                      <CheckCircle2Icon className="size-3.5" />
                    ) : (
                      <SparklesIcon className="size-3.5" />
                    )}
                    Run
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {workflow?.body ? (
        <div className="prose prose-sm max-w-none rounded-2xl border border-border/70 bg-background/92 p-4 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{workflow.body}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}

function PrConversationInspector({
  project,
  dashboard,
  config,
  conflicts,
  workflowId,
  onWorkflowIdChange,
  selectedFilePath,
  selectedThreadId,
  onSelectFilePath,
  onSelectThreadId,
  onResolveThread,
  onReplyToThread,
  onRunStep,
  onOpenRules,
  onOpenWorkflow,
  onOpenConflictDrawer,
}: {
  project: Project;
  dashboard: Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;
  config: PrReviewConfig | undefined;
  conflicts: PrConflictAnalysis | undefined;
  workflowId: string | null;
  onWorkflowIdChange: (workflowId: string) => void;
  selectedFilePath: string | null;
  selectedThreadId: string | null;
  onSelectFilePath: (path: string | null) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onResolveThread: (threadId: string, nextAction: "resolve" | "unresolve") => Promise<void>;
  onReplyToThread: (threadId: string, body: string) => Promise<void>;
  onRunStep: (stepId: string, requiresConfirmation: boolean, title: string) => Promise<void>;
  onOpenRules: () => void;
  onOpenWorkflow: (relativePath: string) => void;
  onOpenConflictDrawer: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("threads");
  const [replyingThreadId, setReplyingThreadId] = useState<string | null>(null);

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted-foreground">
        Select a pull request to inspect conversations, repo rules, and workflow state.
      </div>
    );
  }

  const visibleThreads = selectedFilePath
    ? dashboard.threads.filter((thread) => thread.path === selectedFilePath)
    : dashboard.threads;

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-background/96">
      <div className="border-b border-border/70 px-4 py-4">
        <SectionHeading
          action={
            <Button onClick={onOpenConflictDrawer} size="xs" variant="outline">
              <ShieldCheckIcon className="size-3.5" />
              Conflicts
            </Button>
          }
          detail={`Repo focus: ${projectLabel(project)}. ${selectedFilePath ? `Filtered to ${selectedFilePath}.` : "Showing all files."}`}
          eyebrow="Inspector"
          title="Conversations and rules"
        />
        <ToggleGroup
          className="mt-4"
          size="xs"
          value={[tab]}
          variant="outline"
          onValueChange={(values) => {
            const nextValue = values[values.length - 1];
            if (nextValue === "threads" || nextValue === "workflow" || nextValue === "people") {
              setTab(nextValue);
            }
          }}
        >
          <Toggle value="threads">
            <MessageSquareIcon className="size-3.5" />
            Threads
          </Toggle>
          <Toggle value="workflow">
            <SparklesIcon className="size-3.5" />
            Workflow
          </Toggle>
          <Toggle value="people">
            <UsersIcon className="size-3.5" />
            People
          </Toggle>
        </ToggleGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4">
          {tab === "threads" ? (
            <>
              {selectedFilePath ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Filtered to {selectedFilePath}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Only conversations on the focused file are shown here.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      onSelectFilePath(null);
                      onSelectThreadId(null);
                    }}
                    size="xs"
                    variant="outline"
                  >
                    Clear focus
                  </Button>
                </div>
              ) : null}
              {visibleThreads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/18 px-4 py-6 text-sm text-muted-foreground">
                  No conversations are visible for the current scope.
                </div>
              ) : (
                visibleThreads.map((thread) => {
                  const replyDraftKey = `okcode:pr-review:reply:${project.id}:${dashboard.pullRequest.number}:${thread.id}`;
                  const [replyBody, setReplyBody] = useLocalStorage(
                    replyDraftKey,
                    "",
                    TEXT_DRAFT_SCHEMA,
                  );
                  const isSelected = selectedThreadId === thread.id;
                  return (
                    <div
                      className={cn(
                        "rounded-[24px] border px-4 py-4",
                        threadTone(thread.state),
                        isSelected && "ring-1 ring-amber-500/30",
                      )}
                      key={thread.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            onSelectThreadId(thread.id);
                            if (thread.path) onSelectFilePath(thread.path);
                          }}
                          type="button"
                        >
                          <p className="font-medium text-sm">
                            {thread.path ?? "General conversation"}
                            {thread.line ? ` · L${thread.line}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-current/75">
                            {thread.comments.length} comment
                            {thread.comments.length === 1 ? "" : "s"} · {thread.state}
                          </p>
                        </button>
                        <Button
                          onClick={() => {
                            void onResolveThread(
                              thread.id,
                              thread.isResolved ? "unresolve" : "resolve",
                            );
                          }}
                          size="xs"
                          variant="outline"
                        >
                          {thread.isResolved ? "Reopen" : "Resolve"}
                        </Button>
                      </div>
                      <div className="mt-4 space-y-4">
                        {thread.comments.map((comment) => (
                          <div
                            className="rounded-2xl border border-border/70 bg-background/90 px-3 py-3"
                            key={comment.id}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                {comment.author ? (
                                  <PrUserHoverCard cwd={project.cwd} login={comment.author.login}>
                                    @{comment.author.login}
                                  </PrUserHoverCard>
                                ) : (
                                  <span className="text-sm font-medium text-foreground">
                                    Unknown
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatRelativeTime(comment.createdAt)}
                                </span>
                              </div>
                              {comment.url ? (
                                <Button
                                  onClick={() => {
                                    void ensureNativeApi().shell.openExternal(comment.url ?? "");
                                  }}
                                  size="icon-xs"
                                  variant="ghost"
                                >
                                  <ExternalLinkIcon className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                            <div className="mt-3">
                              <PrCommentBody body={comment.body} cwd={project.cwd} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-background/92 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Reply
                          </p>
                          <Button
                            onClick={() =>
                              setReplyingThreadId((current) =>
                                current === thread.id ? null : thread.id,
                              )
                            }
                            size="xs"
                            variant="outline"
                          >
                            {replyingThreadId === thread.id ? "Hide" : "Reply"}
                          </Button>
                        </div>
                        {replyingThreadId === thread.id ? (
                          <>
                            <PrMentionComposer
                              cwd={project.cwd}
                              participants={dashboard.pullRequest.participants}
                              placeholder="Reply to this conversation"
                              value={replyBody}
                              onChange={setReplyBody}
                            />
                            <div className="flex justify-end">
                              <Button
                                disabled={replyBody.trim().length === 0}
                                onClick={() => {
                                  void onReplyToThread(thread.id, replyBody.trim()).then(() => {
                                    setReplyBody("");
                                    setReplyingThreadId(null);
                                  });
                                }}
                                size="sm"
                              >
                                <MessageSquareIcon className="size-3.5" />
                                Add reply
                              </Button>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </>
          ) : null}

          {tab === "workflow" ? (
            <PrWorkflowPanel
              conflicts={conflicts}
              config={config}
              onOpenRules={onOpenRules}
              onOpenWorkflow={onOpenWorkflow}
              onRunStep={onRunStep}
              onWorkflowIdChange={onWorkflowIdChange}
              workflowId={workflowId}
              workflowSteps={dashboard.workflowSteps}
            />
          ) : null}

          {tab === "people" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Participants
                </p>
                <div className="mt-4 grid gap-3">
                  {dashboard.pullRequest.participants.map((participant) => (
                    <div
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/22 px-3 py-3"
                      key={`${participant.user.login}:${participant.role}`}
                    >
                      <img
                        alt={participant.user.login}
                        className="size-10 rounded-full border border-border/70"
                        src={participant.user.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <PrUserHoverCard cwd={project.cwd} login={participant.user.login}>
                          @{participant.user.login}
                        </PrUserHoverCard>
                        <p className="truncate text-xs text-muted-foreground">{participant.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Repo rules
                </p>
                <div className="mt-4 space-y-3">
                  {config?.rules.blockingRules.map((rule) => (
                    <div key={rule.id}>
                      <p className="font-medium text-sm text-foreground">{rule.title}</p>
                      {rule.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function PrConflictDrawer({
  open,
  onOpenChange,
  project,
  conflictAnalysis,
  onApplyResolution,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  conflictAnalysis: PrConflictAnalysis | undefined;
  onApplyResolution: (candidateId: string) => Promise<void>;
}) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedCandidateId(conflictAnalysis?.candidates[0]?.id ?? null);
  }, [conflictAnalysis?.candidates, open]);

  const selectedCandidate =
    conflictAnalysis?.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-[min(1100px,calc(100vw-3rem))]" side="right" variant="inset">
        <SheetHeader>
          <SheetTitle>Conflict resolution</SheetTitle>
          <SheetDescription>
            {conflictAnalysis?.summary ?? "Merge conflict analysis is unavailable."}
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="grid min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Repo focus
              </p>
              <p className="mt-2 font-medium text-sm text-foreground">{projectLabel(project)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{project.cwd}</p>
            </div>
            {conflictAnalysis?.candidates.length ? (
              conflictAnalysis.candidates.map((candidate) => (
                <button
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                    selectedCandidateId === candidate.id
                      ? "border-amber-500/30 bg-amber-500/8"
                      : "border-border/70 bg-background/90 hover:bg-muted/35",
                  )}
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">{candidate.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{candidate.path}</p>
                    </div>
                    <Badge
                      className={cn(
                        candidate.confidence === "safe"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {candidate.confidence}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{candidate.description}</p>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/18 px-4 py-6 text-sm text-muted-foreground">
                No candidate resolutions were generated. OK Code will only propose deterministic
                resolutions automatically.
              </div>
            )}
          </div>
          <div className="min-h-0 rounded-[24px] border border-border/70 bg-background/94">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4">
              <div>
                <p className="font-medium text-sm text-foreground">
                  {selectedCandidate?.title ?? "No candidate selected"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preview patch before applying any conflict resolution.
                </p>
              </div>
              {selectedCandidate ? (
                <Button
                  onClick={() => {
                    void onApplyResolution(selectedCandidate.id);
                  }}
                  size="sm"
                >
                  <ShieldCheckIcon className="size-3.5" />
                  Apply candidate
                </Button>
              ) : null}
            </div>
            <ScrollArea className="min-h-0 h-full">
              <div className="p-4">
                {selectedCandidate ? (
                  <pre className="overflow-auto whitespace-pre-wrap rounded-2xl border border-border/70 bg-muted/22 p-4 text-xs leading-6 text-foreground/88">
                    {selectedCandidate.previewPatch}
                  </pre>
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Select a candidate to preview the patch.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}

export function PrReviewShell({
  project,
  projects,
  selectedProjectId,
  onProjectChange,
}: {
  project: Project;
  projects: readonly Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}) {
  const queryClient = useQueryClient();
  const isInspectorSheet = useMediaQuery("max-xl");
  const [pullRequestState, setPullRequestState] = useState<PullRequestState>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrNumber, setSelectedPrNumber] = useState<number | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [conflictDrawerOpen, setConflictDrawerOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const reviewDraftKey = `okcode:pr-review:review-draft:${project.id}:${selectedPrNumber ?? "none"}`;
  const [reviewBody, setReviewBody] = useLocalStorage(reviewDraftKey, "", TEXT_DRAFT_SCHEMA);

  const pullRequestsQuery = useQuery(
    gitListPullRequestsQueryOptions({
      cwd: project.cwd,
      state: pullRequestState,
    }),
  );
  const configQuery = useQuery(prReviewConfigQueryOptions(project.cwd));
  const dashboardQuery = useQuery(
    prReviewDashboardQueryOptions({
      cwd: project.cwd,
      prNumber: selectedPrNumber,
    }),
  );
  const patchQuery = useQuery(
    prReviewPatchQueryOptions({
      cwd: project.cwd,
      prNumber: selectedPrNumber,
    }),
  );
  const conflictQuery = useQuery(
    prReviewConflictsQueryOptions({
      cwd: project.cwd,
      prNumber: selectedPrNumber,
    }),
  );

  const filteredPullRequests = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (query.length === 0) {
      return pullRequestsQuery.data?.pullRequests ?? [];
    }
    return (pullRequestsQuery.data?.pullRequests ?? []).filter((pullRequest) => {
      const haystack = [
        pullRequest.title,
        pullRequest.author,
        pullRequest.baseBranch,
        pullRequest.headBranch,
        ...pullRequest.labels.map((label) => label.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deferredSearchQuery, pullRequestsQuery.data?.pullRequests]);

  const selectedPullRequest =
    filteredPullRequests.find((pullRequest) => pullRequest.number === selectedPrNumber) ?? null;

  useEffect(() => {
    const nextDefault =
      filteredPullRequests.find((pullRequest) => pullRequest.number === selectedPrNumber) ??
      filteredPullRequests[0] ??
      null;
    if (!nextDefault) {
      if (selectedPrNumber !== null) setSelectedPrNumber(null);
      return;
    }
    if (selectedPrNumber !== nextDefault.number) {
      setSelectedPrNumber(nextDefault.number);
    }
  }, [filteredPullRequests, selectedPrNumber]);

  useEffect(() => {
    setSelectedFilePath(null);
    setSelectedThreadId(null);
  }, [selectedPrNumber]);

  useEffect(() => {
    const files = patchQuery.data?.files ?? [];
    if (files.length === 0) {
      setSelectedFilePath(null);
      return;
    }
    if (!selectedFilePath || !files.some((file) => file.path === selectedFilePath)) {
      setSelectedFilePath(files[0]?.path ?? null);
    }
  }, [patchQuery.data?.files, selectedFilePath]);

  useEffect(() => {
    if (!configQuery.data) return;
    setWorkflowId((current) => {
      if (current && configQuery.data.workflows.some((workflow) => workflow.id === current)) {
        return current;
      }
      return configQuery.data.defaultWorkflowId;
    });
  }, [configQuery.data]);

  const handleSyncUpdated = useEffectEvent((payload: { cwd: string; prNumber: number }) => {
    if (payload.cwd !== project.cwd) return;
    void queryClient.invalidateQueries({ queryKey: ["git", "pull-requests", project.cwd] });
    void invalidatePrReviewQueries(queryClient, payload.cwd, payload.prNumber);
  });

  const handleRepoConfigUpdated = useEffectEvent((payload: { cwd: string }) => {
    if (payload.cwd !== project.cwd) return;
    void queryClient.invalidateQueries({ queryKey: ["prReview", "config", project.cwd] });
  });

  useEffect(() => {
    const api = ensureNativeApi();
    const unsubscribeSync = api.prReview.onSyncUpdated(handleSyncUpdated);
    const unsubscribeConfig = api.prReview.onRepoConfigUpdated(handleRepoConfigUpdated);
    return () => {
      unsubscribeSync();
      unsubscribeConfig();
    };
  }, [handleRepoConfigUpdated, handleSyncUpdated]);

  const addThreadMutation = useMutation({
    mutationFn: async (input: { path: string; line: number; body: string }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.addThread({
        cwd: project.cwd,
        prNumber: selectedPrNumber,
        path: input.path,
        line: input.line,
        body: input.body,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, project.cwd, selectedPrNumber);
    },
  });

  const replyToThreadMutation = useMutation({
    mutationFn: async (input: { threadId: string; body: string }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.replyToThread({
        cwd: project.cwd,
        prNumber: selectedPrNumber,
        threadId: input.threadId,
        body: input.body,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, project.cwd, selectedPrNumber);
    },
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (input: { threadId: string; action: "resolve" | "unresolve" }) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      if (input.action === "resolve") {
        return ensureNativeApi().prReview.resolveThread({
          cwd: project.cwd,
          prNumber: selectedPrNumber,
          threadId: input.threadId,
        });
      }
      return ensureNativeApi().prReview.unresolveThread({
        cwd: project.cwd,
        prNumber: selectedPrNumber,
        threadId: input.threadId,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, project.cwd, selectedPrNumber);
    },
  });

  const runWorkflowStepMutation = useMutation({
    mutationFn: async (stepId: string) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.runWorkflowStep({
        cwd: project.cwd,
        prNumber: selectedPrNumber,
        stepId,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, project.cwd, selectedPrNumber);
    },
  });

  const applyConflictResolutionMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      const confirmed = await ensureNativeApi().dialogs.confirm(
        "Apply this conflict resolution candidate to the repository?",
      );
      if (!confirmed) return null;
      return ensureNativeApi().prReview.applyConflictResolution({
        cwd: project.cwd,
        prNumber: selectedPrNumber,
        candidateId,
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      await invalidatePrReviewQueries(queryClient, project.cwd, selectedPrNumber);
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES") => {
      if (!selectedPrNumber) throw new Error("Select a pull request first.");
      return ensureNativeApi().prReview.submitReview({
        cwd: project.cwd,
        prNumber: selectedPrNumber,
        event,
        body: reviewBody.trim(),
      });
    },
    onSuccess: async () => {
      if (!selectedPrNumber) return;
      setReviewBody("");
      await invalidatePrReviewQueries(queryClient, project.cwd, selectedPrNumber);
    },
  });

  const selectedWorkflow = resolveWorkflow(configQuery.data, workflowId);
  const checksSummary = configQuery.data
    ? requiredChecksState(configQuery.data, dashboardQuery.data?.pullRequest.statusChecks ?? [])
    : { failing: [] as string[], pending: [] as string[] };
  const blockingWorkflowSteps = (dashboardQuery.data?.workflowSteps ?? []).filter(
    (step) => step.status === "blocked" || step.status === "failed",
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <PrListRail
            isLoading={pullRequestsQuery.isLoading || pullRequestsQuery.isFetching}
            onProjectChange={onProjectChange}
            onPullRequestStateChange={setPullRequestState}
            onSearchQueryChange={setSearchQuery}
            onSelectPr={(pullRequest) => {
              startTransition(() => {
                setSelectedPrNumber(pullRequest.number);
                setSelectedThreadId(null);
                setInspectorOpen(true);
              });
            }}
            projects={projects}
            pullRequestState={pullRequestState}
            pullRequests={filteredPullRequests}
            searchQuery={searchQuery}
            selectedPrNumber={selectedPrNumber}
            selectedProjectId={selectedProjectId}
          />
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Focus
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {projectLabel(project)}
                  </span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground capitalize">{pullRequestState}</span>
                  {selectedPullRequest ? (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="truncate text-muted-foreground">
                        PR #{selectedPullRequest.number}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              {isInspectorSheet ? (
                <Button onClick={() => setInspectorOpen(true)} size="sm" variant="outline">
                  <PanelRightIcon className="size-3.5" />
                  Inspector
                </Button>
              ) : null}
            </div>
            <PrWorkspace
              dashboard={dashboardQuery.data}
              onCreateThread={async (input) => {
                await addThreadMutation.mutateAsync(input);
              }}
              onSelectFilePath={setSelectedFilePath}
              onSelectThreadId={setSelectedThreadId}
              patch={patchQuery.data?.combinedPatch ?? null}
              project={project}
              selectedFilePath={selectedFilePath}
              selectedThreadId={selectedThreadId}
            />
          </div>
          {!isInspectorSheet ? (
            <div className="min-h-0 border-l border-border/70">
              <PrConversationInspector
                config={configQuery.data}
                conflicts={conflictQuery.data}
                dashboard={dashboardQuery.data}
                onOpenConflictDrawer={() => setConflictDrawerOpen(true)}
                onOpenRules={() => {
                  if (!configQuery.data) return;
                  void openPathInEditor(joinPath(project.cwd, configQuery.data.rules.relativePath));
                }}
                onOpenWorkflow={(relativePath) => {
                  void openPathInEditor(joinPath(project.cwd, relativePath));
                }}
                onReplyToThread={async (threadId, body) => {
                  await replyToThreadMutation.mutateAsync({ threadId, body });
                }}
                onResolveThread={async (threadId, nextAction) => {
                  await resolveThreadMutation.mutateAsync({ threadId, action: nextAction });
                }}
                onRunStep={async (stepId, requiresConfirmation, title) => {
                  if (requiresConfirmation) {
                    const confirmed = await ensureNativeApi().dialogs.confirm(
                      `Run workflow step "${title}"?`,
                    );
                    if (!confirmed) return;
                  }
                  await runWorkflowStepMutation.mutateAsync(stepId);
                }}
                onSelectFilePath={setSelectedFilePath}
                onSelectThreadId={setSelectedThreadId}
                onWorkflowIdChange={setWorkflowId}
                project={project}
                selectedFilePath={selectedFilePath}
                selectedThreadId={selectedThreadId}
                workflowId={workflowId}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-border/70 bg-background/96 px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <SectionHeading
              detail="Review submission is scoped to the focused repo and selected PR."
              eyebrow="Action rail"
              title="Submit review"
            />
            <div className="flex flex-wrap gap-2">
              <StatPill
                icon={<MessageSquareIcon className="size-3.5" />}
                label="Open threads"
                value={dashboardQuery.data?.pullRequest.unresolvedThreadCount ?? 0}
              />
              <StatPill
                icon={<ShieldCheckIcon className="size-3.5" />}
                label="Conflicts"
                value={conflictQuery.data?.status ?? "unknown"}
              />
              <StatPill
                icon={<CheckCircle2Icon className="size-3.5" />}
                label="Required checks"
                value={
                  configQuery.data?.rules.requiredChecks.length
                    ? checksSummary.failing.length > 0
                      ? `${checksSummary.failing.length} failing`
                      : checksSummary.pending.length > 0
                        ? `${checksSummary.pending.length} pending`
                        : "ready"
                    : "not enforced"
                }
              />
              <StatPill
                icon={<SparklesIcon className="size-3.5" />}
                label="Workflow"
                value={blockingWorkflowSteps.length > 0 ? "blocked" : "clear"}
              />
            </div>
          </div>
          <div className="w-full max-w-2xl space-y-3">
            <PrMentionComposer
              cwd={project.cwd}
              participants={dashboardQuery.data?.pullRequest.participants ?? []}
              placeholder="Write a review summary or use @ to notify collaborators."
              rows={3}
              value={reviewBody}
              onChange={setReviewBody}
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                disabled={submitReviewMutation.isPending}
                onClick={() => {
                  void submitReviewMutation.mutateAsync("COMMENT");
                }}
                size="sm"
                variant="outline"
              >
                <MessageSquareIcon className="size-3.5" />
                Comment
              </Button>
              <Button
                disabled={
                  submitReviewMutation.isPending ||
                  conflictQuery.data?.status === "conflicted" ||
                  checksSummary.failing.length > 0 ||
                  checksSummary.pending.length > 0
                }
                onClick={() => {
                  void submitReviewMutation.mutateAsync("APPROVE");
                }}
                size="sm"
                variant="secondary"
              >
                <CheckCircle2Icon className="size-3.5" />
                Approve
              </Button>
              <Button
                disabled={submitReviewMutation.isPending}
                onClick={() => {
                  void submitReviewMutation.mutateAsync("REQUEST_CHANGES");
                }}
                size="sm"
                variant="default"
              >
                <AlertTriangleIcon className="size-3.5" />
                Request changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {isInspectorSheet ? (
        <Sheet onOpenChange={setInspectorOpen} open={inspectorOpen}>
          <SheetPopup side="right" variant="inset">
            <SheetHeader>
              <SheetTitle>Inspector</SheetTitle>
              <SheetDescription>
                Conversations, repo workflow, and participant context for the focused pull request.
              </SheetDescription>
            </SheetHeader>
            <SheetPanel className="p-0">
              <PrConversationInspector
                config={configQuery.data}
                conflicts={conflictQuery.data}
                dashboard={dashboardQuery.data}
                onOpenConflictDrawer={() => {
                  setInspectorOpen(false);
                  setConflictDrawerOpen(true);
                }}
                onOpenRules={() => {
                  if (!configQuery.data) return;
                  void openPathInEditor(joinPath(project.cwd, configQuery.data.rules.relativePath));
                }}
                onOpenWorkflow={(relativePath) => {
                  void openPathInEditor(joinPath(project.cwd, relativePath));
                }}
                onReplyToThread={async (threadId, body) => {
                  await replyToThreadMutation.mutateAsync({ threadId, body });
                }}
                onResolveThread={async (threadId, nextAction) => {
                  await resolveThreadMutation.mutateAsync({ threadId, action: nextAction });
                }}
                onRunStep={async (stepId, requiresConfirmation, title) => {
                  if (requiresConfirmation) {
                    const confirmed = await ensureNativeApi().dialogs.confirm(
                      `Run workflow step "${title}"?`,
                    );
                    if (!confirmed) return;
                  }
                  await runWorkflowStepMutation.mutateAsync(stepId);
                }}
                onSelectFilePath={setSelectedFilePath}
                onSelectThreadId={setSelectedThreadId}
                onWorkflowIdChange={setWorkflowId}
                project={project}
                selectedFilePath={selectedFilePath}
                selectedThreadId={selectedThreadId}
                workflowId={workflowId}
              />
            </SheetPanel>
          </SheetPopup>
        </Sheet>
      ) : null}

      <PrConflictDrawer
        conflictAnalysis={conflictQuery.data}
        onApplyResolution={(candidateId) =>
          applyConflictResolutionMutation.mutateAsync(candidateId).then(() => undefined)
        }
        onOpenChange={setConflictDrawerOpen}
        open={conflictDrawerOpen}
        project={project}
      />
    </>
  );
}
