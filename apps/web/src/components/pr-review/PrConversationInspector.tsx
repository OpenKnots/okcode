import type { NativeApi, PrAgentReviewResult, PrConflictAnalysis, PrReviewConfig } from "@okcode/contracts";
import { useState } from "react";
import {
  BookOpenCheckIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import { SectionHeading } from "~/components/review/ReviewChrome";
import { projectLabel } from "~/components/review/reviewUtils";
import type { Project } from "~/types";
import type { InspectorTab } from "./pr-review-utils";
import { PrAgentFindingsPanel } from "./PrAgentFindingsPanel";
import { PrThreadCard } from "./PrThreadCard";
import { PrWorkflowPanel } from "./PrWorkflowPanel";
import { PrWorkflowProgressBar } from "./PrWorkflowProgressBar";
import { PrUserHoverCard } from "./PrUserHoverCard";
import { requiredChecksState } from "./pr-review-utils";
import { cn } from "~/lib/utils";

export function PrConversationInspector({
  project,
  dashboard,
  config,
  conflicts,
  agentResult,
  onStartAgentReview,
  isStartingAgentReview,
  workflowId,
  onWorkflowIdChange,
  selectedFilePath,
  selectedThreadId,
  onSelectFilePath,
  onSelectThreadId,
  onResolveThread,
  onReplyToThread,
  onRunStep,
  onCreateThread,
  onOpenRules,
  onOpenWorkflow,
  onOpenConflictDrawer,
}: {
  project: Project;
  dashboard: Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;
  config: PrReviewConfig | undefined;
  conflicts: PrConflictAnalysis | undefined;
  agentResult: PrAgentReviewResult | null | undefined;
  onStartAgentReview: () => void;
  isStartingAgentReview: boolean;
  workflowId: string | null;
  onWorkflowIdChange: (workflowId: string) => void;
  selectedFilePath: string | null;
  selectedThreadId: string | null;
  onSelectFilePath: (path: string | null) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onResolveThread: (threadId: string, nextAction: "resolve" | "unresolve") => Promise<void>;
  onReplyToThread: (threadId: string, body: string) => Promise<void>;
  onRunStep: (stepId: string, requiresConfirmation: boolean, title: string) => Promise<void>;
  onCreateThread: (input: { path: string; line: number; body: string }) => Promise<void>;
  onOpenRules: () => void;
  onOpenWorkflow: (relativePath: string) => void;
  onOpenConflictDrawer: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("threads");

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

  // Resolve workflow for progress bar
  const activeWorkflow = config?.workflows.find((w) => w.id === (workflowId ?? config.defaultWorkflowId));

  // Rule status computation
  const checksState = config
    ? requiredChecksState(config, dashboard.pullRequest.statusChecks)
    : { failing: [] as string[], pending: [] as string[] };

  const findingsCount = agentResult?.findings?.length ?? 0;

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

        {/* Workflow progress bar — always visible when workflow has steps */}
        {activeWorkflow && activeWorkflow.steps.length >= 2 ? (
          <div className="mt-3">
            <PrWorkflowProgressBar
              steps={dashboard.workflowSteps.map((ws) => ({
                stepId: ws.stepId,
                status: ws.status,
                detail: ws.detail,
              }))}
              stepDefinitions={activeWorkflow.steps.map((s) => ({
                id: s.id,
                title: s.title,
                kind: s.kind,
              }))}
              onStepClick={() => setTab("workflow")}
            />
          </div>
        ) : null}

        <ToggleGroup
          className="mt-4"
          size="xs"
          value={[tab]}
          variant="outline"
          onValueChange={(values) => {
            const nextValue = values[values.length - 1];
            if (
              nextValue === "ai" ||
              nextValue === "threads" ||
              nextValue === "workflow" ||
              nextValue === "rules" ||
              nextValue === "people"
            ) {
              setTab(nextValue);
            }
          }}
        >
          <Toggle value="ai">
            <SparklesIcon className="size-3.5" />
            AI
            {findingsCount > 0 ? (
              <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-indigo-500/20 text-[9px] font-bold text-indigo-400">
                {findingsCount > 9 ? "9+" : findingsCount}
              </span>
            ) : null}
          </Toggle>
          <Toggle value="threads">
            <MessageSquareIcon className="size-3.5" />
            Threads
          </Toggle>
          <Toggle value="workflow">
            <SparklesIcon className="size-3.5" />
            Workflow
          </Toggle>
          <Toggle value="rules">
            <BookOpenCheckIcon className="size-3.5" />
            Rules
          </Toggle>
          <Toggle value="people">
            <UsersIcon className="size-3.5" />
            People
          </Toggle>
        </ToggleGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4">
          {/* ── AI Findings Tab ──────────────────────────────────── */}
          {tab === "ai" ? (
            <PrAgentFindingsPanel
              agentResult={agentResult}
              onSelectFile={(path) => onSelectFilePath(path)}
              onCreateThread={onCreateThread}
              onStartReview={onStartAgentReview}
              isStarting={isStartingAgentReview}
            />
          ) : null}

          {/* ── Threads Tab ──────────────────────────────────────── */}
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
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/18 px-4 py-8 text-center">
                  <MessageSquareIcon className="size-8 text-muted-foreground/40" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      No review threads yet
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
                      Start a conversation by clicking any line in the diff, or
                      let the AI review surface discussion points.
                    </p>
                  </div>
                  {!agentResult || agentResult.status === "idle" ? (
                    <Button
                      onClick={onStartAgentReview}
                      disabled={isStartingAgentReview}
                      size="xs"
                      variant="outline"
                    >
                      <SparklesIcon className="size-3.5" />
                      Start AI Review
                    </Button>
                  ) : null}
                </div>
              ) : (
                visibleThreads.map((thread) => (
                  <PrThreadCard
                    dashboard={dashboard}
                    key={thread.id}
                    onReplyToThread={onReplyToThread}
                    onResolveThread={onResolveThread}
                    onSelectFilePath={onSelectFilePath}
                    onSelectThreadId={onSelectThreadId}
                    project={project}
                    selectedThreadId={selectedThreadId}
                    thread={thread}
                  />
                ))
              )}
            </>
          ) : null}

          {/* ── Workflow Tab ──────────────────────────────────────── */}
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

          {/* ── Rules Tab ────────────────────────────────────────── */}
          {tab === "rules" ? (
            <div className="space-y-4">
              {/* Blocking rules */}
              <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Blocking Rules
                  </p>
                  <Button onClick={onOpenRules} size="xs" variant="ghost">
                    Edit
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {config?.rules.blockingRules && config.rules.blockingRules.length > 0 ? (
                    config.rules.blockingRules.map((rule) => (
                      <RuleStatusRow key={rule.id} title={rule.title} description={rule.description} passed={true} />
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">No blocking rules configured.</p>
                  )}
                  {/* Required checks */}
                  {config?.rules.requiredChecks.map((checkName) => {
                    const isFailing = checksState.failing.includes(checkName);
                    const isPending = checksState.pending.includes(checkName);
                    return (
                      <RuleStatusRow
                        key={`check:${checkName}`}
                        title={`Required check: ${checkName}`}
                        description={isFailing ? "Failing" : isPending ? "Pending" : "Passing"}
                        passed={!isFailing && !isPending}
                      />
                    );
                  })}
                  {/* Conflict status */}
                  {conflicts ? (
                    <RuleStatusRow
                      title="Clean merge"
                      description={
                        conflicts.status === "clean"
                          ? "No merge conflicts"
                          : conflicts.status === "conflicted"
                            ? "Merge conflicts detected"
                            : "Status unavailable"
                      }
                      passed={conflicts.status === "clean"}
                    />
                  ) : null}
                  {/* Required approvals */}
                  {config && config.rules.requiredApprovals > 0 ? (
                    <RuleStatusRow
                      title={`Required approvals: ${config.rules.requiredApprovals}`}
                      description={`${dashboard.pullRequest.recentReviews.filter((r) => r.state === "APPROVED").length} of ${config.rules.requiredApprovals} received`}
                      passed={
                        dashboard.pullRequest.recentReviews.filter((r) => r.state === "APPROVED")
                          .length >= config.rules.requiredApprovals
                      }
                    />
                  ) : null}
                </div>
              </div>

              {/* Advisory rules */}
              {config?.rules.advisoryRules && config.rules.advisoryRules.length > 0 ? (
                <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Advisory Rules
                  </p>
                  <div className="mt-4 space-y-3">
                    {config.rules.advisoryRules.map((rule) => (
                      <div key={rule.id}>
                        <p className="text-sm font-medium text-foreground">{rule.title}</p>
                        {rule.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{rule.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Config info */}
              <div className="rounded-2xl border border-border/70 bg-muted/18 px-3 py-3 text-xs text-muted-foreground">
                <span className="font-medium">Source:</span>{" "}
                {config?.source === "repo"
                  ? "Repository config"
                  : config?.source === "localProfile"
                    ? "Local profile"
                    : "Default"}{" "}
                &middot;{" "}
                <span className="font-medium">Merge policy:</span>{" "}
                {config?.rules.mergePolicy ?? "N/A"}
              </div>
            </div>
          ) : null}

          {/* ── People Tab ───────────────────────────────────────── */}
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
                        <p className="truncate text-xs text-muted-foreground">
                          {participant.role}
                        </p>
                      </div>
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

// ── Rule Status Row ─────────────────────────────────────────────────

function RuleStatusRow({
  title,
  description,
  passed,
}: {
  title: string;
  description: string | null;
  passed: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px]",
          passed
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        )}
      >
        {passed ? "✓" : "!"}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
