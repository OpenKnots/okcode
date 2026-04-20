import type { PrAgentFinding, PrAgentReviewResult } from "@okcode/contracts";
import { useState } from "react";
import {
  AlertTriangleIcon,
  FileCode2Icon,
  InfoIcon,
  MessageSquarePlusIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";

const SEVERITY_ORDER: Record<PrAgentFinding["severity"], number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function PrAgentFindingsPanel({
  agentResult,
  onSelectFile,
  onCreateThread,
  onStartReview,
  isStarting,
}: {
  agentResult: PrAgentReviewResult | null | undefined;
  onSelectFile: (path: string) => void;
  onCreateThread: (input: { path: string; line: number; body: string }) => Promise<void>;
  onStartReview: (() => void) | undefined;
  isStarting: boolean | undefined;
}) {
  const status = agentResult?.status ?? "idle";

  // ── Idle / No review yet ─────────────────────────────────────────
  if (!agentResult || status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/40">
          <SparklesIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No AI review yet</p>
          <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
            AI review is unavailable in this release.
          </p>
        </div>
        {onStartReview ? (
          <Button disabled={isStarting} onClick={onStartReview} size="sm" variant="outline">
            {isStarting ? <Spinner className="size-3.5" /> : <SparklesIcon className="size-3.5" />}
            Start AI Review
          </Button>
        ) : null}
      </div>
    );
  }

  // ── Running ──────────────────────────────────────────────────────
  if (status === "queued" || status === "running") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Agent review in progress...</p>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10">
          <AlertTriangleIcon className="size-5 text-rose-500" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Review failed</p>
          <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
            AI review is unavailable in this release.
          </p>
        </div>
        {onStartReview ? (
          <Button disabled={isStarting} onClick={onStartReview} size="sm" variant="outline">
            {isStarting ? <Spinner className="size-3.5" /> : <SparklesIcon className="size-3.5" />}
            Retry Review
          </Button>
        ) : null}
      </div>
    );
  }

  // ── Complete ─────────────────────────────────────────────────────
  const risk = agentResult.riskAssessment;
  const findings = [...agentResult.findings].toSorted(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Risk assessment
        </p>
        {risk ? (
          <div className="mt-3 flex items-start gap-3">
            <RiskTierBadge tier={risk.tier} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium capitalize text-foreground">{risk.tier} risk</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{risk.rationale}</p>
            </div>
          </div>
        ) : null}
        {agentResult.summary ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {agentResult.summary}
          </p>
        ) : null}
      </div>

      {/* Findings list */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Findings ({findings.length})
        </p>
        {findings.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border/70 bg-muted/18 px-4 py-6 text-center text-sm text-muted-foreground">
            No findings. The review did not surface any issues.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {findings.map((finding) => (
              <FindingCard
                finding={finding}
                key={finding.id}
                onCreateThread={onCreateThread}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>

      {/* Suggested focus */}
      {agentResult.suggestedFocus.length > 0 ? (
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Suggested focus
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {agentResult.suggestedFocus.map((filePath) => (
              <button
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                key={filePath}
                onClick={() => onSelectFile(filePath)}
                title={filePath}
                type="button"
              >
                <FileCode2Icon className="size-3 shrink-0 opacity-60" />
                <span className="truncate max-w-[200px]">{filePath}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Finding card ─────────────────────────────────────────────────────

function FindingCard({
  finding,
  onSelectFile,
  onCreateThread,
}: {
  finding: PrAgentFinding;
  onSelectFile: (path: string) => void;
  onCreateThread: (input: { path: string; line: number; body: string }) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const hasLocation = finding.path != null && finding.line != null;

  async function handleCreateThread() {
    if (!finding.path || !finding.line) return;
    setIsCreating(true);
    try {
      await onCreateThread({
        path: finding.path,
        line: finding.line,
        body: `**${finding.title}** (${finding.severity}/${finding.category})\n\n${finding.detail}`,
      });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-background/92 p-3">
      <div className="flex items-start gap-2.5">
        <SeverityIcon severity={finding.severity} />
        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Header row: title + category */}
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm font-medium text-foreground leading-snug">
              {finding.title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                "bg-muted/50 text-muted-foreground",
              )}
            >
              {finding.category}
            </span>
          </div>

          {/* File:line link */}
          {hasLocation ? (
            <button
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onSelectFile(finding.path!)}
              type="button"
            >
              <FileCode2Icon className="size-3 shrink-0 opacity-60" />
              <span className="truncate max-w-[200px]">
                {finding.path}:{finding.line}
              </span>
            </button>
          ) : null}

          {/* Detail toggle */}
          {finding.detail ? (
            <>
              <button
                className="text-[11px] text-muted-foreground/80 transition-colors hover:text-foreground"
                onClick={() => setExpanded((prev) => !prev)}
                type="button"
              >
                {expanded ? "Hide detail" : "Show detail"}
              </button>
              {expanded ? (
                <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {finding.detail}
                </p>
              ) : null}
            </>
          ) : null}

          {/* Create thread */}
          {hasLocation ? (
            <div className="pt-1">
              <Button
                disabled={isCreating}
                onClick={() => void handleCreateThread()}
                size="xs"
                variant="ghost"
              >
                {isCreating ? (
                  <Spinner className="size-3" />
                ) : (
                  <MessageSquarePlusIcon className="size-3" />
                )}
                Create thread
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function SeverityIcon({ severity }: { severity: PrAgentFinding["severity"] }) {
  const shared = "mt-0.5 size-4 shrink-0";
  switch (severity) {
    case "critical":
      return <AlertTriangleIcon className={cn(shared, "text-rose-500")} />;
    case "warning":
      return <AlertTriangleIcon className={cn(shared, "text-amber-500")} />;
    case "info":
      return <InfoIcon className={cn(shared, "text-sky-500")} />;
  }
}

function RiskTierBadge({ tier }: { tier: "low" | "medium" | "high" }) {
  return (
    <span
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
        tier === "low" && "bg-emerald-500/15",
        tier === "medium" && "bg-amber-500/15",
        tier === "high" && "bg-rose-500/15",
      )}
      aria-label={`Risk: ${tier}`}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          tier === "low" && "bg-emerald-500",
          tier === "medium" && "bg-amber-500",
          tier === "high" && "bg-rose-500",
        )}
      />
    </span>
  );
}
