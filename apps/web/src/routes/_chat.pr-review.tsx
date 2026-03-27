import type { GitResolvedPullRequest } from "@okcode/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  MessageSquareIcon,
  SearchIcon,
  XCircleIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useRef, useState, useEffect } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { isElectron } from "~/env";
import { gitResolvePullRequestQueryOptions } from "~/lib/gitReactQuery";
import { cn } from "~/lib/utils";
import { parsePullRequestReference } from "~/pullRequestReference";
import { useStore } from "~/store";

// ── Helpers ──────────────────────────────────────────────────────────

function useFirstProjectCwd(): string | null {
  return useStore((store) => store.projects[0]?.cwd ?? null);
}

function prStateIcon(state: string) {
  switch (state) {
    case "open":
      return <GitPullRequestIcon className="size-4" />;
    case "merged":
      return <GitMergeIcon className="size-4" />;
    case "closed":
      return <XCircleIcon className="size-4" />;
    default:
      return <CircleDotIcon className="size-4" />;
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

// ── Section wrapper (conversation-style) ────────────────────────────

function ReviewSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 duration-300",
        className,
      )}
    >
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

// ── PR Input ────────────────────────────────────────────────────────

function PRInput({
  onResolve,
  isResolving,
  error,
}: {
  onResolve: (reference: string) => void;
  isResolving: boolean;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      onResolve(trimmed);
    }
  }, [onResolve, value]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            className="pl-9"
            placeholder="Paste a PR URL or enter #42..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={value.trim().length === 0 || isResolving}
        >
          {isResolving ? (
            <>
              <Spinner className="size-3.5" />
              Resolving...
            </>
          ) : (
            "Review"
          )}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

// ── PR Header ───────────────────────────────────────────────────────

function PRHeader({ pr }: { pr: GitResolvedPullRequest }) {
  const tone = prStateTone(pr.state);

  return (
    <ReviewSection>
      <div className="space-y-4">
        {/* State badge + number */}
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

        {/* Branch flow */}
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

        {/* Link */}
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

// ── Review checklist ─────────────────────────────────────────────────

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
              allComplete
                ? "bg-emerald-500 dark:bg-emerald-400"
                : "bg-primary",
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

// ── Branch context ───────────────────────────────────────────────────

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

// ── Quick actions ────────────────────────────────────────────────────

function QuickActions({ pr }: { pr: GitResolvedPullRequest }) {
  return (
    <ReviewSection>
      <SectionLabel>Actions</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {pr.url ? (
          <Button
            size="sm"
            variant="outline"
            render={
              <a href={pr.url} target="_blank" rel="noopener noreferrer" />
            }
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

// ── Review notes ─────────────────────────────────────────────────────

function ReviewNotes() {
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState<string[]>([]);

  const handleAddNote = useCallback(() => {
    const trimmed = notes.trim();
    if (trimmed.length === 0) return;
    setSavedNotes((prev) => [...prev, trimmed]);
    setNotes("");
  }, [notes]);

  return (
    <ReviewSection>
      <SectionLabel>Notes</SectionLabel>
      <div className="overflow-hidden rounded-2xl border border-border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5">
        {savedNotes.length > 0 ? (
          <div className="border-b border-border">
            {savedNotes.map((note, index) => (
              <div
                key={index}
                className="border-t border-border px-4 py-3 first:border-t-0"
              >
                <p className="text-sm text-foreground whitespace-pre-wrap">{note}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Note {index + 1}
                </p>
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
              {navigator.platform.includes("Mac") ? "\u2318" : "Ctrl"}+Enter to
              save
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

// ── Summary card ─────────────────────────────────────────────────────

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

// ── Main view ────────────────────────────────────────────────────────

function PRReviewContent({ pr }: { pr: GitResolvedPullRequest }) {
  return (
    <div className="space-y-6">
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

function PRReviewEmptyState({ cwd }: { cwd: string | null }) {
  const [reference, setReference] = useState("");
  const queryClient = useQueryClient();
  const [debouncedReference] = useDebouncedValue(reference, { wait: 400 });

  const parsedReference = parsePullRequestReference(reference);
  const parsedDebouncedReference = parsePullRequestReference(debouncedReference);

  const resolveQuery = useQuery(
    gitResolvePullRequestQueryOptions({
      cwd,
      reference: parsedDebouncedReference,
    }),
  );

  const cachedPr = useMemo(() => {
    if (!cwd || !parsedReference) return null;
    const cached = queryClient.getQueryData<{ pullRequest: GitResolvedPullRequest }>([
      "git",
      "pull-request",
      cwd,
      parsedReference,
    ]);
    return cached?.pullRequest ?? null;
  }, [cwd, parsedReference, queryClient]);

  const livePr =
    parsedReference !== null && parsedReference === parsedDebouncedReference
      ? (resolveQuery.data?.pullRequest ?? null)
      : null;

  const resolvedPr = livePr ?? cachedPr;

  const isResolving =
    parsedReference !== null &&
    resolvedPr === null &&
    (parsedReference !== parsedDebouncedReference ||
      resolveQuery.isPending ||
      resolveQuery.isFetching);

  const error =
    resolvedPr === null && resolveQuery.isError
      ? resolveQuery.error instanceof Error
        ? resolveQuery.error.message
        : "Failed to resolve pull request."
      : null;

  if (resolvedPr) {
    return <PRReviewContent pr={resolvedPr} />;
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Review a pull request
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
          Paste a GitHub PR URL or enter a number to get a structured breakdown.
          Walk through the change, check off review items, and leave notes.
        </p>
      </div>

      {/* Input */}
      <PRInput
        onResolve={(ref) => setReference(ref)}
        isResolving={isResolving}
        error={error}
      />

      {/* Hint cards */}
      <div className="space-y-2">
        <SectionLabel>Try with</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              label: "PR URL",
              example: "https://github.com/owner/repo/pull/42",
            },
            {
              label: "PR number",
              example: "#42 or 42",
            },
          ].map((hint) => (
            <button
              key={hint.label}
              type="button"
              className="group rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/30"
              onClick={() => setReference(hint.example)}
            >
              <p className="text-xs font-medium text-foreground">{hint.label}</p>
              <code className="mt-1 block text-xs text-muted-foreground font-mono group-hover:text-foreground transition-colors">
                {hint.example}
              </code>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PRReviewRouteView() {
  const cwd = useFirstProjectCwd();

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
          <div className="mx-auto w-full max-w-2xl px-6 py-8">
            {cwd ? (
              <PRReviewEmptyState cwd={cwd} />
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
