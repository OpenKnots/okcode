import {
  GitActionFailure as GitActionFailureSchema,
  type GitActionFailure,
  type GitActionProgressEvent,
  type GitActionProgressPhase,
  type GitStackedAction,
  type GitStatusResult,
  type ThreadId,
} from "@okcode/contracts";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Schema } from "effect";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ArrowUpDownIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  CopyIcon,
  GitCommitIcon,
  InfoIcon,
  LinkIcon,
  SquareIcon,
} from "lucide-react";
import { GitHubIcon } from "./Icons";
import {
  buildGitActionProgressStages,
  buildMenuItems,
  buildPullRequestMenuItems,
  type GitActionIconName,
  type GitActionMenuItem,
  type GitQuickAction,
  type DefaultBranchConfirmableAction,
  requiresDefaultBranchConfirmation,
  resolveDefaultBranchActionDialogCopy,
  resolveGitFailureRetryLabel,
  resolveQuickAction,
  resolveSyncAction,
  buildHookFailureAgentPrompt,
  formatOpenPullRequestLabel,
  summarizeGitFailure,
  summarizeGitResult,
} from "./GitActionsControl.logic";
import { useAppSettings } from "~/appSettings";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Group, GroupSeparator } from "~/components/ui/group";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "~/components/ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Textarea } from "~/components/ui/textarea";
import { toastManager } from "~/components/ui/toast";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useFileViewNavigation } from "~/hooks/useFileViewNavigation";
import { openInPreferredEditor } from "~/editorPreferences";
import {
  gitBranchesQueryOptions,
  gitInitMutationOptions,
  gitMutationKeys,
  gitPullMutationOptions,
  gitRunStackedActionMutationOptions,
  gitStopActionMutationOptions,
  gitStatusQueryOptions,
  invalidateGitQueries,
} from "~/lib/gitReactQuery";
import { subscribeToGitPullRequestAction } from "~/lib/gitPullRequestAction";
import { newCommandId, newMessageId, randomUUID } from "~/lib/utils";
import { resolvePathLinkTarget } from "~/terminal-links";
import { readNativeApi } from "~/nativeApi";
import { isWsRequestError } from "~/wsTransport";

interface GitActionsControlProps {
  gitCwd: string | null;
  activeThreadId: ThreadId | null;
}

interface PendingDefaultBranchAction {
  action: DefaultBranchConfirmableAction;
  branchName: string;
  includesCommit: boolean;
  commitMessage?: string;
  featureBranchName?: string;
  forcePushOnlyProgress: boolean;
  onConfirmed?: () => void;
  filePaths?: string[];
}

type GitActionToastId = ReturnType<typeof toastManager.add>;

interface ActiveGitActionProgress {
  toastId: GitActionToastId;
  actionId: string;
  title: string;
  phaseStartedAtMs: number | null;
  hookStartedAtMs: number | null;
  hookName: string | null;
  lastOutputLine: string | null;
  currentPhaseLabel: string | null;
}

interface RunGitActionWithToastInput {
  action: GitStackedAction;
  commitMessage?: string;
  forcePushOnlyProgress?: boolean;
  onConfirmed?: () => void;
  skipDefaultBranchPrompt?: boolean;
  statusOverride?: GitStatusResult | null;
  featureBranch?: boolean;
  featureBranchName?: string;
  isDefaultBranchOverride?: boolean;
  progressToastId?: GitActionToastId;
  filePaths?: string[];
}

type RetryableGitActionInput = Pick<
  RunGitActionWithToastInput,
  | "action"
  | "commitMessage"
  | "featureBranch"
  | "featureBranchName"
  | "filePaths"
  | "forcePushOnlyProgress"
  | "skipDefaultBranchPrompt"
>;

interface GitActionFailureDialogState {
  failure: GitActionFailure;
  retryInput: RetryableGitActionInput;
}

type GitDialogAction = GitStackedAction;

const isGitActionFailure = Schema.is(GitActionFailureSchema);

function toRetryableGitActionInput(input: RunGitActionWithToastInput): RetryableGitActionInput {
  return {
    action: input.action,
    ...(input.commitMessage ? { commitMessage: input.commitMessage } : {}),
    ...(input.featureBranch ? { featureBranch: input.featureBranch } : {}),
    ...(input.featureBranchName ? { featureBranchName: input.featureBranchName } : {}),
    ...(input.filePaths ? { filePaths: input.filePaths } : {}),
    ...(input.forcePushOnlyProgress ? { forcePushOnlyProgress: input.forcePushOnlyProgress } : {}),
    ...(input.skipDefaultBranchPrompt
      ? { skipDefaultBranchPrompt: input.skipDefaultBranchPrompt }
      : {}),
  };
}

function formatGitActionFailurePhaseLabel(phase: GitActionProgressPhase | null): string | null {
  if (phase === "branch") return "Feature branch";
  if (phase === "commit") return "Commit";
  if (phase === "push") return "Push";
  if (phase === "pr") return "Pull request";
  return null;
}

function formatElapsedDescription(startedAtMs: number | null): string | undefined {
  if (startedAtMs === null) {
    return undefined;
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  if (elapsedSeconds < 60) {
    return `Running for ${elapsedSeconds}s`;
  }
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `Running for ${minutes}m ${seconds}s`;
}

function resolveProgressDescription(progress: ActiveGitActionProgress): string | undefined {
  if (progress.lastOutputLine) {
    return progress.lastOutputLine;
  }
  return formatElapsedDescription(progress.hookStartedAtMs ?? progress.phaseStartedAtMs);
}

function getMenuActionDisabledReason({
  item,
  gitStatus,
  isBusy,
  hasOriginRemote,
}: {
  item: GitActionMenuItem;
  gitStatus: GitStatusResult | null;
  isBusy: boolean;
  hasOriginRemote: boolean;
}): string | null {
  if (!item.disabled) return null;
  if (isBusy) return "Git action in progress.";
  if (!gitStatus) return "Git status is unavailable.";

  const hasBranch = gitStatus.branch !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const hasConflicts = gitStatus.hasConflicts;
  const hasOpenPr = gitStatus.pr?.state === "open";
  const isAhead = gitStatus.aheadCount > 0;
  const isBehind = gitStatus.behindCount > 0;

  if (item.id === "commit") {
    if (hasConflicts) {
      return "Resolve merge conflicts before committing.";
    }
    if (!hasChanges) {
      return "Worktree is clean. Make changes before committing.";
    }
    return "Commit is currently unavailable.";
  }

  if (item.id === "push") {
    if (!hasBranch) {
      return "Detached HEAD: checkout a branch before pushing.";
    }
    if (hasConflicts) {
      return "Resolve merge conflicts before pushing.";
    }
    if (hasChanges) {
      return "Commit or stash local changes before pushing.";
    }
    if (isBehind) {
      return "Branch is behind upstream. Pull/rebase before pushing.";
    }
    if (!gitStatus.hasUpstream && !hasOriginRemote) {
      return 'Add an "origin" remote before pushing.';
    }
    if (!isAhead) {
      return "No local commits to push.";
    }
    return "Push is currently unavailable.";
  }

  if (hasOpenPr) {
    return "PR is currently unavailable.";
  }
  if (!hasBranch) {
    return "Detached HEAD: checkout a branch before creating a PR.";
  }
  if (hasConflicts) {
    return "Resolve merge conflicts before creating a PR.";
  }
  if (hasChanges) {
    return "Commit local changes before creating a PR.";
  }
  if (!gitStatus.hasUpstream && !hasOriginRemote) {
    return 'Add an "origin" remote before creating a PR.';
  }
  if (!isAhead) {
    return "No local commits to include in a PR.";
  }
  if (isBehind) {
    return "Branch is behind upstream. Pull/rebase before creating a PR.";
  }
  return "Create PR is currently unavailable.";
}

function dialogIncludesCommit(
  action: GitDialogAction | null,
  gitStatus: GitStatusResult | null,
): boolean {
  if (!action) return false;
  return action === "commit" || !!gitStatus?.hasWorkingTreeChanges;
}

function resolveDialogCopy(input: { action: GitDialogAction | null; includesCommit: boolean }): {
  title: string;
  description: string;
  confirmLabel: string;
  newBranchLabel: string;
} {
  if (input.action === "commit_push_pr") {
    if (input.includesCommit) {
      return {
        title: "Commit, push, and create PR",
        description:
          "Review the commit details, then continue through the full publish flow with PR creation.",
        confirmLabel: "Commit, push & create PR",
        newBranchLabel: "Use new branch instead",
      };
    }
    return {
      title: "Create pull request",
      description: "Push local commits if needed, then create a pull request for this branch.",
      confirmLabel: "Push & create PR",
      newBranchLabel: "Use new branch instead",
    };
  }

  if (input.action === "commit_push") {
    if (input.includesCommit) {
      return {
        title: "Commit and push changes",
        description: "Review the commit details, then publish this branch.",
        confirmLabel: "Commit & push",
        newBranchLabel: "Use new branch instead",
      };
    }
    return {
      title: "Push branch",
      description: "Push local commits on this branch.",
      confirmLabel: "Push",
      newBranchLabel: "Use new branch instead",
    };
  }

  return {
    title: "Commit changes",
    description: "Review and confirm your commit. Leave the message blank to auto-generate one.",
    confirmLabel: "Commit",
    newBranchLabel: "Commit on new branch",
  };
}

function GitActionItemIcon({ icon }: { icon: GitActionIconName }) {
  if (icon === "commit") return <GitCommitIcon />;
  if (icon === "push") return <CloudUploadIcon />;
  return <GitHubIcon />;
}

function GitQuickActionIcon({ quickAction }: { quickAction: GitQuickAction }) {
  const iconClassName = "size-3.5";
  if (quickAction.kind === "open_pr") return <GitHubIcon className={iconClassName} />;
  if (quickAction.kind === "run_pull") return <InfoIcon className={iconClassName} />;
  if (quickAction.kind === "resolve_conflicts") {
    return <CircleAlertIcon className={iconClassName} />;
  }
  if (quickAction.kind === "run_action") {
    if (quickAction.action === "commit") return <GitCommitIcon className={iconClassName} />;
    if (quickAction.action === "commit_push") return <CloudUploadIcon className={iconClassName} />;
    return <GitHubIcon className={iconClassName} />;
  }
  if (quickAction.label === "Commit") return <GitCommitIcon className={iconClassName} />;
  return <InfoIcon className={iconClassName} />;
}

function GitSyncActionIcon() {
  return <ArrowUpDownIcon className="size-3.5" />;
}

export default function GitActionsControl({ gitCwd, activeThreadId }: GitActionsControlProps) {
  const { settings } = useAppSettings();
  const openFileInViewer = useFileViewNavigation();
  const threadToastData = useMemo(
    () => (activeThreadId ? { threadId: activeThreadId } : undefined),
    [activeThreadId],
  );
  const queryClient = useQueryClient();
  const [activeDialogAction, setActiveDialogAction] = useState<GitDialogAction | null>(null);
  const [dialogCommitMessage, setDialogCommitMessage] = useState("");
  const [dialogFeatureBranchName, setDialogFeatureBranchName] = useState("");
  const [excludedFiles, setExcludedFiles] = useState<ReadonlySet<string>>(new Set());
  const [isEditingFiles, setIsEditingFiles] = useState(false);
  const [pendingDefaultBranchAction, setPendingDefaultBranchAction] =
    useState<PendingDefaultBranchAction | null>(null);
  const [gitActionFailureDialog, setGitActionFailureDialog] =
    useState<GitActionFailureDialogState | null>(null);
  const activeGitActionProgressRef = useRef<ActiveGitActionProgress | null>(null);

  const updateActiveProgressToast = useCallback(() => {
    const progress = activeGitActionProgressRef.current;
    if (!progress) {
      return;
    }
    toastManager.update(progress.toastId, {
      type: "loading",
      title: progress.title,
      description: resolveProgressDescription(progress),
      timeout: 0,
      data: threadToastData,
    });
  }, [threadToastData]);

  const { data: gitStatus = null, error: gitStatusError } = useQuery(gitStatusQueryOptions(gitCwd));

  const { data: branchList = null } = useQuery(gitBranchesQueryOptions(gitCwd));
  // Default to true while loading so we don't flash init controls.
  const isRepo = branchList?.isRepo ?? true;
  const hasOriginRemote = branchList?.hasOriginRemote ?? false;
  const currentBranch = branchList?.branches.find((branch) => branch.current)?.name ?? null;
  const isGitStatusOutOfSync =
    !!gitStatus?.branch && !!currentBranch && gitStatus.branch !== currentBranch;

  useEffect(() => {
    if (!isGitStatusOutOfSync) return;
    void invalidateGitQueries(queryClient);
  }, [isGitStatusOutOfSync, queryClient]);

  const gitStatusForActions = isGitStatusOutOfSync ? null : gitStatus;
  const openPullRequest = gitStatusForActions?.pr?.state === "open" ? gitStatusForActions.pr : null;

  const allFiles = gitStatusForActions?.workingTree.files ?? [];
  const selectedFiles = allFiles.filter((f) => !excludedFiles.has(f.path));
  const allSelected = excludedFiles.size === 0;
  const noneSelected = selectedFiles.length === 0;
  const activeDialogIncludesCommit = dialogIncludesCommit(activeDialogAction, gitStatusForActions);
  const activeDialogCopy = resolveDialogCopy({
    action: activeDialogAction,
    includesCommit: activeDialogIncludesCommit,
  });

  const initMutation = useMutation(gitInitMutationOptions({ cwd: gitCwd, queryClient }));

  const runImmediateGitActionMutation = useMutation(
    gitRunStackedActionMutationOptions({
      cwd: gitCwd,
      queryClient,
      textGenerationModel: settings.textGenerationModel ?? null,
      rebaseBeforeCommit: settings.rebaseBeforeCommit,
    }),
  );
  const pullMutation = useMutation(gitPullMutationOptions({ cwd: gitCwd, queryClient }));
  const stopGitActionMutation = useMutation(
    gitStopActionMutationOptions({ cwd: gitCwd, queryClient }),
  );

  const isRunStackedActionRunning =
    useIsMutating({ mutationKey: gitMutationKeys.runStackedAction(gitCwd) }) > 0;
  const isPullRunning = useIsMutating({ mutationKey: gitMutationKeys.pull(gitCwd) }) > 0;
  const isGitActionRunning = isRunStackedActionRunning || isPullRunning;
  const activeGitActionId = activeGitActionProgressRef.current?.actionId;
  const isDefaultBranch = useMemo(() => {
    const branchName = gitStatusForActions?.branch;
    if (!branchName) return false;
    const current = branchList?.branches.find((branch) => branch.name === branchName);
    return current?.isDefault ?? (branchName === "main" || branchName === "master");
  }, [branchList?.branches, gitStatusForActions?.branch]);

  const gitActionMenuItems = useMemo(
    () => buildMenuItems(gitStatusForActions, isGitActionRunning, hasOriginRemote),
    [gitStatusForActions, hasOriginRemote, isGitActionRunning],
  );
  const pullRequestMenuItems = useMemo(
    () => buildPullRequestMenuItems(gitStatusForActions),
    [gitStatusForActions],
  );
  const quickAction = useMemo(
    () =>
      resolveQuickAction(gitStatusForActions, isGitActionRunning, isDefaultBranch, hasOriginRemote),
    [gitStatusForActions, hasOriginRemote, isDefaultBranch, isGitActionRunning],
  );
  const syncAction = useMemo(
    () => resolveSyncAction(gitStatusForActions, isGitActionRunning),
    [gitStatusForActions, isGitActionRunning],
  );
  const quickActionDisabledReason = quickAction.disabled
    ? (quickAction.hint ?? "This action is currently unavailable.")
    : null;
  const syncActionDisabledReason = syncAction?.disabled
    ? (syncAction.hint ?? "This action is currently unavailable.")
    : null;
  const pendingDefaultBranchActionCopy = pendingDefaultBranchAction
    ? resolveDefaultBranchActionDialogCopy({
        action: pendingDefaultBranchAction.action,
        branchName: pendingDefaultBranchAction.branchName,
        includesCommit: pendingDefaultBranchAction.includesCommit,
      })
    : null;

  const { copyToClipboard: copyPullRequestValue } = useCopyToClipboard<{
    successTitle: string;
    successDescription: string;
    errorTitle: string;
  }>({
    onCopy: (ctx) => {
      toastManager.add({
        type: "success",
        title: ctx.successTitle,
        description: ctx.successDescription,
        data: threadToastData,
      });
    },
    onError: (error, ctx) => {
      toastManager.add({
        type: "error",
        title: ctx.errorTitle,
        description: error instanceof Error ? error.message : "An error occurred.",
        data: threadToastData,
      });
    },
  });

  useEffect(() => {
    const api = readNativeApi();
    if (!api) {
      return;
    }

    const applyProgressEvent = (event: GitActionProgressEvent) => {
      const progress = activeGitActionProgressRef.current;
      if (!progress) {
        return;
      }
      if (gitCwd && event.cwd !== gitCwd) {
        return;
      }
      if (progress.actionId !== event.actionId) {
        return;
      }

      const now = Date.now();
      switch (event.kind) {
        case "action_started":
          progress.phaseStartedAtMs = now;
          progress.hookStartedAtMs = null;
          progress.hookName = null;
          progress.lastOutputLine = null;
          break;
        case "phase_started":
          progress.title = event.label;
          progress.currentPhaseLabel = event.label;
          progress.phaseStartedAtMs = now;
          progress.hookStartedAtMs = null;
          progress.hookName = null;
          progress.lastOutputLine = null;
          break;
        case "hook_started":
          progress.title = `Running ${event.hookName}...`;
          progress.hookName = event.hookName;
          progress.hookStartedAtMs = now;
          progress.lastOutputLine = null;
          break;
        case "hook_output":
          progress.lastOutputLine = event.text;
          break;
        case "hook_finished":
          progress.title = progress.currentPhaseLabel ?? "Committing...";
          progress.hookName = null;
          progress.hookStartedAtMs = null;
          progress.lastOutputLine = null;
          break;
        case "action_finished":
          // Don't clear timestamps here — the HTTP response handler (line 496)
          // sets activeGitActionProgressRef to null and shows the success toast.
          // Clearing timestamps early causes the "Running for Xs" description
          // to disappear before the success state renders, leaving a bare
          // "Pushing..." toast in the gap between the WS event and HTTP response.
          return;
        case "action_failed":
          // Same reasoning as action_finished — let the HTTP error handler
          // manage the final toast state to avoid a flash of bare title.
          return;
      }

      updateActiveProgressToast();
    };

    return api.git.onActionProgress(applyProgressEvent);
  }, [gitCwd, updateActiveProgressToast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!activeGitActionProgressRef.current) {
        return;
      }
      updateActiveProgressToast();
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [updateActiveProgressToast]);

  const openExistingPr = useCallback(async () => {
    const api = readNativeApi();
    if (!api) {
      toastManager.add({
        type: "error",
        title: "Link opening is unavailable.",
        data: threadToastData,
      });
      return;
    }
    const prUrl = openPullRequest?.url ?? null;
    if (!prUrl) {
      toastManager.add({
        type: "error",
        title: "No open PR found.",
        data: threadToastData,
      });
      return;
    }
    void api.shell.openExternal(prUrl).catch((err) => {
      toastManager.add({
        type: "error",
        title: "Unable to open PR link",
        description: err instanceof Error ? err.message : "An error occurred.",
        data: threadToastData,
      });
    });
  }, [openPullRequest, threadToastData]);

  const copyOpenPullRequestNumber = useCallback(() => {
    if (!openPullRequest) return;
    const prNumber = `#${openPullRequest.number}`;
    copyPullRequestValue(prNumber, {
      successTitle: "PR number copied",
      successDescription: prNumber,
      errorTitle: "Failed to copy PR number",
    });
  }, [copyPullRequestValue, openPullRequest]);

  const copyOpenPullRequestLink = useCallback(() => {
    if (!openPullRequest) return;
    copyPullRequestValue(openPullRequest.url, {
      successTitle: "PR link copied",
      successDescription: openPullRequest.url,
      errorTitle: "Failed to copy PR link",
    });
  }, [copyPullRequestValue, openPullRequest]);

  const runGitActionWithToast = useEffectEvent(
    async ({
      action,
      commitMessage,
      forcePushOnlyProgress = false,
      onConfirmed,
      skipDefaultBranchPrompt = false,
      statusOverride,
      featureBranch = false,
      featureBranchName,
      isDefaultBranchOverride,
      progressToastId,
      filePaths,
    }: RunGitActionWithToastInput) => {
      const actionStatus = statusOverride ?? gitStatusForActions;
      const actionBranch = actionStatus?.branch ?? null;
      const actionIsDefaultBranch =
        isDefaultBranchOverride ?? (featureBranch ? false : isDefaultBranch);
      const includesCommit =
        !forcePushOnlyProgress && (action === "commit" || !!actionStatus?.hasWorkingTreeChanges);
      if (
        !skipDefaultBranchPrompt &&
        requiresDefaultBranchConfirmation(action, actionIsDefaultBranch) &&
        actionBranch
      ) {
        if (action !== "commit_push" && action !== "commit_push_pr") {
          return;
        }
        setPendingDefaultBranchAction({
          action,
          branchName: actionBranch,
          includesCommit,
          ...(commitMessage ? { commitMessage } : {}),
          ...(featureBranchName ? { featureBranchName } : {}),
          forcePushOnlyProgress,
          ...(onConfirmed ? { onConfirmed } : {}),
          ...(filePaths ? { filePaths } : {}),
        });
        return;
      }
      onConfirmed?.();
      setGitActionFailureDialog(null);

      const progressStages = buildGitActionProgressStages({
        action,
        hasCustomCommitMessage: !!commitMessage?.trim(),
        hasWorkingTreeChanges: !!actionStatus?.hasWorkingTreeChanges,
        forcePushOnly: forcePushOnlyProgress,
        featureBranch,
        rebaseBeforeCommit: settings.rebaseBeforeCommit,
      });
      const actionId = randomUUID();
      const resolvedProgressToastId =
        progressToastId ??
        toastManager.add({
          type: "loading",
          title: progressStages[0] ?? "Running git action...",
          description: "Waiting for Git...",
          timeout: 0,
          data: threadToastData,
        });

      activeGitActionProgressRef.current = {
        toastId: resolvedProgressToastId,
        actionId,
        title: progressStages[0] ?? "Running git action...",
        phaseStartedAtMs: null,
        hookStartedAtMs: null,
        hookName: null,
        lastOutputLine: null,
        currentPhaseLabel: progressStages[0] ?? "Running git action...",
      };

      if (progressToastId) {
        toastManager.update(progressToastId, {
          type: "loading",
          title: progressStages[0] ?? "Running git action...",
          description: "Waiting for Git...",
          timeout: 0,
          data: threadToastData,
        });
      }

      const promise = runImmediateGitActionMutation.mutateAsync({
        actionId,
        action,
        ...(commitMessage ? { commitMessage } : {}),
        ...(featureBranch ? { featureBranch } : {}),
        ...(featureBranchName ? { featureBranchName } : {}),
        ...(settings.rebaseBeforeCommit ? { rebaseBeforeCommit: true } : {}),
        ...(filePaths ? { filePaths } : {}),
      });

      try {
        const result = await promise;
        activeGitActionProgressRef.current = null;
        setGitActionFailureDialog(null);
        const resultToast = summarizeGitResult(result);

        const existingOpenPrUrl =
          actionStatus?.pr?.state === "open" ? actionStatus.pr.url : undefined;
        const prUrl = result.pr.url ?? existingOpenPrUrl;
        const prNumber = result.pr.number ?? actionStatus?.pr?.number;
        const shouldOfferPushCta = action === "commit" && result.commit.status === "created";
        const shouldOfferOpenPrCta =
          (action === "commit_push" || action === "commit_push_pr") &&
          !!prUrl &&
          (!actionIsDefaultBranch ||
            result.pr.status === "created" ||
            result.pr.status === "opened_existing");
        const shouldOfferCreatePrCta =
          action === "commit_push" &&
          !prUrl &&
          result.push.status === "pushed" &&
          !actionIsDefaultBranch;
        const closeResultToast = () => {
          toastManager.close(resolvedProgressToastId);
        };

        toastManager.update(resolvedProgressToastId, {
          type: "success",
          title: resultToast.title,
          description: resultToast.description,
          timeout: 0,
          data: {
            ...threadToastData,
            dismissAfterVisibleMs: 10_000,
          },
          ...(shouldOfferPushCta
            ? {
                actionProps: {
                  children: "Push",
                  onClick: () => {
                    void runGitActionWithToast({
                      action: "commit_push",
                      forcePushOnlyProgress: true,
                      onConfirmed: closeResultToast,
                      statusOverride: actionStatus,
                      isDefaultBranchOverride: actionIsDefaultBranch,
                    });
                  },
                },
              }
            : shouldOfferOpenPrCta
              ? {
                  actionProps: {
                    children: formatOpenPullRequestLabel(prNumber),
                    onClick: () => {
                      const api = readNativeApi();
                      if (!api) return;
                      closeResultToast();
                      void api.shell.openExternal(prUrl);
                    },
                  },
                }
              : shouldOfferCreatePrCta
                ? {
                    actionProps: {
                      children: "Create PR",
                      onClick: () => {
                        closeResultToast();
                        void runGitActionWithToast({
                          action: "commit_push_pr",
                          forcePushOnlyProgress: true,
                          statusOverride: actionStatus,
                          isDefaultBranchOverride: actionIsDefaultBranch,
                        });
                      },
                    },
                  }
                : {}),
        });
      } catch (err) {
        activeGitActionProgressRef.current = null;
        if (
          isWsRequestError(err) &&
          err.code === "git_action_failed" &&
          isGitActionFailure(err.data)
        ) {
          const dialogState: GitActionFailureDialogState = {
            failure: err.data,
            retryInput: toRetryableGitActionInput({
              action,
              ...(commitMessage ? { commitMessage } : {}),
              ...(featureBranch ? { featureBranch } : {}),
              ...(featureBranchName ? { featureBranchName } : {}),
              ...(filePaths ? { filePaths } : {}),
              ...(forcePushOnlyProgress ? { forcePushOnlyProgress } : {}),
              ...(skipDefaultBranchPrompt ? { skipDefaultBranchPrompt } : {}),
            }),
          };
          const failureToast = summarizeGitFailure(err.data);
          setGitActionFailureDialog(dialogState);
          toastManager.update(resolvedProgressToastId, {
            type: "error",
            title: failureToast.title,
            description: failureToast.description,
            data: threadToastData,
            actionProps: {
              children: "Review",
              onClick: () => {
                setGitActionFailureDialog(dialogState);
              },
            },
          });
          return;
        }
        toastManager.update(resolvedProgressToastId, {
          type: isWsRequestError(err) && err.code === "git_action_stopped" ? "info" : "error",
          title:
            isWsRequestError(err) && err.code === "git_action_stopped"
              ? "Git action stopped"
              : "Action failed",
          description: err instanceof Error ? err.message : "An error occurred.",
          data: threadToastData,
        });
      }
    },
  );

  const continuePendingDefaultBranchAction = useCallback(() => {
    if (!pendingDefaultBranchAction) return;
    const {
      action,
      commitMessage,
      featureBranchName,
      forcePushOnlyProgress,
      onConfirmed,
      filePaths,
    } = pendingDefaultBranchAction;
    setPendingDefaultBranchAction(null);
    void runGitActionWithToast({
      action,
      ...(commitMessage ? { commitMessage } : {}),
      ...(featureBranchName ? { featureBranchName } : {}),
      forcePushOnlyProgress,
      ...(onConfirmed ? { onConfirmed } : {}),
      ...(filePaths ? { filePaths } : {}),
      skipDefaultBranchPrompt: true,
    });
  }, [pendingDefaultBranchAction]);

  const retryGitActionFailure = useCallback(() => {
    if (!gitActionFailureDialog) return;
    const retryInput = gitActionFailureDialog.retryInput;
    setGitActionFailureDialog(null);
    void runGitActionWithToast(retryInput);
  }, [gitActionFailureDialog]);

  const fixWithAgent = useCallback(async () => {
    if (!gitActionFailureDialog || !activeThreadId) return;
    const api = readNativeApi();
    if (!api) return;
    const promptText = buildHookFailureAgentPrompt(gitActionFailureDialog.failure);
    setGitActionFailureDialog(null);
    await api.orchestration.dispatchCommand({
      type: "thread.turn.start",
      commandId: newCommandId(),
      threadId: activeThreadId,
      message: {
        messageId: newMessageId(),
        role: "user",
        text: promptText,
        attachments: [],
      },
      assistantDeliveryMode: settings.enableAssistantStreaming ? "streaming" : "buffered",
      runtimeMode: "approval-required",
      interactionMode: "code",
      createdAt: new Date().toISOString(),
    });
  }, [gitActionFailureDialog, activeThreadId, settings.enableAssistantStreaming]);

  const checkoutFeatureBranchAndContinuePendingAction = useCallback(() => {
    if (!pendingDefaultBranchAction) return;
    const {
      action,
      commitMessage,
      featureBranchName,
      forcePushOnlyProgress,
      onConfirmed,
      filePaths,
    } = pendingDefaultBranchAction;
    setPendingDefaultBranchAction(null);
    void runGitActionWithToast({
      action,
      ...(commitMessage ? { commitMessage } : {}),
      ...(featureBranchName ? { featureBranchName } : {}),
      forcePushOnlyProgress,
      ...(onConfirmed ? { onConfirmed } : {}),
      ...(filePaths ? { filePaths } : {}),
      featureBranch: true,
      skipDefaultBranchPrompt: true,
    });
  }, [pendingDefaultBranchAction]);

  const runDialogActionOnNewBranch = useCallback(() => {
    if (!activeDialogAction || !activeDialogIncludesCommit) return;
    const commitMessage = dialogCommitMessage.trim();
    const featureBranchName = dialogFeatureBranchName.trim();

    setActiveDialogAction(null);
    setDialogCommitMessage("");
    setDialogFeatureBranchName("");
    setExcludedFiles(new Set());
    setIsEditingFiles(false);

    void runGitActionWithToast({
      action: activeDialogAction,
      ...(commitMessage ? { commitMessage } : {}),
      ...(featureBranchName ? { featureBranchName } : {}),
      ...(!allSelected ? { filePaths: selectedFiles.map((f) => f.path) } : {}),
      featureBranch: true,
      skipDefaultBranchPrompt: true,
    });
  }, [
    activeDialogAction,
    activeDialogIncludesCommit,
    allSelected,
    dialogCommitMessage,
    dialogFeatureBranchName,
    selectedFiles,
  ]);

  const conflictedFiles = useMemo(
    () => gitStatusForActions?.conflictedFiles ?? [],
    [gitStatusForActions?.conflictedFiles],
  );

  const openConflictedFileInEditor = useCallback(
    (filePath: string) => {
      if (!gitCwd) return;

      const api = readNativeApi();
      if (!api) {
        toastManager.add({
          type: "error",
          title: "Editor opening is unavailable.",
          data: threadToastData,
        });
        return;
      }

      const target = resolvePathLinkTarget(filePath, gitCwd);
      const openPromise = openInPreferredEditor(api, target);

      toastManager.promise(openPromise, {
        loading: { title: "Opening file...", data: threadToastData },
        success: () => ({
          title: "Opened conflicted file",
          data: threadToastData,
        }),
        error: (error) => ({
          title: "Unable to open file",
          description: error instanceof Error ? error.message : "An error occurred.",
          data: threadToastData,
        }),
      });

      void openPromise.catch(() => undefined);
    },
    [gitCwd, threadToastData],
  );

  const openConflictedFilesInEditor = useCallback(() => {
    if (!gitCwd || conflictedFiles.length === 0) {
      toastManager.add({
        type: "info",
        title: "No conflicted files",
        description: "Refresh git status if you recently resolved conflicts.",
        data: threadToastData,
      });
      return;
    }

    const api = readNativeApi();
    if (!api) {
      toastManager.add({
        type: "error",
        title: "Editor opening is unavailable.",
        data: threadToastData,
      });
      return;
    }

    const openPromise = (async () => {
      for (const filePath of conflictedFiles) {
        const target = resolvePathLinkTarget(filePath, gitCwd);
        await openInPreferredEditor(api, target);
      }
      return conflictedFiles.length;
    })();

    toastManager.promise(openPromise, {
      loading: { title: "Opening conflicted files...", data: threadToastData },
      success: (count) => ({
        title: count === 1 ? "Opened conflicted file" : "Opened conflicted files",
        description:
          count === 1 ? (conflictedFiles[0] ?? undefined) : `${count} files opened in your editor.`,
        data: threadToastData,
      }),
      error: (error) => ({
        title: "Unable to open conflicted files",
        description: error instanceof Error ? error.message : "An error occurred.",
        data: threadToastData,
      }),
    });

    void openPromise.catch(() => undefined);
  }, [conflictedFiles, gitCwd, threadToastData]);

  const runPullWithToast = useCallback(
    (messages?: {
      loadingTitle?: string;
      pulledTitle?: string;
      rebasedTitle?: string;
      conflictedTitle?: string;
      skippedTitle?: string;
      errorTitle?: string;
    }) => {
      const loadingToastId = toastManager.add({
        type: "loading",
        title: messages?.loadingTitle ?? "Pulling...",
        timeout: 0,
        data: threadToastData,
      });
      void pullMutation
        .mutateAsync()
        .then((result) => {
          if (result.status === "conflicted") {
            toastManager.update(loadingToastId, {
              type: "warning",
              title: messages?.conflictedTitle ?? "Rebase stopped with conflicts",
              description:
                result.conflictedFiles.length > 0
                  ? `Resolve ${result.conflictedFiles.length} conflicted file${result.conflictedFiles.length === 1 ? "" : "s"} in ${result.cwd}, then continue from the conflict controls.`
                  : `Resolve conflicts in ${result.cwd} before continuing.`,
              data: threadToastData,
            });
            return;
          }
          toastManager.update(loadingToastId, {
            type: "success",
            title:
              result.status === "pulled"
                ? (messages?.pulledTitle ?? "Pulled")
                : result.status === "rebased"
                  ? (messages?.rebasedTitle ?? "Rebased")
                  : (messages?.skippedTitle ?? "Already up to date"),
            description:
              result.status === "pulled"
                ? `Updated ${result.branch} from ${result.upstreamBranch ?? "upstream"}`
                : result.status === "rebased"
                  ? `Rebased ${result.branch} onto ${result.upstreamBranch ?? "upstream"}`
                  : `${result.branch} is already synchronized.`,
            data: threadToastData,
          });
        })
        .catch((err) => {
          toastManager.update(loadingToastId, {
            type: isWsRequestError(err) && err.code === "git_action_stopped" ? "info" : "error",
            title:
              isWsRequestError(err) && err.code === "git_action_stopped"
                ? "Pull stopped"
                : (messages?.errorTitle ?? "Pull failed"),
            description: err instanceof Error ? err.message : "An error occurred.",
            data: threadToastData,
          });
        });
    },
    [pullMutation, threadToastData],
  );

  const stopPendingGitAction = useCallback(() => {
    if (!gitCwd || !isGitActionRunning || stopGitActionMutation.isPending) {
      return;
    }
    void stopGitActionMutation
      .mutateAsync(activeGitActionId ? { actionId: activeGitActionId } : {})
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Unable to stop git action",
          description: error instanceof Error ? error.message : "An error occurred.",
          data: threadToastData,
        });
      });
  }, [activeGitActionId, gitCwd, isGitActionRunning, stopGitActionMutation, threadToastData]);

  const runSyncAction = useCallback(() => {
    if (!syncAction || syncAction.disabled) {
      return;
    }
    if (syncAction.kind === "run_pull") {
      runPullWithToast({
        loadingTitle: "Syncing...",
        pulledTitle: "Synced branch",
        rebasedTitle: "Rebased branch",
        conflictedTitle: "Sync stopped with conflicts",
        skippedTitle: "Already up to date",
        errorTitle: "Sync failed",
      });
      return;
    }
    if (syncAction.kind === "run_action" && syncAction.action === "commit_push") {
      void runGitActionWithToast({ action: "commit_push", forcePushOnlyProgress: true });
    }
  }, [runPullWithToast, syncAction]);

  const runQuickAction = useCallback(() => {
    if (quickAction.kind === "open_pr") {
      void openExistingPr();
      return;
    }
    if (quickAction.kind === "run_pull") {
      runPullWithToast();
      return;
    }
    if (quickAction.kind === "resolve_conflicts") {
      openConflictedFilesInEditor();
      return;
    }
    if (quickAction.kind === "show_hint") {
      toastManager.add({
        type: "info",
        title: quickAction.label,
        description: quickAction.hint,
        data: threadToastData,
      });
      return;
    }
    if (quickAction.action) {
      setDialogCommitMessage("");
      setDialogFeatureBranchName("");
      setExcludedFiles(new Set());
      setIsEditingFiles(false);
      setActiveDialogAction(quickAction.action);
    }
  }, [openConflictedFilesInEditor, openExistingPr, quickAction, runPullWithToast, threadToastData]);

  useEffect(() => {
    if (!activeThreadId) {
      return;
    }
    return subscribeToGitPullRequestAction(({ threadId }) => {
      if (threadId !== activeThreadId) {
        return;
      }
      runQuickAction();
    });
  }, [activeThreadId, runQuickAction]);

  const openDialogForMenuItem = useCallback(
    (item: GitActionMenuItem) => {
      if (item.disabled) return;
      if (item.kind === "open_pr") {
        void openExistingPr();
        return;
      }
      setDialogCommitMessage("");
      setDialogFeatureBranchName("");
      setExcludedFiles(new Set());
      setIsEditingFiles(false);
      if (item.dialogAction === "push") {
        setActiveDialogAction("commit_push");
        return;
      }
      if (item.dialogAction === "create_pr") {
        setActiveDialogAction("commit_push_pr");
        return;
      }
      setActiveDialogAction("commit");
    },
    [openExistingPr],
  );

  const runDialogAction = useCallback(() => {
    if (!activeDialogAction) return;
    const commitMessage = dialogCommitMessage.trim();
    const includesCommit = dialogIncludesCommit(activeDialogAction, gitStatusForActions);
    setActiveDialogAction(null);
    setDialogCommitMessage("");
    setDialogFeatureBranchName("");
    setExcludedFiles(new Set());
    setIsEditingFiles(false);
    void runGitActionWithToast({
      action: activeDialogAction,
      ...(includesCommit && commitMessage ? { commitMessage } : {}),
      ...(includesCommit
        ? !allSelected
          ? { filePaths: selectedFiles.map((f) => f.path) }
          : {}
        : activeDialogAction !== "commit"
          ? { forcePushOnlyProgress: true }
          : {}),
    });
  }, [
    activeDialogAction,
    allSelected,
    dialogCommitMessage,
    gitStatusForActions,
    selectedFiles,
    setDialogCommitMessage,
  ]);

  const openChangedFileInApp = useCallback(
    (filePath: string) => {
      if (!gitCwd) {
        toastManager.add({
          type: "error",
          title: "File opening is unavailable.",
          data: threadToastData,
        });
        return;
      }
      openFileInViewer(gitCwd, filePath);
    },
    [gitCwd, openFileInViewer, threadToastData],
  );

  if (!gitCwd) return null;

  return (
    <>
      {!isRepo ? (
        <Button
          variant="outline"
          size="xs"
          disabled={initMutation.isPending}
          onClick={() => initMutation.mutate()}
        >
          {initMutation.isPending ? "Initializing..." : "Initialize Git"}
        </Button>
      ) : (
        <Group aria-label="Git actions">
          {isGitActionRunning ? (
            <>
              <Button
                variant="destructive-outline"
                size="xs"
                disabled={stopGitActionMutation.isPending}
                onClick={stopPendingGitAction}
              >
                <SquareIcon className="size-3.5" />
                <span className="ml-0.5">Stop</span>
              </Button>
              <GroupSeparator className="hidden @sm/header-actions:block" />
            </>
          ) : null}
          {syncAction ? (
            <>
              {syncActionDisabledReason ? (
                <Popover>
                  <PopoverTrigger
                    openOnHover
                    render={
                      <Button
                        aria-disabled="true"
                        className="cursor-not-allowed opacity-64"
                        size="icon-xs"
                        variant="outline"
                      />
                    }
                  >
                    <GitSyncActionIcon />
                  </PopoverTrigger>
                  <PopoverPopup tooltipStyle side="bottom" align="start">
                    {syncActionDisabledReason}
                  </PopoverPopup>
                </Popover>
              ) : (
                <Button
                  aria-label={syncAction.label}
                  title={syncAction.label}
                  size="icon-xs"
                  variant="outline"
                  onClick={runSyncAction}
                >
                  <GitSyncActionIcon />
                </Button>
              )}
              <GroupSeparator className="hidden @sm/header-actions:block" />
            </>
          ) : null}
          {quickActionDisabledReason ? (
            <Popover>
              <PopoverTrigger
                openOnHover
                render={
                  <Button
                    aria-disabled="true"
                    className="cursor-not-allowed rounded-e-none border-e-0 opacity-64 before:rounded-e-none"
                    size="xs"
                    variant="outline"
                  />
                }
              >
                <GitQuickActionIcon quickAction={quickAction} />
                <span className="ml-0.5">{quickAction.label}</span>
              </PopoverTrigger>
              <PopoverPopup tooltipStyle side="bottom" align="start">
                {quickActionDisabledReason}
              </PopoverPopup>
            </Popover>
          ) : (
            <Button
              variant="outline"
              size="xs"
              disabled={isGitActionRunning || quickAction.disabled}
              onClick={runQuickAction}
            >
              <GitQuickActionIcon quickAction={quickAction} />
              <span className="ml-0.5">{quickAction.label}</span>
            </Button>
          )}
          <GroupSeparator className="hidden @sm/header-actions:block" />
          <Menu
            onOpenChange={(open) => {
              if (open) void invalidateGitQueries(queryClient);
            }}
          >
            <MenuTrigger
              render={<Button aria-label="Git action options" size="icon-xs" variant="outline" />}
              disabled={isGitActionRunning}
            >
              <ChevronDownIcon aria-hidden="true" className="size-4" />
            </MenuTrigger>
            <MenuPopup align="end" className="w-full">
              {openPullRequest && pullRequestMenuItems.length > 0 ? (
                <>
                  <MenuGroup>
                    <MenuGroupLabel inset>PR #{openPullRequest.number}</MenuGroupLabel>
                    {pullRequestMenuItems.map((item) => {
                      if (item.id === "open_in_browser") {
                        return (
                          <MenuItem
                            key={item.id}
                            onClick={() => {
                              void openExistingPr();
                            }}
                          >
                            <ExternalLinkIcon className="size-3.5" />
                            {item.label}
                          </MenuItem>
                        );
                      }
                      if (item.id === "copy_pr_number") {
                        return (
                          <MenuItem key={item.id} onClick={copyOpenPullRequestNumber}>
                            <CopyIcon className="size-3.5" />
                            {item.label}
                          </MenuItem>
                        );
                      }
                      return (
                        <MenuItem key={item.id} onClick={copyOpenPullRequestLink}>
                          <LinkIcon className="size-3.5" />
                          {item.label}
                        </MenuItem>
                      );
                    })}
                  </MenuGroup>
                  {gitActionMenuItems.length > 0 ? <MenuSeparator /> : null}
                </>
              ) : null}
              {gitActionMenuItems.map((item) => {
                const disabledReason = getMenuActionDisabledReason({
                  item,
                  gitStatus: gitStatusForActions,
                  isBusy: isGitActionRunning,
                  hasOriginRemote,
                });
                if (item.disabled && disabledReason) {
                  return (
                    <Popover key={`${item.id}-${item.label}`}>
                      <PopoverTrigger
                        openOnHover
                        nativeButton={false}
                        render={<span className="block w-max cursor-not-allowed" />}
                      >
                        <MenuItem className="w-full" disabled>
                          <GitActionItemIcon icon={item.icon} />
                          {item.label}
                        </MenuItem>
                      </PopoverTrigger>
                      <PopoverPopup tooltipStyle side="left" align="center">
                        {disabledReason}
                      </PopoverPopup>
                    </Popover>
                  );
                }

                return (
                  <MenuItem
                    key={`${item.id}-${item.label}`}
                    disabled={item.disabled}
                    onClick={() => {
                      openDialogForMenuItem(item);
                    }}
                  >
                    <GitActionItemIcon icon={item.icon} />
                    {item.label}
                  </MenuItem>
                );
              })}
              {gitStatusForActions?.branch === null && (
                <p className="px-2 py-1.5 text-xs text-warning">
                  Detached HEAD: create and checkout a branch to enable push and PR actions.
                </p>
              )}
              {gitStatusForActions?.hasConflicts && (
                <div className="space-y-1 px-2 py-2">
                  <p className="text-warning text-xs">
                    Resolve merge conflicts before committing, pulling, pushing, or opening a PR.
                  </p>
                  {gitStatusForActions.conflictedFiles.length > 0 ? (
                    <MenuSub>
                      <MenuSubTrigger className="text-xs">
                        <CircleAlertIcon className="size-3.5 text-warning" />
                        Conflicted files ({gitStatusForActions.conflictedFiles.length})
                      </MenuSubTrigger>
                      <MenuSubPopup>
                        {gitStatusForActions.conflictedFiles.map((filePath) => (
                          <MenuItem
                            key={filePath}
                            className="font-mono text-xs"
                            onClick={() => openConflictedFileInEditor(filePath)}
                          >
                            {filePath.split("/").pop()}
                          </MenuItem>
                        ))}
                        {gitStatusForActions.conflictedFiles.length > 1 && (
                          <>
                            <MenuSeparator />
                            <MenuItem className="text-xs" onClick={openConflictedFilesInEditor}>
                              <ExternalLinkIcon className="size-3.5" />
                              Open all
                            </MenuItem>
                          </>
                        )}
                      </MenuSubPopup>
                    </MenuSub>
                  ) : null}
                </div>
              )}
              {gitStatusForActions &&
                gitStatusForActions.branch !== null &&
                !gitStatusForActions.hasWorkingTreeChanges &&
                gitStatusForActions.behindCount > 0 &&
                gitStatusForActions.aheadCount === 0 && (
                  <p className="px-2 py-1.5 text-xs text-warning">
                    Behind upstream. Pull/rebase first.
                  </p>
                )}
              {isGitStatusOutOfSync && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  Refreshing git status...
                </p>
              )}
              {gitStatusError && (
                <p className="px-2 py-1.5 text-xs text-destructive">{gitStatusError.message}</p>
              )}
            </MenuPopup>
          </Menu>
        </Group>
      )}

      <Dialog
        open={activeDialogAction !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setActiveDialogAction(null);
            setDialogCommitMessage("");
            setDialogFeatureBranchName("");
            setExcludedFiles(new Set());
            setIsEditingFiles(false);
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>{activeDialogCopy.title}</DialogTitle>
            <DialogDescription>{activeDialogCopy.description}</DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <div className="space-y-3 rounded-lg border border-input bg-muted/40 p-3 text-xs">
              <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1">
                <span className="text-muted-foreground">Branch</span>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {gitStatusForActions?.branch ?? "(detached HEAD)"}
                  </span>
                  {isDefaultBranch && (
                    <span className="text-right text-warning text-xs">Warning: default branch</span>
                  )}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {activeDialogIncludesCommit && isEditingFiles && allFiles.length > 0 && (
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && !noneSelected}
                        onCheckedChange={() => {
                          setExcludedFiles(
                            allSelected ? new Set(allFiles.map((f) => f.path)) : new Set(),
                          );
                        }}
                      />
                    )}
                    <span className="text-muted-foreground">Files</span>
                    {activeDialogIncludesCommit && !allSelected && !isEditingFiles && (
                      <span className="text-muted-foreground">
                        ({selectedFiles.length} of {allFiles.length})
                      </span>
                    )}
                  </div>
                  {activeDialogIncludesCommit && allFiles.length > 0 && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setIsEditingFiles((prev) => !prev)}
                    >
                      {isEditingFiles ? "Done" : "Edit"}
                    </Button>
                  )}
                </div>
                {!gitStatusForActions || allFiles.length === 0 ? (
                  <p className="font-medium">none</p>
                ) : (
                  <div className="space-y-2">
                    <ScrollArea className="h-44 rounded-md border border-input bg-background">
                      <div className="space-y-1 p-1">
                        {allFiles.map((file) => {
                          const isExcluded = excludedFiles.has(file.path);
                          return (
                            <div
                              key={file.path}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 font-mono text-xs transition-colors hover:bg-accent/50"
                            >
                              {activeDialogIncludesCommit && isEditingFiles && (
                                <Checkbox
                                  checked={!excludedFiles.has(file.path)}
                                  onCheckedChange={() => {
                                    setExcludedFiles((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(file.path)) {
                                        next.delete(file.path);
                                      } else {
                                        next.add(file.path);
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              )}
                              <button
                                type="button"
                                className="flex flex-1 items-center justify-between gap-3 text-left truncate"
                                onClick={() => openChangedFileInApp(file.path)}
                              >
                                <span
                                  className={`truncate${isExcluded ? " text-muted-foreground" : ""}`}
                                >
                                  {file.path}
                                </span>
                                <span className="shrink-0">
                                  {isExcluded ? (
                                    <span className="text-muted-foreground">Excluded</span>
                                  ) : (
                                    <>
                                      <span className="text-success">+{file.insertions}</span>
                                      <span className="text-muted-foreground"> / </span>
                                      <span className="text-destructive">-{file.deletions}</span>
                                    </>
                                  )}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    <div className="flex justify-end font-mono">
                      <span className="text-success">
                        +{selectedFiles.reduce((sum, f) => sum + f.insertions, 0)}
                      </span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-destructive">
                        -{selectedFiles.reduce((sum, f) => sum + f.deletions, 0)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {activeDialogIncludesCommit && activeDialogAction === "commit_push_pr" ? (
              <div className="space-y-1">
                <p className="text-xs font-medium">Head branch (optional)</p>
                <Input
                  value={dialogFeatureBranchName}
                  onChange={(event) => setDialogFeatureBranchName(event.target.value)}
                  placeholder="feature/my-change"
                  size="sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used when you choose to create a new feature branch for this PR.
                </p>
              </div>
            ) : null}
            {activeDialogIncludesCommit ? (
              <div className="space-y-1">
                <p className="text-xs font-medium">Commit message (optional)</p>
                <Textarea
                  value={dialogCommitMessage}
                  onChange={(event) => setDialogCommitMessage(event.target.value)}
                  placeholder="Leave empty to auto-generate"
                  size="sm"
                />
              </div>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveDialogAction(null);
                setDialogCommitMessage("");
                setDialogFeatureBranchName("");
                setExcludedFiles(new Set());
                setIsEditingFiles(false);
              }}
            >
              Cancel
            </Button>
            {activeDialogIncludesCommit ? (
              <Button
                variant="outline"
                size="sm"
                disabled={noneSelected}
                onClick={runDialogActionOnNewBranch}
              >
                {activeDialogCopy.newBranchLabel}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={activeDialogIncludesCommit && noneSelected}
              onClick={runDialogAction}
            >
              {activeDialogCopy.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={pendingDefaultBranchAction !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPendingDefaultBranchAction(null);
          }
        }}
      >
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {pendingDefaultBranchActionCopy?.title ?? "Run action on default branch?"}
            </DialogTitle>
            <DialogDescription>{pendingDefaultBranchActionCopy?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPendingDefaultBranchAction(null)}>
              Abort
            </Button>
            <Button variant="outline" size="sm" onClick={continuePendingDefaultBranchAction}>
              {pendingDefaultBranchActionCopy?.continueLabel ?? "Continue"}
            </Button>
            <Button size="sm" onClick={checkoutFeatureBranchAndContinuePendingAction}>
              Checkout feature branch & continue
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <Dialog
        open={gitActionFailureDialog !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setGitActionFailureDialog(null);
          }
        }}
      >
        <DialogPopup className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {gitActionFailureDialog?.failure.title ?? "Git action failed"}
            </DialogTitle>
            <DialogDescription>
              {gitActionFailureDialog?.failure.summary ??
                "OK Code could not complete the git action."}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            {gitActionFailureDialog ? (
              <>
                {gitActionFailureDialog.failure.detail ? (
                  <Alert variant="error">
                    <CircleAlertIcon className="mt-0.5 size-4" />
                    <AlertTitle>What happened</AlertTitle>
                    <AlertDescription className="whitespace-pre-wrap">
                      {gitActionFailureDialog.failure.detail}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {formatGitActionFailurePhaseLabel(gitActionFailureDialog.failure.phase) ? (
                    <div className="rounded-xl border border-input bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">Failed step</p>
                      <p className="mt-1 font-medium">
                        {formatGitActionFailurePhaseLabel(gitActionFailureDialog.failure.phase)}
                      </p>
                    </div>
                  ) : null}
                  {gitActionFailureDialog.failure.operation ? (
                    <div className="rounded-xl border border-input bg-muted/35 p-3">
                      <p className="text-xs text-muted-foreground">Operation</p>
                      <p className="mt-1 break-words font-mono text-xs">
                        {gitActionFailureDialog.failure.operation}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Next steps</p>
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                    {gitActionFailureDialog.failure.nextSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                {gitActionFailureDialog.failure.command ||
                gitActionFailureDialog.failure.rawMessage ? (
                  <details className="rounded-xl border border-input bg-muted/20">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                      Technical details
                    </summary>
                    <div className="space-y-3 border-t px-3 py-3 text-sm">
                      {gitActionFailureDialog.failure.command ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Command</p>
                          <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-background px-3 py-2 font-mono text-xs">
                            {gitActionFailureDialog.failure.command}
                          </pre>
                        </div>
                      ) : null}
                      {gitActionFailureDialog.failure.rawMessage ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Raw error</p>
                          <ScrollArea className="max-h-56 rounded-md border border-input bg-background">
                            <pre className="whitespace-pre-wrap p-3 font-mono text-xs">
                              {gitActionFailureDialog.failure.rawMessage}
                            </pre>
                          </ScrollArea>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setGitActionFailureDialog(null)}>
              Close
            </Button>
            {gitActionFailureDialog?.failure.code === "hook_failed" && (
              <Button variant="outline" size="sm" disabled={!activeThreadId} onClick={fixWithAgent}>
                Fix with Agent
              </Button>
            )}
            <Button
              size="sm"
              disabled={!gitActionFailureDialog || isGitActionRunning}
              onClick={retryGitActionFailure}
            >
              {gitActionFailureDialog
                ? resolveGitFailureRetryLabel(gitActionFailureDialog.failure)
                : "Retry"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  );
}
