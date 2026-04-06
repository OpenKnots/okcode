import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useDeferredValue } from "react";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronUpIcon,
  MessageSquareIcon,
  PanelRightIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";

import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { gitListPullRequestsQueryOptions } from "~/lib/gitReactQuery";
import {
  invalidatePrReviewQueries,
  prReviewConfigQueryOptions,
  prReviewConflictsQueryOptions,
  prReviewDashboardQueryOptions,
  prReviewPatchQueryOptions,
} from "~/lib/prReviewReactQuery";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { joinPath } from "~/components/review/reviewUtils";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet";
import type { Project } from "~/types";

import { PrListRail } from "./PrListRail";
import { PrWorkspace } from "./PrWorkspace";
import { PrConversationInspector } from "./PrConversationInspector";
import { PrConflictDrawer } from "./PrConflictDrawer";
import { PrInspectorPanel } from "./PrInspectorPanel";
import { PrMentionComposer } from "./PrMentionComposer";
import {
  type PullRequestState,
  REVIEWED_FILES_SCHEMA,
  TEXT_DRAFT_SCHEMA,
  requiredChecksState,
  openPathInEditor,
} from "./pr-review-utils";

const BOOL_SCHEMA = Schema.Boolean;

function resolvePrReviewConfigPath(projectCwd: string, configPath: string): string {
  if (/^(?:[A-Za-z]:[\\/]|\/)/.test(configPath)) {
    return configPath;
  }
  return joinPath(projectCwd, configPath);
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
  const isWideScreen = useMediaQuery("min-2xl");
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
  const reviewedFilesKey = `okcode:pr-review:reviewed-files:${project.id}:${selectedPrNumber ?? "none"}`;
  const [reviewedFiles, setReviewedFiles] = useLocalStorage<readonly string[], unknown>(
    reviewedFilesKey,
    [],
    REVIEWED_FILES_SCHEMA,
  );

  // --- Collapsible panel state ---
  const [leftRailCollapsed, setLeftRailCollapsed] = useLocalStorage(
    "okcode:pr-review:left-rail-collapsed",
    false,
    BOOL_SCHEMA,
  );
  const [inspectorCollapsed, setInspectorCollapsed] = useLocalStorage(
    "okcode:pr-review:inspector-collapsed",
    true,
    BOOL_SCHEMA,
  );
  const [actionRailExpanded, setActionRailExpanded] = useState(false);
  const userExplicitlyOpenedInspector = useRef(false);

  // Auto-expand panels on wide screens
  useEffect(() => {
    if (isWideScreen) {
      setLeftRailCollapsed(false);
      if (!userExplicitlyOpenedInspector.current) {
        setInspectorCollapsed(false);
      }
    }
  }, [isWideScreen, setLeftRailCollapsed, setInspectorCollapsed]);

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
  }, []);

  // Keyboard shortcuts: [ toggles left rail, ] toggles right inspector
  const handlePanelKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      return;
    }
    if (event.key === "[" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setLeftRailCollapsed(!leftRailCollapsed);
    }
    if (event.key === "]" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (isInspectorSheet) return;
      const next = !inspectorCollapsed;
      if (!next) userExplicitlyOpenedInspector.current = true;
      setInspectorCollapsed(next);
    }
  });

  useEffect(() => {
    document.addEventListener("keydown", handlePanelKeyDown);
    return () => document.removeEventListener("keydown", handlePanelKeyDown);
  }, []);

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

  const checksSummary = configQuery.data
    ? requiredChecksState(configQuery.data, dashboardQuery.data?.pullRequest.statusChecks ?? [])
    : { failing: [] as string[], pending: [] as string[] };
  const blockingWorkflowStepsComputed = (dashboardQuery.data?.workflowSteps ?? []).filter(
    (step) => step.status === "blocked" || step.status === "failed",
  );

  // Inspector props helper
  const inspectorProps = {
    config: configQuery.data,
    conflicts: conflictQuery.data,
    dashboard: dashboardQuery.data,
    onOpenConflictDrawer: () => setConflictDrawerOpen(true),
    onOpenRules: () => {
      if (!configQuery.data) return;
      void openPathInEditor(
        resolvePrReviewConfigPath(project.cwd, configQuery.data.rules.relativePath),
      );
    },
    onOpenWorkflow: (relativePath: string) => {
      void openPathInEditor(resolvePrReviewConfigPath(project.cwd, relativePath));
    },
    onReplyToThread: async (threadId: string, body: string) => {
      await replyToThreadMutation.mutateAsync({ threadId, body });
    },
    onResolveThread: async (threadId: string, nextAction: "resolve" | "unresolve") => {
      await resolveThreadMutation.mutateAsync({ threadId, action: nextAction });
    },
    onRunStep: async (stepId: string, requiresConfirmation: boolean, title: string) => {
      if (requiresConfirmation) {
        const confirmed = await ensureNativeApi().dialogs.confirm(`Run workflow step "${title}"?`);
        if (!confirmed) return;
      }
      await runWorkflowStepMutation.mutateAsync(stepId);
    },
    onSelectFilePath: setSelectedFilePath,
    onSelectThreadId: setSelectedThreadId,
    onWorkflowIdChange: setWorkflowId,
    project,
    selectedFilePath,
    selectedThreadId,
    workflowId,
  } as const;

  return (
    <>
      {/* Main content area — flexbox layout with collapsible panels */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left rail — collapsible */}
        <PrListRail
          collapsed={leftRailCollapsed}
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
          onToggleCollapsed={() => setLeftRailCollapsed(!leftRailCollapsed)}
          projects={projects}
          pullRequestState={pullRequestState}
          pullRequests={filteredPullRequests}
          searchQuery={searchQuery}
          selectedPrNumber={selectedPrNumber}
          selectedProjectId={selectedProjectId}
        />

        {/* Center — diff workspace (takes remaining space) */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {isInspectorSheet ? (
            <div className="flex h-10 items-center justify-end border-b border-border/70 px-4">
              <Button onClick={() => setInspectorOpen(true)} size="sm" variant="outline">
                <PanelRightIcon className="size-3.5" />
                Inspector
              </Button>
            </div>
          ) : null}
          <PrWorkspace
            dashboard={dashboardQuery.data}
            onCreateThread={async (input) => {
              await addThreadMutation.mutateAsync(input);
            }}
            onSelectFilePath={setSelectedFilePath}
            onSelectThreadId={(threadId) => {
              setSelectedThreadId(threadId);
              // Auto-expand inspector when clicking a thread
              if (threadId && inspectorCollapsed && !isInspectorSheet) {
                userExplicitlyOpenedInspector.current = true;
                setInspectorCollapsed(false);
              }
            }}
            onToggleFileReviewed={(path) => {
              setReviewedFiles((prev) => {
                const set = new Set(prev);
                if (set.has(path)) set.delete(path);
                else set.add(path);
                return [...set];
              });
            }}
            patch={patchQuery.data?.combinedPatch ?? null}
            project={project}
            reviewedFiles={reviewedFiles}
            selectedFilePath={selectedFilePath}
            selectedThreadId={selectedThreadId}
          />
        </main>

        {/* Right inspector — collapsible (desktop xl+ only) */}
        {!isInspectorSheet ? (
          <PrInspectorPanel
            collapsed={inspectorCollapsed}
            hasBlockedWorkflow={blockingWorkflowStepsComputed.length > 0}
            onExpandToTab={(_tab) => {
              userExplicitlyOpenedInspector.current = true;
              setInspectorCollapsed(false);
            }}
            onToggleCollapsed={() => {
              const next = !inspectorCollapsed;
              if (!next) userExplicitlyOpenedInspector.current = true;
              setInspectorCollapsed(next);
            }}
            unresolvedThreadCount={dashboardQuery.data?.pullRequest.unresolvedThreadCount ?? 0}
          >
            <PrConversationInspector {...inspectorProps} />
          </PrInspectorPanel>
        ) : null}
      </div>

      {/* Action rail — collapsible (Phase 6) */}
      <div className="border-t border-border/70 bg-background/96">
        {/* Collapsed bar */}
        <div
          className={cn(
            "flex h-10 items-center justify-between gap-3 px-4",
            actionRailExpanded && "border-b border-border/50",
          )}
        >
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Submit review</span>
            <span className="flex items-center gap-1">
              <MessageSquareIcon className="size-3" />
              {dashboardQuery.data?.pullRequest.unresolvedThreadCount ?? 0} open
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheckIcon className="size-3" />
              {conflictQuery.data?.status ?? "unknown"}
            </span>
            {blockingWorkflowStepsComputed.length > 0 ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <SparklesIcon className="size-3" />
                blocked
              </span>
            ) : null}
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
            <div className="px-4 py-3 space-y-3">
              <PrMentionComposer
                cwd={project.cwd}
                participants={dashboardQuery.data?.pullRequest.participants ?? []}
                placeholder="Write a review summary or use @ to notify collaborators."
                rows={2}
                value={reviewBody}
                onChange={(value) => {
                  setReviewBody(value);
                  // Auto-expand when user starts typing
                  if (value.trim().length > 0 && !actionRailExpanded) {
                    setActionRailExpanded(true);
                  }
                }}
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
      </div>

      {/* Inspector sheet (mobile/tablet) */}
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
                {...inspectorProps}
                onOpenConflictDrawer={() => {
                  setInspectorOpen(false);
                  setConflictDrawerOpen(true);
                }}
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
