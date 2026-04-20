import type {
  NativeApi,
  PrAgentReviewResult,
  PrConflictAnalysis,
  PrReviewConfig,
} from "@okcode/contracts";
import { useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronUpIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { PrMentionComposer } from "./PrMentionComposer";
import { requiredChecksState } from "./pr-review-utils";

// ── Local helpers ──────────────────────────────────────────────────────

function formatReviewDecision(decision: string | null | undefined): string {
  if (!decision) return "No decision yet";
  return decision.toLowerCase().replaceAll("_", " ");
}

function reviewDecisionTone(decision: string | null | undefined): string {
  switch (decision) {
    case "APPROVED":
      return "text-emerald-600 dark:text-emerald-400";
    case "CHANGES_REQUESTED":
    case "REVIEW_REQUIRED":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function formatConflictStatus(status: string | null | undefined): string {
  if (!status) return "Conflict status unknown";
  if (status === "clean") return "No merge conflicts";
  if (status === "conflicted") return "Merge conflicts";
  return status.replaceAll("_", " ");
}

function formatReviewTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

// ── Types ──────────────────────────────────────────────────────────────

type DashboardData = Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;

export function PrActionRail({
  projectCwd,
  dashboard,
  config,
  conflicts,
  agentResult,
  reviewBody,
  onReviewBodyChange,
  onSubmitReview,
  isSubmitting,
  requestChangesVariant,
}: {
  projectCwd: string;
  dashboard: DashboardData;
  config: PrReviewConfig | undefined;
  conflicts: PrConflictAnalysis | undefined;
  agentResult: PrAgentReviewResult | null | undefined;
  reviewBody: string;
  onReviewBodyChange: (body: string) => void;
  onSubmitReview: (event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES") => void;
  isSubmitting: boolean;
  requestChangesVariant: "default" | "destructive-outline" | "outline";
}) {
  const [actionRailExpanded, setActionRailExpanded] = useState(false);

  // ── Derived data ───────────────────────────────────────────────────

  const checksSummary = config
    ? requiredChecksState(config, dashboard?.pullRequest.statusChecks ?? [])
    : { failing: [] as string[], pending: [] as string[] };

  const blockingWorkflowSteps = (dashboard?.workflowSteps ?? []).filter(
    (step) => step.status === "blocked" || step.status === "failed",
  );

  const fileStats = useMemo(() => {
    const files = dashboard?.files ?? [];
    return files.reduce(
      (totals, file) => ({
        changedFileCount: totals.changedFileCount + 1,
        additions: totals.additions + file.additions,
        deletions: totals.deletions + file.deletions,
      }),
      { changedFileCount: 0, additions: 0, deletions: 0 },
    );
  }, [dashboard?.files]);

  const approvalBlockers = useMemo(
    () => [
      ...(conflicts?.status === "conflicted" ? ["Merge conflicts must be resolved"] : []),
      ...checksSummary.failing.map((name) => `Failing check: ${name}`),
      ...checksSummary.pending.map((name) => `Pending check: ${name}`),
      ...blockingWorkflowSteps.map(
        (step) => `Workflow blocked: ${step.detail ?? step.stepId}`,
      ),
    ],
    [conflicts?.status, checksSummary.failing, checksSummary.pending, blockingWorkflowSteps],
  );

  const approveDisabled =
    isSubmitting ||
    conflicts?.status === "conflicted" ||
    checksSummary.failing.length > 0 ||
    checksSummary.pending.length > 0;

  const recentReviews = dashboard?.pullRequest.recentReviews ?? [];
  const displayedRecentReviews = recentReviews.slice(0, 3);

  const agentStatus = agentResult?.status ?? "idle";
  const agentIsRunning = agentStatus === "queued" || agentStatus === "running";

  return (
    <div className="border-t border-border/70 bg-background/96">
      {/* Collapsed bar */}
      <div
        className={cn(
          "flex min-h-10 items-center justify-between gap-3 px-4 py-2",
          actionRailExpanded && "border-b border-border/50",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Submit review</span>
          <span
            className={cn(
              "capitalize font-medium",
              reviewDecisionTone(dashboard?.pullRequest.reviewDecision),
            )}
          >
            {formatReviewDecision(dashboard?.pullRequest.reviewDecision)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquareIcon className="size-3" />
            {dashboard?.pullRequest.unresolvedThreadCount ?? 0} open
          </span>
          <span>{fileStats.changedFileCount} files</span>
          <span className="flex items-center gap-1">
            <ShieldCheckIcon className="size-3" />
            {formatConflictStatus(conflicts?.status)}
          </span>
          {agentResult ? (
            <span
              className={cn(
                "flex items-center gap-1",
                agentIsRunning
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              <SparklesIcon
                className={cn("size-3", agentIsRunning && "animate-pulse")}
              />
              AI
            </span>
          ) : null}
          {approvalBlockers.length > 0 ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangleIcon className="size-3" />
              {approvalBlockers.length} blocker{approvalBlockers.length === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3" />
              ready to approve
            </span>
          )}
        </div>
        <Button
          onClick={() => setActionRailExpanded(!actionRailExpanded)}
          size="xs"
          variant="ghost"
        >
          <ChevronUpIcon
            className={cn("size-3.5 transition-transform", actionRailExpanded && "rotate-180")}
          />
          {actionRailExpanded ? "Collapse" : "Review"}
        </Button>
      </div>

      {/* Expanded content */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          actionRailExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 py-3">
            {/* 3-card grid */}
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
              {/* Review decision card */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Review decision
                </div>
                <div
                  className={cn(
                    "mt-1 font-medium capitalize",
                    reviewDecisionTone(dashboard?.pullRequest.reviewDecision),
                  )}
                >
                  {formatReviewDecision(dashboard?.pullRequest.reviewDecision)}
                </div>
              </div>

              {/* File impact card */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  File impact
                </div>
                <div className="mt-1 font-medium text-foreground">
                  {fileStats.changedFileCount}{" "}
                  {fileStats.changedFileCount === 1 ? "file" : "files"}, +{fileStats.additions} /
                  -{fileStats.deletions}
                </div>
              </div>

              {/* Approval status card */}
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Approval status
                </div>
                {approvalBlockers.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-muted-foreground">
                    {approvalBlockers.slice(0, 4).map((blocker) => (
                      <li className="flex items-start gap-1.5" key={blocker}>
                        <AlertTriangleIcon className="mt-0.5 size-3 shrink-0 text-amber-500" />
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-3.5" />
                    Ready to approve
                  </div>
                )}
              </div>
            </div>

            {/* Recent maintainer reviews */}
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Recent maintainer reviews
              </div>
              {displayedRecentReviews.length > 0 ? (
                <div className="space-y-1.5">
                  {displayedRecentReviews.map((review) => (
                    <div
                      className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs"
                      key={`${review.authorLogin}:${review.submittedAt}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">
                            {review.authorLogin}
                          </span>
                          <span className="ml-2 capitalize text-muted-foreground">
                            {review.state.toLowerCase().replaceAll("_", " ")}
                          </span>
                        </div>
                        <span className="shrink-0 text-muted-foreground">
                          {formatReviewTimestamp(review.submittedAt)}
                        </span>
                      </div>
                      {review.body.trim().length > 0 ? (
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-muted-foreground">
                          {review.body}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No maintainer reviews yet.</div>
              )}
            </div>

            {/* Review body composer */}
            <PrMentionComposer
              cwd={projectCwd}
              participants={dashboard?.pullRequest.participants ?? []}
              placeholder="Write a review summary or use @ to notify collaborators."
              rows={2}
              value={reviewBody}
              onChange={(value) => {
                onReviewBodyChange(value);
                if (value.trim().length > 0 && !actionRailExpanded) {
                  setActionRailExpanded(true);
                }
              }}
            />

            {/* Submit buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {approveDisabled
                  ? "Approval is gated until blockers are cleared."
                  : "Approval is available once your summary is ready."}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  disabled={isSubmitting}
                  onClick={() => onSubmitReview("COMMENT")}
                  size="sm"
                  variant="outline"
                >
                  <MessageSquareIcon className="size-3.5" />
                  Comment
                </Button>
                <Button
                  disabled={approveDisabled}
                  onClick={() => onSubmitReview("APPROVE")}
                  size="sm"
                  variant="secondary"
                >
                  <CheckCircle2Icon className="size-3.5" />
                  Approve
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={() => onSubmitReview("REQUEST_CHANGES")}
                  size="sm"
                  variant={requestChangesVariant}
                >
                  <AlertTriangleIcon className="size-3.5" />
                  Request changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
