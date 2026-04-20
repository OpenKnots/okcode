import { useState } from "react";
import type { PrAgentReviewResult } from "@okcode/contracts";
import { SparklesIcon, XIcon, AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";

export function PrAgentReviewBanner({
  agentStatus,
  onStartReview,
  onSelectFile,
  onOpenFindings,
  isStarting,
  fileCount,
}: {
  agentStatus: PrAgentReviewResult | null | undefined;
  onStartReview: () => void;
  onSelectFile: (path: string) => void;
  onOpenFindings: () => void;
  isStarting: boolean;
  fileCount: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const status = agentStatus?.status ?? "idle";

  // ── Idle ──────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div className="flex items-center gap-3 border-b border-border/70 bg-muted/18 px-4 py-2">
        <Button
          disabled={isStarting}
          onClick={onStartReview}
          size="xs"
          variant="outline"
        >
          {isStarting ? (
            <Spinner className="size-3.5" />
          ) : (
            <SparklesIcon className="size-3.5" />
          )}
          Start AI Review
        </Button>
        <span className="text-xs text-muted-foreground">
          Get automated findings, risk assessment, and focus suggestions
        </span>
      </div>
    );
  }

  // ── Running ──────────────────────────────────────────────────────
  if (status === "queued" || status === "running") {
    return (
      <div className="flex items-center gap-3 border-b border-border/70 bg-muted/18 px-4 py-2 animate-pulse">
        <Spinner className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Analyzing {fileCount} {fileCount === 1 ? "file" : "files"}...
        </span>
      </div>
    );
  }

  // ── Failed ───────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="flex items-center gap-3 border-b border-border/70 bg-rose-500/8 px-4 py-2">
        <AlertTriangleIcon className="size-4 shrink-0 text-rose-500" />
        <span className="text-xs text-rose-700 dark:text-rose-300">
          AI review failed.
        </span>
        <Button
          disabled={isStarting}
          onClick={onStartReview}
          size="xs"
          variant="outline"
        >
          {isStarting ? (
            <Spinner className="size-3.5" />
          ) : (
            <SparklesIcon className="size-3.5" />
          )}
          Retry
        </Button>
      </div>
    );
  }

  // ── Complete (dismissed) ─────────────────────────────────────────
  if (dismissed) {
    return (
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/18 px-4 py-1.5">
        <button
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          onClick={() => setDismissed(false)}
          type="button"
        >
          <CheckCircle2Icon className="size-3 text-emerald-500" />
          AI review complete
        </button>
      </div>
    );
  }

  // ── Complete (expanded) ──────────────────────────────────────────
  const risk = agentStatus?.riskAssessment;
  const findings = agentStatus?.findings ?? [];
  const suggestedFocus = agentStatus?.suggestedFocus ?? [];
  const findingCount = findings.length;

  return (
    <div className="flex items-start gap-3 border-b border-border/70 bg-muted/18 px-4 py-2.5">
      {/* Risk tier dot */}
      <RiskTierBadge tier={risk?.tier ?? null} />

      {/* Summary + meta */}
      <div className="min-w-0 flex-1 space-y-1.5">
        {agentStatus?.summary ? (
          <p className="text-xs leading-relaxed text-foreground line-clamp-2">
            {agentStatus.summary}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Findings chip */}
          {findingCount > 0 ? (
            <button
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                "border border-border/70 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
              )}
              onClick={onOpenFindings}
              type="button"
            >
              {findingCount} {findingCount === 1 ? "finding" : "findings"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <CheckCircle2Icon className="size-3 text-emerald-500" />
              No findings
            </span>
          )}

          {/* Suggested focus chips */}
          {suggestedFocus.map((filePath) => (
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors border border-border/70 bg-muted/40 hover:bg-muted/70 hover:text-foreground truncate max-w-[160px]"
              key={filePath}
              onClick={() => onSelectFile(filePath)}
              title={filePath}
              type="button"
            >
              {basename(filePath)}
            </button>
          ))}
        </div>
      </div>

      {/* Dismiss button */}
      <Button
        className="shrink-0"
        onClick={() => setDismissed(true)}
        size="icon-xs"
        variant="ghost"
        aria-label="Dismiss AI review banner"
      >
        <XIcon className="size-3.5" />
      </Button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function RiskTierBadge({ tier }: { tier: "low" | "medium" | "high" | null }) {
  return (
    <span
      className={cn(
        "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        tier === "low" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        tier === "medium" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        tier === "high" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
        !tier && "bg-muted/40 text-muted-foreground",
      )}
      aria-label={tier ? `Risk: ${tier}` : "Risk unknown"}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          tier === "low" && "bg-emerald-500",
          tier === "medium" && "bg-amber-500",
          tier === "high" && "bg-rose-500",
          !tier && "bg-muted-foreground/50",
        )}
      />
    </span>
  );
}

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}
