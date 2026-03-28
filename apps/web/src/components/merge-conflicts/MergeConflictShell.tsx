import type { GitResolvedPullRequest, PrConflictCandidateResolution } from "@okcode/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { Schema } from "effect";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileCode2Icon,
  FolderGit2Icon,
  GitBranchIcon,
  GitMergeIcon,
  InfoIcon,
  LinkIcon,
  LoaderCircleIcon,
  PanelRightIcon,
  ShieldCheckIcon,
  WorkflowIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { openInPreferredEditor } from "~/editorPreferences";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import {
  gitPreparePullRequestThreadMutationOptions,
  gitResolvePullRequestQueryOptions,
  gitStatusQueryOptions,
} from "~/lib/gitReactQuery";
import {
  invalidatePrReviewQueries,
  prReviewConflictsQueryOptions,
  prReviewDashboardQueryOptions,
} from "~/lib/prReviewReactQuery";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { parsePullRequestReference } from "~/pullRequestReference";
import type { Project } from "~/types";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { toastManager } from "~/components/ui/toast";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Input } from "~/components/ui/input";
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
import { SectionHeading, StatPill } from "~/components/review/ReviewChrome";
import { joinPath, projectLabel } from "~/components/review/reviewUtils";
import {
  buildConflictFeedbackPreview,
  buildConflictRecommendation,
  computeActiveStepIndex,
  groupConflictCandidatesByFile,
  humanizeConflictError,
  type MergeConflictFeedbackDisposition,
  pickRecommendedConflictCandidate,
} from "./MergeConflictShell.logic";

const FEEDBACK_DISPOSITION_SCHEMA = Schema.Literals(["accept", "review", "escalate", "blocked"]);
const FEEDBACK_DRAFT_SCHEMA = Schema.Struct({
  disposition: FEEDBACK_DISPOSITION_SCHEMA,
  note: Schema.String,
});

type MergeConflictFeedbackDraft = typeof FEEDBACK_DRAFT_SCHEMA.Type;

const DEFAULT_FEEDBACK_DRAFT: MergeConflictFeedbackDraft = {
  disposition: "accept",
  note: "",
};

const FEEDBACK_DISPOSITION_OPTIONS: ReadonlyArray<{
  value: MergeConflictFeedbackDisposition;
  label: string;
}> = [
  { value: "accept", label: "Accept" },
  { value: "review", label: "Keep in review" },
  { value: "escalate", label: "Escalate" },
  { value: "blocked", label: "Blocked" },
] as const;

interface PreparedWorkspace {
  branch: string;
  cwd: string;
  mode: "local" | "worktree";
  worktreePath: string | null;
}

function pullRequestStateBadgeClassName(state: GitResolvedPullRequest["state"]) {
  switch (state) {
    case "open":
      return "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
    case "merged":
    case "closed":
      return "border-border bg-muted/70 text-foreground";
  }
}

function tonePanelClassName(tone: "neutral" | "success" | "warning") {
  switch (tone) {
    case "success":
      return "border-emerald-500/25 bg-emerald-500/8 text-emerald-900 dark:text-emerald-100";
    case "warning":
      return "border-amber-500/25 bg-amber-500/8 text-amber-950 dark:text-amber-50";
    case "neutral":
      return "border-border/70 bg-background/90 text-foreground";
  }
}

function stepStatusClassName(status: "done" | "active" | "todo" | "blocked") {
  switch (status) {
    case "done":
      return "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
    case "active":
      return "border-foreground/20 bg-foreground/5 text-foreground";
    case "blocked":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "todo":
      return "border-border bg-background text-muted-foreground";
  }
}

function workspaceModeLabel(workspace: PreparedWorkspace | null): string {
  if (!workspace) return "Repo scan";
  return workspace.mode === "worktree" ? "Dedicated worktree" : "Prepared in repo";
}

async function openPathInEditor(targetPath: string) {
  await openInPreferredEditor(ensureNativeApi(), targetPath);
}

function ConflictCandidateButton({
  candidate,
  isRecommended,
  selected,
  onSelect,
}: {
  candidate: PrConflictCandidateResolution;
  isRecommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
        selected
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-border/70 bg-background/90 hover:bg-muted/35",
      )}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm text-foreground">{candidate.title}</p>
            {isRecommended ? (
              <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300">recommended</Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{candidate.path}</p>
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
  );
}

function GuidanceStep({
  detail,
  status,
  title,
}: {
  detail: string;
  status: "done" | "active" | "todo" | "blocked";
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/92 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-sm text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
        <Badge className={stepStatusClassName(status)}>{status}</Badge>
      </div>
    </div>
  );
}

function MergeConflictGuidanceRail({
  activeStepIndex,
  feedbackDraft,
  feedbackPreview,
  isCopied,
  onCopyFeedback,
  onFeedbackDispositionChange,
  onFeedbackNoteChange,
  onOpenSelectedFile,
  preparedWorkspace,
  project,
  resolvedPullRequest,
  selectedCandidate,
  steps,
}: {
  activeStepIndex: number;
  feedbackDraft: MergeConflictFeedbackDraft;
  feedbackPreview: string;
  isCopied: boolean;
  onCopyFeedback: () => void;
  onFeedbackDispositionChange: (disposition: MergeConflictFeedbackDisposition) => void;
  onFeedbackNoteChange: (note: string) => void;
  onOpenSelectedFile: () => void;
  preparedWorkspace: PreparedWorkspace | null;
  project: Project;
  resolvedPullRequest: GitResolvedPullRequest | null;
  selectedCandidate: PrConflictCandidateResolution | null;
  steps: ReadonlyArray<{
    title: string;
    detail: string;
    status: "done" | "active" | "todo" | "blocked";
  }>;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-background/96">
      <div className="border-b border-border/70 px-4 py-4">
        <SectionHeading
          detail="Drive the merge in a fixed order: resolve the link, stage the workspace, review the recommendation, and capture the handoff note."
          eyebrow="Guidance"
          title="Agent conflict workflow"
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4">
          <div className="space-y-3">
            {steps.map((step) => (
              <GuidanceStep
                detail={step.detail}
                key={step.title}
                status={step.status}
                title={step.title}
              />
            ))}
          </div>

          <Collapsible defaultOpen={activeStepIndex >= 3}>
            <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <SectionHeading
                  detail="Keep the final note readable enough to paste into GitHub, Slack, or a handoff doc without rewriting it."
                  eyebrow="Feedback"
                  title="Human-readable conflict note"
                />
                <Badge
                  className={
                    activeStepIndex >= 3
                      ? stepStatusClassName("active")
                      : stepStatusClassName("todo")
                  }
                >
                  {activeStepIndex >= 3 ? "ready" : "locked"}
                </Badge>
              </CollapsibleTrigger>

              <CollapsiblePanel>
                <ToggleGroup
                  className="mt-4 flex w-full flex-wrap gap-2"
                  size="xs"
                  value={[feedbackDraft.disposition]}
                  variant="outline"
                  onValueChange={(values) => {
                    const nextValue = values[values.length - 1];
                    if (
                      nextValue === "accept" ||
                      nextValue === "review" ||
                      nextValue === "escalate" ||
                      nextValue === "blocked"
                    ) {
                      onFeedbackDispositionChange(nextValue);
                    }
                  }}
                >
                  {FEEDBACK_DISPOSITION_OPTIONS.map((option) => (
                    <Toggle key={option.value} value={option.value}>
                      {option.label}
                    </Toggle>
                  ))}
                </ToggleGroup>

                <label className="mt-4 block space-y-2">
                  <span className="text-xs font-medium text-foreground">Operator note</span>
                  <Textarea
                    placeholder="Explain why this resolution is correct, what still needs review, or who should weigh in."
                    rows={5}
                    value={feedbackDraft.note}
                    onChange={(event) => onFeedbackNoteChange(event.target.value)}
                  />
                </label>

                <div className="mt-4 rounded-2xl border border-border/70 bg-muted/24 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">Preview</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Generated from the selected candidate, workspace, and your note.
                      </p>
                    </div>
                    <Button onClick={onCopyFeedback} size="xs" variant="outline">
                      <CopyIcon className="size-3.5" />
                      {isCopied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <pre className="mt-4 whitespace-pre-wrap text-xs leading-6 text-foreground/88">
                    {feedbackPreview}
                  </pre>
                </div>
              </CollapsiblePanel>
            </div>
          </Collapsible>

          <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
            <SectionHeading
              detail="Keep the active file open while you compare the generated patch against the current workspace."
              eyebrow="Workspace"
              title="Focused file context"
            />
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border border-border/70 bg-muted/24 p-3">
                <p className="font-medium text-foreground">{projectLabel(project)}</p>
                <p className="mt-1 text-muted-foreground">{project.cwd}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/24 p-3">
                <p className="font-medium text-foreground">
                  {workspaceModeLabel(preparedWorkspace)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {preparedWorkspace?.cwd ?? project.cwd}
                </p>
              </div>
              {selectedCandidate ? (
                <Button className="w-full" onClick={onOpenSelectedFile} size="sm" variant="outline">
                  <FileCode2Icon className="size-3.5" />
                  Open {selectedCandidate.path}
                </Button>
              ) : null}
              {resolvedPullRequest ? (
                <Button
                  className="w-full"
                  onClick={() =>
                    window.open(resolvedPullRequest.url, "_blank", "noopener,noreferrer")
                  }
                  size="sm"
                  variant="outline"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Open pull request
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export function MergeConflictShell({
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
  const [reference, setReference] = useState("");
  const [referenceDirty, setReferenceDirty] = useState(false);
  const [preparedWorkspace, setPreparedWorkspace] = useState<PreparedWorkspace | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [debouncedReference, referenceDebouncer] = useDebouncedValue(
    reference,
    { wait: 450 },
    (debouncerState) => ({ isPending: debouncerState.isPending }),
  );

  const parsedReference = parsePullRequestReference(reference);
  const parsedDebouncedReference = parsePullRequestReference(debouncedReference);
  const resolvedPullRequestQuery = useQuery(
    gitResolvePullRequestQueryOptions({
      cwd: project.cwd,
      reference: parsedDebouncedReference,
    }),
  );

  const resolvedPullRequest =
    parsedReference !== null && parsedReference === parsedDebouncedReference
      ? (resolvedPullRequestQuery.data?.pullRequest ?? null)
      : null;
  const isResolvingPullRequest =
    parsedReference !== null &&
    resolvedPullRequest === null &&
    (referenceDebouncer.state.isPending ||
      parsedReference !== parsedDebouncedReference ||
      resolvedPullRequestQuery.isPending ||
      resolvedPullRequestQuery.isFetching);
  const activeWorkspaceCwd = preparedWorkspace?.cwd ?? project.cwd;
  const feedbackDraftKey = `okcode:merge-conflicts:feedback:${project.id}:${resolvedPullRequest?.number ?? "none"}`;
  const [feedbackDraft, setFeedbackDraft] = useLocalStorage(
    feedbackDraftKey,
    DEFAULT_FEEDBACK_DRAFT,
    FEEDBACK_DRAFT_SCHEMA,
  );

  const dashboardQuery = useQuery(
    prReviewDashboardQueryOptions({
      cwd: activeWorkspaceCwd,
      prNumber: resolvedPullRequest?.number ?? null,
    }),
  );
  const conflictQuery = useQuery(
    prReviewConflictsQueryOptions({
      cwd: activeWorkspaceCwd,
      prNumber: resolvedPullRequest?.number ?? null,
    }),
  );
  const statusQuery = useQuery(
    gitStatusQueryOptions(resolvedPullRequest ? activeWorkspaceCwd : null),
  );
  const preparePullRequestThreadMutation = useMutation(
    gitPreparePullRequestThreadMutationOptions({ cwd: project.cwd, queryClient }),
  );
  const applyConflictResolutionMutation = useMutation({
    mutationFn: async (input: { candidateId: string; cwd: string; prNumber: number }) => {
      const confirmed = await ensureNativeApi().dialogs.confirm(
        "Apply this merge-conflict resolution to the current workspace?",
      );
      if (!confirmed) return null;
      return ensureNativeApi().prReview.applyConflictResolution(input);
    },
    onSuccess: async (result, variables) => {
      await Promise.all([
        invalidatePrReviewQueries(queryClient, variables.cwd, variables.prNumber),
        queryClient.invalidateQueries({ queryKey: ["git", "status", variables.cwd] }),
      ]);
      if (result) {
        toastManager.add({
          type: "success",
          title: "Conflict resolution applied",
          description: result.summary,
        });
      }
    },
  });

  const { copyToClipboard, isCopied } = useCopyToClipboard({
    onCopy: () =>
      toastManager.add({
        type: "success",
        title: "Conflict brief copied",
      }),
    onError: (error) =>
      toastManager.add({
        type: "error",
        title: "Failed to copy conflict brief",
        description: error.message,
      }),
  });

  useEffect(() => {
    setReference("");
    setReferenceDirty(false);
    setPreparedWorkspace(null);
    setSelectedCandidateId(null);
    setInspectorOpen(false);
  }, [project.id]);

  useEffect(() => {
    setPreparedWorkspace(null);
    setSelectedCandidateId(null);
  }, [resolvedPullRequest?.number]);

  const recommendedCandidate = pickRecommendedConflictCandidate(conflictQuery.data);
  const candidateGroups = useMemo(
    () => groupConflictCandidatesByFile(conflictQuery.data?.candidates ?? []),
    [conflictQuery.data?.candidates],
  );
  const selectedCandidate =
    conflictQuery.data?.candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    null;

  useEffect(() => {
    const availableCandidates = conflictQuery.data?.candidates ?? [];
    if (availableCandidates.length === 0) {
      if (selectedCandidateId !== null) {
        setSelectedCandidateId(null);
      }
      return;
    }

    if (
      selectedCandidateId &&
      availableCandidates.some((candidate) => candidate.id === selectedCandidateId)
    ) {
      return;
    }

    setSelectedCandidateId(recommendedCandidate?.id ?? availableCandidates[0]!.id);
  }, [conflictQuery.data?.candidates, recommendedCandidate?.id, selectedCandidateId]);

  const recommendation = buildConflictRecommendation({
    analysis: conflictQuery.data,
    hasPreparedWorkspace: preparedWorkspace !== null,
  });
  const feedbackPreview = buildConflictFeedbackPreview({
    disposition: feedbackDraft.disposition,
    note: feedbackDraft.note,
    pullRequest: resolvedPullRequest,
    selectedCandidate,
    workspaceLabel: `${workspaceModeLabel(preparedWorkspace)} · ${activeWorkspaceCwd}`,
  });
  const validationMessage = !referenceDirty
    ? null
    : reference.trim().length === 0
      ? "Paste a GitHub pull request URL."
      : parsedReference === null
        ? "Use a GitHub pull request URL."
        : null;
  const resolveErrorMessage =
    validationMessage ??
    (resolvedPullRequest === null && resolvedPullRequestQuery.isError
      ? resolvedPullRequestQuery.error instanceof Error
        ? resolvedPullRequestQuery.error.message
        : "Failed to resolve pull request."
      : null);
  const panelErrorMessage =
    preparePullRequestThreadMutation.error instanceof Error
      ? preparePullRequestThreadMutation.error.message
      : applyConflictResolutionMutation.error instanceof Error
        ? applyConflictResolutionMutation.error.message
        : dashboardQuery.error instanceof Error
          ? dashboardQuery.error.message
          : conflictQuery.error instanceof Error
            ? conflictQuery.error.message
            : null;
  const steps = [
    {
      title: "Resolve pull request link",
      detail: resolvedPullRequest
        ? `PR #${resolvedPullRequest.number} is resolved against ${projectLabel(project)}.`
        : "Paste a GitHub pull request URL to fetch metadata and conflict status.",
      status: resolvedPullRequest
        ? ("done" as const)
        : isResolvingPullRequest
          ? ("active" as const)
          : ("todo" as const),
    },
    {
      title: "Prepare local conflict workspace",
      detail: preparedWorkspace
        ? `${workspaceModeLabel(preparedWorkspace)} is active on ${preparedWorkspace.branch}.`
        : recommendation.title === "Prepare a local workspace to continue."
          ? "Generate a local checkout or dedicated worktree to unlock file-level suggestions."
          : "Use this only when GitHub reports conflicts or you want to reproduce markers locally.",
      status: preparedWorkspace
        ? ("done" as const)
        : recommendation.title === "Prepare a local workspace to continue."
          ? ("blocked" as const)
          : resolvedPullRequest
            ? ("todo" as const)
            : ("todo" as const),
    },
    {
      title: "Review the recommended resolution",
      detail: selectedCandidate
        ? `${selectedCandidate.title} is selected for ${selectedCandidate.path}.`
        : "Select a candidate patch once one is available, or keep the merge manual if none are safe.",
      status: selectedCandidate
        ? ("done" as const)
        : conflictQuery.data?.status === "conflicted"
          ? ("blocked" as const)
          : resolvedPullRequest
            ? ("todo" as const)
            : ("todo" as const),
    },
    {
      title: "Capture the operator note",
      detail:
        feedbackDraft.note.trim().length > 0
          ? "The human-readable handoff note is ready to copy."
          : "Write down why the selected side is correct or why the conflict needs escalation.",
      status:
        feedbackDraft.note.trim().length > 0
          ? ("done" as const)
          : selectedCandidate
            ? ("active" as const)
            : ("todo" as const),
    },
  ] as const;

  const openSelectedCandidateFile = () => {
    if (!selectedCandidate) return;
    void openPathInEditor(joinPath(activeWorkspaceCwd, selectedCandidate.path));
  };

  const handlePrepareWorkspace = async (mode: "local" | "worktree") => {
    if (!resolvedPullRequest || !parsedReference) return;
    const result = await preparePullRequestThreadMutation.mutateAsync({
      reference: parsedReference,
      mode,
    });
    const nextWorkspace: PreparedWorkspace = {
      branch: result.branch,
      cwd: result.worktreePath ?? project.cwd,
      mode,
      worktreePath: result.worktreePath,
    };
    setPreparedWorkspace(nextWorkspace);
    await Promise.all([
      invalidatePrReviewQueries(queryClient, nextWorkspace.cwd, resolvedPullRequest.number),
      queryClient.invalidateQueries({ queryKey: ["git", "status", nextWorkspace.cwd] }),
    ]);
    toastManager.add({
      type: "success",
      title: mode === "worktree" ? "Dedicated worktree ready" : "Repository workspace ready",
      description:
        mode === "worktree"
          ? `Prepared ${result.worktreePath ?? project.cwd} for PR #${resolvedPullRequest.number}.`
          : `Prepared ${project.cwd} for PR #${resolvedPullRequest.number}.`,
    });
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <div className="min-h-0 border-e border-border/70 bg-background/96">
            <ScrollArea className="h-full">
              <div className="space-y-4 px-4 py-4">
                <SectionHeading
                  detail="Resolve conflicts from a GitHub PR link, then let OK Code guide the safest next action."
                  eyebrow="Intake"
                  title="Conflict source"
                />

                <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                  <label className="block space-y-2">
                    <span className="text-xs font-medium text-foreground">Repository</span>
                    <Select
                      value={selectedProjectId ?? project.id}
                      onValueChange={(value) => onProjectChange(String(value))}
                    >
                      <SelectTrigger aria-label="Conflict project" size="sm">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectPopup>
                        {projects.map((entry) => (
                          <SelectItem hideIndicator key={entry.id} value={entry.id}>
                            {projectLabel(entry)}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  </label>

                  <div className="mt-4 rounded-2xl border border-border/70 bg-muted/24 p-3">
                    <p className="font-medium text-sm text-foreground">{projectLabel(project)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{project.cwd}</p>
                  </div>

                  <label className="mt-4 block space-y-2">
                    <span className="text-xs font-medium text-foreground">Pull request link</span>
                    <Input
                      placeholder="https://github.com/owner/repo/pull/42"
                      value={reference}
                      onChange={(event) => {
                        setReferenceDirty(true);
                        setReference(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (!isResolvingPullRequest && resolvedPullRequest) {
                          void handlePrepareWorkspace("local");
                        }
                      }}
                    />
                  </label>

                  {isResolvingPullRequest ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Spinner className="size-3.5" />
                      Resolving pull request...
                    </div>
                  ) : null}

                  {resolveErrorMessage ? (
                    <p className="mt-3 text-xs text-destructive">{resolveErrorMessage}</p>
                  ) : null}
                </div>

                {resolvedPullRequest ? (
                  <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm text-foreground">
                          {resolvedPullRequest.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          #{resolvedPullRequest.number} · {resolvedPullRequest.headBranch} to{" "}
                          {resolvedPullRequest.baseBranch}
                        </p>
                      </div>
                      <Badge className={pullRequestStateBadgeClassName(resolvedPullRequest.state)}>
                        {resolvedPullRequest.state}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        disabled={preparePullRequestThreadMutation.isPending}
                        onClick={() => {
                          void handlePrepareWorkspace("local");
                        }}
                        size="sm"
                        variant={
                          recommendation.recommendedAction === "prepare-local"
                            ? "default"
                            : "outline"
                        }
                      >
                        <FolderGit2Icon className="size-3.5" />
                        Prepare in repo
                      </Button>
                      <Button
                        disabled={preparePullRequestThreadMutation.isPending}
                        onClick={() => {
                          void handlePrepareWorkspace("worktree");
                        }}
                        size="sm"
                        variant={
                          recommendation.recommendedAction === "prepare-worktree"
                            ? "default"
                            : "outline"
                        }
                      >
                        <GitBranchIcon className="size-3.5" />
                        Prepare worktree
                      </Button>
                      <Button
                        onClick={() =>
                          window.open(resolvedPullRequest.url, "_blank", "noopener,noreferrer")
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <ExternalLinkIcon className="size-3.5" />
                        Open PR
                      </Button>
                    </div>
                  </div>
                ) : null}

                {panelErrorMessage
                  ? (() => {
                      const { summary, detail } = humanizeConflictError(panelErrorMessage);
                      return (
                        <Alert variant="error">
                          <AlertTriangleIcon />
                          <AlertTitle>{summary}</AlertTitle>
                          <AlertDescription>{detail}</AlertDescription>
                        </Alert>
                      );
                    })()
                  : null}

                <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                  <SectionHeading
                    detail="The active workspace is what OK Code inspects for local conflict markers and applies candidate patches against."
                    eyebrow="Workspace"
                    title="Current execution target"
                  />
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="rounded-2xl border border-border/70 bg-muted/24 p-3">
                      <p className="font-medium text-foreground">
                        {workspaceModeLabel(preparedWorkspace)}
                      </p>
                      <p className="mt-1 break-all text-muted-foreground">{activeWorkspaceCwd}</p>
                    </div>
                    {preparedWorkspace ? (
                      <div className="rounded-2xl border border-border/70 bg-muted/24 p-3">
                        <p className="font-medium text-foreground">Prepared branch</p>
                        <p className="mt-1 text-muted-foreground">{preparedWorkspace.branch}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Using a repo-level scan until you prepare a dedicated conflict workspace.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>

          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Conflict workspace
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="truncate font-medium text-foreground">
                    {projectLabel(project)}
                  </span>
                  {resolvedPullRequest ? (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="truncate text-muted-foreground">
                        PR #{resolvedPullRequest.number}
                      </span>
                    </>
                  ) : null}
                  {preparedWorkspace ? (
                    <>
                      <span className="text-muted-foreground">/</span>
                      <span className="truncate text-muted-foreground">
                        {workspaceModeLabel(preparedWorkspace)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              {isInspectorSheet ? (
                <Button onClick={() => setInspectorOpen(true)} size="sm" variant="outline">
                  <PanelRightIcon className="size-3.5" />
                  Guidance
                </Button>
              ) : null}
            </div>

            {!resolvedPullRequest ? (
              <div className="flex h-full items-center justify-center px-6">
                <div className="max-w-lg space-y-3 text-center">
                  <LinkIcon className="mx-auto size-8 text-muted-foreground/30" />
                  <p className="font-medium text-sm text-foreground">Paste a pull request link</p>
                  <p className="text-sm text-muted-foreground">
                    This panel is intentionally narrow: it resolves one GitHub PR link, checks
                    whether conflicts exist, and walks you through the safest conflict resolution
                    path.
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-5 px-5 py-5">
                  <SectionHeading
                    detail="Review the merge state, inspect candidate patches, and confirm the safest resolution path."
                    eyebrow="Conflict analysis"
                    title="Conflict analysis"
                  />

                  <div className="flex flex-wrap gap-2">
                    <StatPill
                      icon={<LinkIcon className="size-3.5" />}
                      label="PR"
                      value={resolvedPullRequest ? `#${resolvedPullRequest.number}` : "none"}
                    />
                    <StatPill
                      icon={<GitMergeIcon className="size-3.5" />}
                      label="Status"
                      value={conflictQuery.data?.status ?? "pending"}
                    />
                    <StatPill
                      icon={<WorkflowIcon className="size-3.5" />}
                      label="Step"
                      value={`${steps.filter((s) => s.status === "done").length}/${steps.length}`}
                    />
                  </div>

                  <div
                    className={cn(
                      "rounded-3xl border p-4",
                      tonePanelClassName(recommendation.tone),
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {recommendation.tone === "success" ? (
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                      ) : recommendation.tone === "warning" ? (
                        <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                      ) : (
                        <InfoIcon className="mt-0.5 size-4 shrink-0" />
                      )}
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{recommendation.title}</p>
                        <p className="text-sm opacity-85">{recommendation.detail}</p>
                      </div>
                    </div>
                  </div>

                  {dashboardQuery.isFetching || conflictQuery.isFetching ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/92 px-4 py-3 text-sm text-muted-foreground">
                      <LoaderCircleIcon className="size-4 animate-spin" />
                      Refreshing pull request status and conflict analysis...
                    </div>
                  ) : null}

                  {conflictQuery.data?.status === "clean" ? (
                    <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/8 p-5">
                      <div className="flex items-start gap-3">
                        <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                        <div className="space-y-2">
                          <p className="font-medium text-sm text-emerald-900 dark:text-emerald-100">
                            No merge conflicts are blocking this pull request.
                          </p>
                          <p className="text-sm text-emerald-900/80 dark:text-emerald-100/80">
                            {conflictQuery.data.summary}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {conflictQuery.data?.status === "conflicted" ? (
                    <div
                      className={cn(
                        "grid gap-4",
                        candidateGroups.length > 0 &&
                          "2xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]",
                      )}
                    >
                      <div className="space-y-4">
                        {candidateGroups.length > 0 ? (
                          candidateGroups.map((group) => (
                            <div
                              className="rounded-3xl border border-border/70 bg-background/92 p-4"
                              key={group.path}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-sm text-foreground">
                                    {group.path}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {group.recommendedCandidate?.confidence === "safe"
                                      ? "Deterministic candidate available."
                                      : "Requires manual judgment."}
                                  </p>
                                </div>
                                <Button
                                  onClick={() => {
                                    void openPathInEditor(joinPath(activeWorkspaceCwd, group.path));
                                  }}
                                  size="xs"
                                  variant="outline"
                                >
                                  <FileCode2Icon className="size-3.5" />
                                  Open file
                                </Button>
                              </div>
                              <div className="mt-4 space-y-3">
                                {group.candidates.map((candidate) => (
                                  <ConflictCandidateButton
                                    candidate={candidate}
                                    isRecommended={candidate.id === group.recommendedCandidate?.id}
                                    key={candidate.id}
                                    selected={selectedCandidateId === candidate.id}
                                    onSelect={() => setSelectedCandidateId(candidate.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <Empty>
                            <EmptyMedia variant="icon">
                              <WorkflowIcon />
                            </EmptyMedia>
                            <EmptyHeader>
                              <EmptyTitle>No candidates yet</EmptyTitle>
                              <EmptyDescription>
                                {preparedWorkspace
                                  ? "OK Code could not derive a safe patch from the local markers. Resolve the conflict manually in your editor."
                                  : "Prepare a local workspace from the intake panel to let OK Code inspect file-level conflict markers."}
                              </EmptyDescription>
                            </EmptyHeader>
                            {!preparedWorkspace && resolvedPullRequest ? (
                              <Button
                                disabled={preparePullRequestThreadMutation.isPending}
                                onClick={() => {
                                  void handlePrepareWorkspace("worktree");
                                }}
                                size="sm"
                              >
                                <GitBranchIcon className="size-3.5" />
                                Prepare worktree
                              </Button>
                            ) : null}
                          </Empty>
                        )}
                      </div>

                      {candidateGroups.length > 0 ? (
                        <div className="min-h-[420px] rounded-[28px] border border-border/70 bg-background/94">
                          <div className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
                            <div>
                              <p className="font-medium text-sm text-foreground">
                                {selectedCandidate?.title ?? "No candidate selected"}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Review the exact patch OK Code wants to apply before you change the
                                workspace.
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedCandidate ? (
                                <Button
                                  onClick={openSelectedCandidateFile}
                                  size="xs"
                                  variant="outline"
                                >
                                  <FileCode2Icon className="size-3.5" />
                                  Open file
                                </Button>
                              ) : null}
                              {selectedCandidate ? (
                                <Button
                                  disabled={applyConflictResolutionMutation.isPending}
                                  onClick={() => {
                                    void applyConflictResolutionMutation.mutateAsync({
                                      candidateId: selectedCandidate.id,
                                      cwd: activeWorkspaceCwd,
                                      prNumber: resolvedPullRequest.number,
                                    });
                                  }}
                                  size="xs"
                                >
                                  <ShieldCheckIcon className="size-3.5" />
                                  Apply candidate
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div className="min-h-[320px] rounded-3xl border border-border/70 bg-muted/22 p-4">
                              {selectedCandidate ? (
                                <pre className="overflow-auto whitespace-pre-wrap text-xs leading-6 text-foreground/88">
                                  {selectedCandidate.previewPatch}
                                </pre>
                              ) : (
                                <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                                  Select a candidate to preview the merge patch.
                                </div>
                              )}
                            </div>

                            <div className="space-y-4">
                              <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-3xl border border-border/70 bg-background/92 px-4 py-3">
                                  <p className="font-medium text-sm text-foreground">
                                    Workspace details
                                  </p>
                                  <ChevronDownIcon className="size-4 text-muted-foreground transition-transform [[data-open]_&]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsiblePanel>
                                  <div className="mt-2 space-y-4">
                                    <div className="rounded-3xl border border-border/70 bg-background/92 p-4">
                                      <div className="space-y-3 text-sm text-muted-foreground">
                                        <div>
                                          <p className="text-foreground">Branch</p>
                                          <p>
                                            {preparedWorkspace?.branch ??
                                              statusQuery.data?.branch ??
                                              "unknown"}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-foreground">Local conflicts</p>
                                          <p>
                                            {statusQuery.data
                                              ? statusQuery.data.conflictedFiles.length
                                              : "?"}{" "}
                                            file(s)
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-foreground">Working tree changes</p>
                                          <p>
                                            {statusQuery.data?.hasWorkingTreeChanges
                                              ? "Present"
                                              : "Clean or unavailable"}
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="rounded-3xl border border-border/70 bg-background/92 p-4">
                                      <p className="font-medium text-sm text-foreground">
                                        Agent note
                                      </p>
                                      <p className="mt-3 text-sm text-muted-foreground">
                                        {selectedCandidate
                                          ? selectedCandidate.confidence === "safe"
                                            ? "This candidate is deterministic. Review the resulting diff after apply, but it is the lowest-risk path OK Code could infer."
                                            : "This candidate is only a starting point. Keep the handoff note explicit and verify the merged intent before you commit."
                                          : "No candidate is selected. OK Code will not mutate the workspace until you review a concrete patch."}
                                      </p>
                                    </div>
                                  </div>
                                </CollapsiblePanel>
                              </Collapsible>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
            )}
          </div>

          {!isInspectorSheet ? (
            <div className="min-h-0 border-s border-border/70">
              <MergeConflictGuidanceRail
                activeStepIndex={computeActiveStepIndex(steps)}
                feedbackDraft={feedbackDraft}
                feedbackPreview={feedbackPreview}
                isCopied={isCopied}
                onCopyFeedback={() => copyToClipboard(feedbackPreview, undefined)}
                onFeedbackDispositionChange={(disposition) =>
                  setFeedbackDraft((current) => ({ ...current, disposition }))
                }
                onFeedbackNoteChange={(note) =>
                  setFeedbackDraft((current) => ({
                    ...current,
                    note,
                  }))
                }
                onOpenSelectedFile={openSelectedCandidateFile}
                preparedWorkspace={preparedWorkspace}
                project={project}
                resolvedPullRequest={resolvedPullRequest}
                selectedCandidate={selectedCandidate}
                steps={steps}
              />
            </div>
          ) : null}
        </div>
      </div>

      {isInspectorSheet ? (
        <Sheet onOpenChange={setInspectorOpen} open={inspectorOpen}>
          <SheetPopup side="right" variant="inset">
            <SheetHeader>
              <SheetTitle>Guidance</SheetTitle>
              <SheetDescription>
                Agent steps, operator notes, and workspace context for the active merge conflict.
              </SheetDescription>
            </SheetHeader>
            <SheetPanel className="p-0">
              <MergeConflictGuidanceRail
                activeStepIndex={computeActiveStepIndex(steps)}
                feedbackDraft={feedbackDraft}
                feedbackPreview={feedbackPreview}
                isCopied={isCopied}
                onCopyFeedback={() => copyToClipboard(feedbackPreview, undefined)}
                onFeedbackDispositionChange={(disposition) =>
                  setFeedbackDraft((current) => ({ ...current, disposition }))
                }
                onFeedbackNoteChange={(note) =>
                  setFeedbackDraft((current) => ({
                    ...current,
                    note,
                  }))
                }
                onOpenSelectedFile={openSelectedCandidateFile}
                preparedWorkspace={preparedWorkspace}
                project={project}
                resolvedPullRequest={resolvedPullRequest}
                selectedCandidate={selectedCandidate}
                steps={steps}
              />
            </SheetPanel>
          </SheetPopup>
        </Sheet>
      ) : null}
    </>
  );
}
