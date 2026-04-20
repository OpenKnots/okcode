import { useQueryClient } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import { startTransition, useEffect, useEffectEvent, useMemo, useRef } from "react";
import { PanelRightIcon } from "lucide-react";

import { useAppSettings } from "~/appSettings";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { invalidatePrReviewQueries } from "~/lib/prReviewReactQuery";
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
import { usePrReviewStore } from "~/prReviewStore";

import { PrListRail } from "./PrListRail";
import { PrWorkspace } from "./PrWorkspace";
import { PrConversationInspector } from "./PrConversationInspector";
import { PrConflictDrawer } from "./PrConflictDrawer";
import { PrInspectorPanel } from "./PrInspectorPanel";
import { PrActionRail } from "./PrActionRail";
import { PrKeyboardShortcutOverlay } from "./PrKeyboardShortcutOverlay";
import { usePrReviewQueries } from "./usePrReviewQueries";
import { usePrReviewMutations } from "./usePrReviewMutations";
import { usePrReviewKeyboard } from "./usePrReviewKeyboard";
import {
  openPathInEditor,
  requiredChecksState,
  resolveRequestChangesButtonVariant,
} from "./pr-review-utils";

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
  const { settings } = useAppSettings();
  const isInspectorSheet = useMediaQuery("max-xl");
  const isWideScreen = useMediaQuery("min-2xl");
  const reviewComposerRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Store ─────────────────────────────────────────────────────────
  const store = usePrReviewStore();
  const deferredSearchQuery = useDeferredValue(store.searchQuery);

  // ── Queries & Mutations ───────────────────────────────────────────
  const {
    configQuery,
    dashboardQuery,
    patchQuery,
    conflictQuery,
    pullRequestsQuery,
    agentReviewQuery,
  } = usePrReviewQueries(project.cwd);

  const mutations = usePrReviewMutations(project.cwd);

  // ── Derived data ──────────────────────────────────────────────────
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

  const patchFiles = useMemo(
    () => patchQuery.data?.files ?? [],
    [patchQuery.data?.files],
  );

  const filePaths = useMemo(
    () => patchFiles.map((f) => f.path),
    [patchFiles],
  );

  const checksSummary = configQuery.data
    ? requiredChecksState(configQuery.data, dashboardQuery.data?.pullRequest.statusChecks ?? [])
    : { failing: [] as string[], pending: [] as string[] };

  const blockingWorkflowSteps = useMemo(
    () =>
      (dashboardQuery.data?.workflowSteps ?? []).filter(
        (step) => step.status === "blocked" || step.status === "failed",
      ),
    [dashboardQuery.data?.workflowSteps],
  );

  const approvalBlockers = useMemo(
    () => [
      ...(conflictQuery.data?.status === "conflicted" ? ["Merge conflicts must be resolved"] : []),
      ...checksSummary.failing.map((name) => `Failing check: ${name}`),
      ...checksSummary.pending.map((name) => `Pending check: ${name}`),
      ...blockingWorkflowSteps.map(
        (step) => `Workflow blocked: ${step.detail ?? step.stepId}`,
      ),
    ],
    [conflictQuery.data?.status, checksSummary.failing, checksSummary.pending, blockingWorkflowSteps],
  );

  // ── Effects: Auto-select, sync, auto-expand ───────────────────────

  // Auto-expand panels on wide screens
  useEffect(() => {
    if (isWideScreen) {
      store.setLeftRailCollapsed(false);
      if (!store.userExplicitlyOpenedInspector) {
        store.setInspectorCollapsed(false);
      }
    }
  }, [isWideScreen]);

  // Auto-select first PR
  useEffect(() => {
    const nextDefault =
      filteredPullRequests.find((pr) => pr.number === store.selectedPrNumber) ??
      filteredPullRequests[0] ??
      null;
    if (!nextDefault) {
      if (store.selectedPrNumber !== null) store.selectPr(null);
      return;
    }
    if (store.selectedPrNumber !== nextDefault.number) {
      store.selectPr(nextDefault.number);
    }
  }, [filteredPullRequests, store.selectedPrNumber]);

  // Reset file/thread when PR changes
  useEffect(() => {
    store.resetForNewPr();
  }, [store.selectedPrNumber]);

  // Auto-select first file
  useEffect(() => {
    const files = patchQuery.data?.files ?? [];
    if (files.length === 0) {
      store.selectFile(null);
      return;
    }
    if (
      !store.selectedFilePath ||
      !files.some((file) => file.path === store.selectedFilePath)
    ) {
      store.selectFile(files[0]?.path ?? null);
    }
  }, [patchQuery.data?.files, store.selectedFilePath]);

  // Auto-select workflow
  useEffect(() => {
    if (!configQuery.data) return;
    const current = store.workflowId;
    if (current && configQuery.data.workflows.some((w) => w.id === current)) return;
    store.setWorkflowId(configQuery.data.defaultWorkflowId);
  }, [configQuery.data]);

  // Sync agent review result into store
  useEffect(() => {
    if (agentReviewQuery.data) {
      store.setAgentReviewResult(agentReviewQuery.data);
    }
  }, [agentReviewQuery.data]);

  // Native API event subscriptions
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

  // ── Keyboard ──────────────────────────────────────────────────────
  usePrReviewKeyboard({
    enabled: true,
    filePaths,
    fileCount: patchFiles.length,
    onStartAgentReview: () => {
      void mutations.startAgentReviewMutation.mutateAsync({
        workflowId: store.workflowId ?? undefined,
      });
    },
    reviewComposerRef,
  });

  // ── Inspector props ───────────────────────────────────────────────
  const inspectorProps = {
    config: configQuery.data,
    conflicts: conflictQuery.data,
    dashboard: dashboardQuery.data,
    agentResult: agentReviewQuery.data,
    onStartAgentReview: () => {
      void mutations.startAgentReviewMutation.mutateAsync({
        workflowId: store.workflowId ?? undefined,
      });
    },
    isStartingAgentReview: mutations.startAgentReviewMutation.isPending,
    onOpenConflictDrawer: () => store.setConflictDrawerOpen(true),
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
      await mutations.replyToThreadMutation.mutateAsync({ threadId, body });
    },
    onResolveThread: async (threadId: string, nextAction: "resolve" | "unresolve") => {
      await mutations.resolveThreadMutation.mutateAsync({ threadId, action: nextAction });
    },
    onRunStep: async (stepId: string, requiresConfirmation: boolean, title: string) => {
      if (requiresConfirmation) {
        const confirmed = await ensureNativeApi().dialogs.confirm(
          `Run workflow step "${title}"?`,
        );
        if (!confirmed) return;
      }
      await mutations.runWorkflowStepMutation.mutateAsync(stepId);
    },
    onCreateThread: async (input: { path: string; line: number; body: string }) => {
      await mutations.addThreadMutation.mutateAsync(input);
    },
    onSelectFilePath: store.selectFile,
    onSelectThreadId: store.selectThread,
    onWorkflowIdChange: store.setWorkflowId,
    project,
    selectedFilePath: store.selectedFilePath,
    selectedThreadId: store.selectedThreadId,
    workflowId: store.workflowId,
  } as const;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {/* Main content area — flexbox layout with collapsible panels */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left rail — collapsible */}
        <PrListRail
          collapsed={store.leftRailCollapsed}
          isLoading={pullRequestsQuery.isLoading || pullRequestsQuery.isFetching}
          onProjectChange={onProjectChange}
          onPullRequestStateChange={store.setPullRequestState}
          onSearchQueryChange={store.setSearchQuery}
          onSelectPr={(pullRequest) => {
            startTransition(() => {
              store.selectPr(pullRequest.number);
            });
          }}
          onToggleCollapsed={store.toggleLeftRail}
          projects={projects}
          pullRequestState={store.pullRequestState}
          pullRequests={filteredPullRequests}
          searchQuery={store.searchQuery}
          selectedPrNumber={store.selectedPrNumber}
          selectedProjectId={selectedProjectId}
        />

        {/* Center — diff workspace (takes remaining space) */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {isInspectorSheet ? (
            <div className="flex h-10 items-center justify-end border-b border-border/70 px-4">
              <Button
                onClick={() => store.setInspectorOpen(true)}
                size="sm"
                variant="outline"
              >
                <PanelRightIcon className="size-3.5" />
                Inspector
              </Button>
            </div>
          ) : null}
          <PrWorkspace
            dashboard={dashboardQuery.data}
            agentResult={agentReviewQuery.data}
            onStartAgentReview={() => {
              void mutations.startAgentReviewMutation.mutateAsync({
                workflowId: store.workflowId ?? undefined,
              });
            }}
            isStartingAgentReview={mutations.startAgentReviewMutation.isPending}
            onCreateThread={async (input) => {
              await mutations.addThreadMutation.mutateAsync(input);
            }}
            onSelectFilePath={store.selectFile}
            onSelectThreadId={(threadId) => {
              store.selectThread(threadId);
              // Auto-expand inspector when clicking a thread
              if (threadId && store.inspectorCollapsed && !isInspectorSheet) {
                store.expandInspectorToTab("threads");
              }
            }}
            onToggleFileReviewed={store.toggleFileReviewed}
            patch={patchQuery.data?.combinedPatch ?? null}
            project={project}
            reviewedFiles={store.reviewedFiles}
            selectedFilePath={store.selectedFilePath}
            selectedThreadId={store.selectedThreadId}
            approvalBlockers={approvalBlockers}
            onOpenConflictDrawer={() => store.setConflictDrawerOpen(true)}
          />
        </main>

        {/* Right inspector — collapsible (desktop xl+ only) */}
        {!isInspectorSheet ? (
          <PrInspectorPanel
            collapsed={store.inspectorCollapsed}
            hasBlockedWorkflow={blockingWorkflowSteps.length > 0}
            hasAgentFindings={
              (agentReviewQuery.data?.findings?.length ?? 0) > 0
            }
            agentReviewRunning={
              agentReviewQuery.data?.status === "running" ||
              agentReviewQuery.data?.status === "queued"
            }
            onExpandToTab={(tab) => {
              store.expandInspectorToTab(tab);
            }}
            onToggleCollapsed={store.toggleInspector}
            unresolvedThreadCount={
              dashboardQuery.data?.pullRequest.unresolvedThreadCount ?? 0
            }
          >
            <PrConversationInspector {...inspectorProps} />
          </PrInspectorPanel>
        ) : null}
      </div>

      {/* Action rail */}
      <PrActionRail
        projectCwd={project.cwd}
        dashboard={dashboardQuery.data}
        config={configQuery.data}
        conflicts={conflictQuery.data}
        agentResult={agentReviewQuery.data}
        reviewBody={store.reviewBody}
        onReviewBodyChange={(value) => {
          store.setReviewBody(value);
        }}
        onSubmitReview={(event) => {
          void mutations.submitReviewMutation.mutateAsync({
            event,
            body: store.reviewBody.trim(),
          });
        }}
        isSubmitting={mutations.submitReviewMutation.isPending}
        requestChangesVariant={resolveRequestChangesButtonVariant(
          settings.prReviewRequestChangesTone,
        )}
        reviewComposerRef={reviewComposerRef}
      />

      {/* Inspector sheet (mobile/tablet) */}
      {isInspectorSheet ? (
        <Sheet
          onOpenChange={store.setInspectorOpen}
          open={store.inspectorOpen}
        >
          <SheetPopup side="right" variant="inset">
            <SheetHeader>
              <SheetTitle>Inspector</SheetTitle>
              <SheetDescription>
                Conversations, repo workflow, and participant context for the
                focused pull request.
              </SheetDescription>
            </SheetHeader>
            <SheetPanel className="p-0">
              <PrConversationInspector
                {...inspectorProps}
                onOpenConflictDrawer={() => {
                  store.setInspectorOpen(false);
                  store.setConflictDrawerOpen(true);
                }}
              />
            </SheetPanel>
          </SheetPopup>
        </Sheet>
      ) : null}

      <PrConflictDrawer
        conflictAnalysis={conflictQuery.data}
        onApplyResolution={(candidateId) =>
          mutations.applyConflictResolutionMutation
            .mutateAsync(candidateId)
            .then(() => undefined)
        }
        onOpenChange={store.setConflictDrawerOpen}
        open={store.conflictDrawerOpen}
        project={project}
      />

      <PrKeyboardShortcutOverlay
        open={store.shortcutOverlayOpen}
        onOpenChange={store.setShortcutOverlayOpen}
      />
    </>
  );
}
