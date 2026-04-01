import { memo, useState, useCallback, useRef, useEffect, useMemo } from "react";
import { type TimestampFormat } from "../appSettings";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import ChatMarkdown from "./ChatMarkdown";
import { ChevronDownIcon, ChevronRightIcon, EllipsisIcon, PanelRightCloseIcon } from "lucide-react";
import type { ActivePlanState, LatestProposedPlanState, PendingUserInput } from "../session-logic";
import {
  proposedPlanTitle,
  buildProposedPlanMarkdownFilename,
  normalizePlanMarkdownForExport,
  downloadPlanAsTextFile,
  stripDisplayedPlanMarkdown,
} from "../proposedPlan";
import { extractPlanChecklistItems } from "../planChecklist";
import PlanChecklist, { type PlanChecklistItemData } from "./PlanChecklist";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";
import { readNativeApi } from "~/nativeApi";
import { toastManager } from "./ui/toast";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { getLocalStorageItem, setLocalStorageItem } from "~/hooks/useLocalStorage";
import { type PendingUserInputProgress } from "../pendingUserInput";
import { cn } from "~/lib/utils";
import { Schema } from "effect";

const PLAN_SIDEBAR_WIDTH_STORAGE_KEY = "plan_sidebar_width";
const PLAN_SIDEBAR_DEFAULT_WIDTH = 340;
const PLAN_SIDEBAR_MIN_WIDTH = 260;
const PLAN_SIDEBAR_MAX_WIDTH = 800;

interface PlanSidebarProps {
  activePlan: ActivePlanState | null;
  activeProposedPlan: LatestProposedPlanState | null;
  markdownCwd: string | undefined;
  workspaceRoot: string | undefined;
  timestampFormat: TimestampFormat;
  activePendingUserInput: PendingUserInput | null;
  activePendingProgress: PendingUserInputProgress | null;
  activePendingIsResponding: boolean;
  onSelectPendingUserInputOption: (questionId: string, optionLabel: string) => void;
  onAdvancePendingUserInput: () => void;
  onFocusComposer: () => void;
  onClose: () => void;
}

function usePlanProgress(steps: ActivePlanState["steps"] | undefined) {
  return useMemo(() => {
    if (!steps || steps.length === 0) return null;
    const completed = steps.filter((s) => s.status === "completed").length;
    return { completed, total: steps.length };
  }, [steps]);
}

function clampWidth(width: number): number {
  return Math.max(PLAN_SIDEBAR_MIN_WIDTH, Math.min(width, PLAN_SIDEBAR_MAX_WIDTH));
}

function useResizablePlanSidebar() {
  const [width, setWidth] = useState<number>(() => {
    const stored = getLocalStorageItem(PLAN_SIDEBAR_WIDTH_STORAGE_KEY, Schema.Finite);
    return stored !== null ? clampWidth(stored) : PLAN_SIDEBAR_DEFAULT_WIDTH;
  });
  const resizeRef = useRef<{
    startX: number;
    startWidth: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);
  const railRef = useRef<HTMLButtonElement | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      resizeRef.current = {
        startX: event.clientX,
        startWidth: width,
        pointerId: event.pointerId,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = resizeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    // Dragging left increases width (right-side sidebar)
    const delta = state.startX - event.clientX;
    if (Math.abs(delta) > 2) {
      state.moved = true;
    }
    const newWidth = clampWidth(state.startWidth + delta);
    setWidth(newWidth);
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = resizeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const delta = state.startX - event.clientX;
    const finalWidth = clampWidth(state.startWidth + delta);
    setLocalStorageItem(PLAN_SIDEBAR_WIDTH_STORAGE_KEY, finalWidth, Schema.Finite);
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    const state = resizeRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, []);

  return {
    width,
    railRef,
    railProps: {
      ref: railRef,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
  };
}

function findFeedbackStepIndex(
  steps: ActivePlanState["steps"] | undefined,
  feedbackRequested: boolean,
): number | null {
  if (!feedbackRequested || !steps || steps.length === 0) {
    return null;
  }

  const inProgressIndex = steps.findIndex((step) => step.status === "inProgress");
  if (inProgressIndex !== -1) {
    return inProgressIndex;
  }

  const nextPendingIndex = steps.findIndex((step) => step.status !== "completed");
  if (nextPendingIndex !== -1) {
    return nextPendingIndex;
  }

  return steps.length - 1;
}

const PlanSidebar = memo(function PlanSidebar({
  activePlan,
  activeProposedPlan,
  markdownCwd,
  workspaceRoot,
  activePendingUserInput,
  activePendingProgress,
  activePendingIsResponding,
  onSelectPendingUserInputOption,
  onAdvancePendingUserInput,
  onFocusComposer,
  onClose,
}: PlanSidebarProps) {
  const hasActiveSteps = (activePlan?.steps.length ?? 0) > 0;
  const [proposedPlanExpanded, setProposedPlanExpanded] = useState(false);
  const [isSavingToWorkspace, setIsSavingToWorkspace] = useState(false);
  const pendingAdvanceTimerRef = useRef<number | null>(null);
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const { width, railProps } = useResizablePlanSidebar();
  const progress = usePlanProgress(activePlan?.steps);

  const planMarkdown = activeProposedPlan?.planMarkdown ?? null;
  const displayedPlanMarkdown = planMarkdown ? stripDisplayedPlanMarkdown(planMarkdown) : null;
  const planTitle = planMarkdown ? proposedPlanTitle(planMarkdown) : null;
  const feedbackQuestion = activePendingProgress?.activeQuestion ?? null;
  const feedbackStepIndex = useMemo(
    () => findFeedbackStepIndex(activePlan?.steps, activePendingUserInput !== null),
    [activePendingUserInput, activePlan?.steps],
  );
  const feedbackStep =
    feedbackStepIndex !== null && activePlan?.steps[feedbackStepIndex]
      ? activePlan.steps[feedbackStepIndex]
      : null;

  // Derive checklist items: prefer live execution steps; fall back to markdown extraction.
  // Always normalised to { text, status } for the PlanChecklist component.
  const checklistItems = useMemo<PlanChecklistItemData[]>(() => {
    if (hasActiveSteps && activePlan) {
      return activePlan.steps.map((step, index) => {
        const isFeedbackStep =
          feedbackQuestion !== null && feedbackStepIndex !== null && index === feedbackStepIndex;
        return {
          text: step.step,
          status: step.status,
          ...(isFeedbackStep
            ? {
                note: activePendingIsResponding
                  ? "Submitting your answer."
                  : activePendingProgress?.usingCustomAnswer
                    ? "Custom answer drafted in the composer. Submit when ready."
                    : "Waiting for your feedback to continue.",
                statusText: activePendingIsResponding ? "Sending" : "Needs input",
                statusTone: "warning" as const,
              }
            : {}),
        };
      });
    }
    if (planMarkdown) {
      const extracted = extractPlanChecklistItems(planMarkdown);
      if (extracted.length > 0) {
        return extracted.map((item) => ({
          text: item.text,
          status: item.completed ? ("completed" as const) : ("pending" as const),
        }));
      }
    }
    return [];
  }, [
    hasActiveSteps,
    activePlan,
    planMarkdown,
    feedbackQuestion,
    feedbackStepIndex,
    activePendingIsResponding,
    activePendingProgress?.usingCustomAnswer,
  ]);

  const hasChecklist = checklistItems.length > 0;

  // Auto-expand markdown when there are no checklist items and no active steps.
  useEffect(() => {
    if (!hasChecklist && planMarkdown) {
      setProposedPlanExpanded(true);
    }
  }, [hasChecklist, planMarkdown]);

  useEffect(() => {
    return () => {
      if (pendingAdvanceTimerRef.current !== null) {
        window.clearTimeout(pendingAdvanceTimerRef.current);
      }
    };
  }, []);

  const handleCopyPlan = useCallback(() => {
    if (!planMarkdown) return;
    copyToClipboard(planMarkdown);
  }, [planMarkdown, copyToClipboard]);

  const handleDownload = useCallback(() => {
    if (!planMarkdown) return;
    const filename = buildProposedPlanMarkdownFilename(planMarkdown);
    downloadPlanAsTextFile(filename, normalizePlanMarkdownForExport(planMarkdown));
  }, [planMarkdown]);

  const handleSaveToWorkspace = useCallback(() => {
    const api = readNativeApi();
    if (!api || !workspaceRoot || !planMarkdown) return;
    const filename = buildProposedPlanMarkdownFilename(planMarkdown);
    setIsSavingToWorkspace(true);
    void api.projects
      .writeFile({
        cwd: workspaceRoot,
        relativePath: filename,
        contents: normalizePlanMarkdownForExport(planMarkdown),
      })
      .then((result) => {
        toastManager.add({
          type: "success",
          title: "Plan saved",
          description: result.relativePath,
        });
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Could not save plan",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      })
      .then(
        () => setIsSavingToWorkspace(false),
        () => setIsSavingToWorkspace(false),
      );
  }, [planMarkdown, workspaceRoot]);

  const handleSelectPendingOption = useCallback(
    (questionId: string, optionLabel: string) => {
      onSelectPendingUserInputOption(questionId, optionLabel);
      if (pendingAdvanceTimerRef.current !== null) {
        window.clearTimeout(pendingAdvanceTimerRef.current);
      }
      pendingAdvanceTimerRef.current = window.setTimeout(() => {
        pendingAdvanceTimerRef.current = null;
        onAdvancePendingUserInput();
      }, 200);
    },
    [onAdvancePendingUserInput, onSelectPendingUserInputOption],
  );

  const handlePendingAction = useCallback(() => {
    if (activePendingProgress?.usingCustomAnswer && activePendingProgress.canAdvance) {
      onAdvancePendingUserInput();
      return;
    }
    onFocusComposer();
  }, [
    activePendingProgress?.canAdvance,
    activePendingProgress?.usingCustomAnswer,
    onAdvancePendingUserInput,
    onFocusComposer,
  ]);

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-border/70 bg-card/50"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <button
        type="button"
        aria-label="Resize plan sidebar"
        title="Drag to resize"
        className="absolute inset-y-0 left-0 z-20 w-1 -translate-x-1/2 cursor-col-resize touch-none select-none hover:bg-primary/20 active:bg-primary/30 transition-colors"
        {...railProps}
      />
      {/* Header */}
      <div className="flex shrink-0 flex-col border-b border-border/60 px-3">
        <div className="flex h-12 items-center justify-between">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground/90">
            {planTitle ?? "Plan"}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {planMarkdown ? (
              <Menu>
                <MenuTrigger
                  render={
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      className="text-muted-foreground/50 hover:text-foreground/70"
                      aria-label="Plan actions"
                    />
                  }
                >
                  <EllipsisIcon className="size-3.5" />
                </MenuTrigger>
                <MenuPopup align="end">
                  <MenuItem onClick={handleCopyPlan}>
                    {isCopied ? "Copied!" : "Copy to clipboard"}
                  </MenuItem>
                  <MenuItem onClick={handleDownload}>Download as markdown</MenuItem>
                  <MenuItem
                    onClick={handleSaveToWorkspace}
                    disabled={!workspaceRoot || isSavingToWorkspace}
                  >
                    Save to workspace
                  </MenuItem>
                </MenuPopup>
              </Menu>
            ) : null}
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={onClose}
              aria-label="Close plan sidebar"
              className="text-muted-foreground/50 hover:text-foreground/70"
            >
              <PanelRightCloseIcon className="size-3.5" />
            </Button>
          </div>
        </div>
        {progress ? (
          <div className="flex items-center gap-2.5 pb-2.5">
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
              <div
                className="h-full rounded-full bg-emerald-500/70 transition-all duration-500 ease-out"
                style={{
                  width: `${Math.round((progress.completed / progress.total) * 100)}%`,
                }}
              />
            </div>
            <span
              className={cn(
                "shrink-0 text-[11px] tabular-nums",
                progress.completed > 0
                  ? "text-emerald-700/80 dark:text-emerald-300/80"
                  : "text-muted-foreground/50",
              )}
            >
              {progress.completed === progress.total
                ? "Done"
                : `${progress.completed}/${progress.total} done`}
            </span>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3 space-y-4">
          {/* Explanation */}
          {activePlan?.explanation ? (
            <div className="rounded-xl border border-border/60 bg-background/40 p-3">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground/55 uppercase">
                Latest Note
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground/85">
                {activePlan.explanation}
              </p>
            </div>
          ) : null}

          {activePendingUserInput && feedbackQuestion ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge size="sm" variant="warning">
                  {feedbackStepIndex !== null ? `Step ${feedbackStepIndex + 1}` : "Plan input"}
                </Badge>
                {activePendingUserInput.questions.length > 1 ? (
                  <Badge size="sm" variant="outline">
                    {(activePendingProgress?.questionIndex ?? 0) + 1}/
                    {activePendingUserInput.questions.length} questions
                  </Badge>
                ) : null}
                <span className="text-[10px] font-semibold tracking-widest text-amber-900/80 uppercase dark:text-amber-200/80">
                  {feedbackQuestion.header}
                </span>
              </div>
              {feedbackStep ? (
                <p className="mt-2 text-[12px] font-medium text-foreground/90">
                  {feedbackStep.step}
                </p>
              ) : null}
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">
                {feedbackQuestion.question}
              </p>
              <div className="mt-3 space-y-1.5">
                {feedbackQuestion.options.map((option, index) => {
                  const isSelected =
                    !activePendingProgress?.usingCustomAnswer &&
                    activePendingProgress?.selectedOptionLabel === option.label;
                  return (
                    <button
                      key={`${feedbackQuestion.id}:${option.label}`}
                      type="button"
                      disabled={activePendingIsResponding}
                      onClick={() => handleSelectPendingOption(feedbackQuestion.id, option.label)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all duration-150",
                        isSelected
                          ? "border-amber-400/40 bg-amber-400/10 text-foreground"
                          : "border-transparent bg-background/45 text-foreground/80 hover:border-amber-300/20 hover:bg-background/70",
                        activePendingIsResponding && "cursor-not-allowed opacity-50",
                      )}
                    >
                      {index < 9 ? (
                        <kbd
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-medium tabular-nums transition-colors duration-150",
                            isSelected
                              ? "bg-amber-400/20 text-amber-900 dark:text-amber-200"
                              : "bg-background/60 text-muted-foreground/60 group-hover:bg-background/80",
                          )}
                        >
                          {index + 1}
                        </kbd>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{option.label}</span>
                        {option.description && option.description !== option.label ? (
                          <span className="ml-2 text-xs text-muted-foreground/70">
                            {option.description}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] leading-relaxed text-amber-900/70 dark:text-amber-100/75">
                  {activePendingProgress?.usingCustomAnswer
                    ? "Custom answer ready in the composer."
                    : "Choose an option here or type a custom answer in the composer."}
                </p>
                <Button
                  size="xs"
                  variant="outline"
                  type="button"
                  disabled={activePendingIsResponding}
                  onClick={handlePendingAction}
                >
                  {activePendingProgress?.usingCustomAnswer && activePendingProgress.canAdvance
                    ? activePendingProgress.isLastQuestion
                      ? "Submit answer"
                      : "Next question"
                    : "Use composer"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Checklist (primary view) */}
          {hasChecklist ? <PlanChecklist items={checklistItems} live={hasActiveSteps} /> : null}

          {/* Proposed Plan Markdown (collapsible detail) */}
          {planMarkdown ? (
            <div className="space-y-2">
              <button
                type="button"
                className="group flex w-full items-center gap-1.5 text-left"
                onClick={() => setProposedPlanExpanded((v) => !v)}
              >
                {proposedPlanExpanded ? (
                  <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/40 transition-transform" />
                ) : (
                  <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/40 transition-transform" />
                )}
                <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase group-hover:text-muted-foreground/60">
                  Full Plan
                </span>
              </button>
              {proposedPlanExpanded ? (
                <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                  <ChatMarkdown
                    text={displayedPlanMarkdown ?? ""}
                    cwd={markdownCwd}
                    isStreaming={false}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Empty state */}
          {!hasChecklist && !planMarkdown ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] text-muted-foreground/40">No active plan yet.</p>
              <p className="mt-1 text-[11px] text-muted-foreground/30">
                Plans will appear here when generated.
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
});

export default PlanSidebar;
export type { PlanSidebarProps };
