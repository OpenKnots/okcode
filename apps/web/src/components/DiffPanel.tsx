import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata, Virtualizer } from "@pierre/diffs/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ThreadId, type TurnId } from "@okcode/contracts";
import { CheckIcon, ChevronDownIcon, Columns2Icon, Rows3Icon, TextWrapIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gitBranchesQueryOptions } from "~/lib/gitReactQuery";
import { checkpointDiffQueryOptions } from "~/lib/providerReactQuery";
import { cn } from "~/lib/utils";
import { useCodeViewerStore } from "../codeViewerStore";
import { parseDiffRouteSearch, stripDiffSearchParams } from "../diffRouteSearch";
import { useTheme } from "../hooks/useTheme";
import { buildPatchCacheKey } from "../lib/diffRendering";
import {
  acceptAllDiffFiles,
  expandDiffFile,
  reconcileDiffFileReviewState,
  toggleDiffFileAccepted,
  toggleDiffFileCollapsed,
  type DiffFileReviewStateByPath,
} from "../lib/diffFileReviewState";
import { resolveDiffThemeName } from "../lib/diffRendering";
import { useTurnDiffSummaries } from "../hooks/useTurnDiffSummaries";
import { useStore } from "../store";
import { useAppSettings } from "../appSettings";
import { formatShortTimestamp } from "../timestampFormat";
import { DiffPanelLoadingState, DiffPanelShell, type DiffPanelMode } from "./DiffPanelShell";
import { DiffStatLabel, hasNonZeroStat } from "./chat/DiffStatLabel";
import { Button } from "./ui/button";
import { Select, SelectButton, SelectItem, SelectPopup } from "./ui/select";
import { ToggleGroup, Toggle } from "./ui/toggle-group";

type DiffRenderMode = "stacked" | "split";
type DiffThemeType = "light" | "dark";

const DIFF_PANEL_UNSAFE_CSS = `
[data-diffs-header],
[data-diff],
[data-file],
[data-error-wrapper],
[data-virtualizer-buffer] {
  --diffs-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;

  --diffs-bg-context-override: color-mix(in srgb, var(--background) 97%, var(--foreground));
  --diffs-bg-hover-override: color-mix(in srgb, var(--background) 94%, var(--foreground));
  --diffs-bg-separator-override: color-mix(in srgb, var(--background) 95%, var(--foreground));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--background) 90%, var(--foreground));

  --diffs-bg-addition-override: color-mix(in srgb, var(--background) 92%, var(--success));
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--background) 88%, var(--success));
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--background) 85%, var(--success));
  --diffs-bg-addition-emphasis-override: color-mix(in srgb, var(--background) 80%, var(--success));

  --diffs-bg-deletion-override: color-mix(in srgb, var(--background) 92%, var(--destructive));
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--background) 88%, var(--destructive));
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--background) 85%, var(--destructive));
  --diffs-bg-deletion-emphasis-override: color-mix(
    in srgb,
    var(--background) 80%,
    var(--destructive)
  );

  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  background-color: color-mix(in srgb, var(--card) 94%, var(--foreground)) !important;
  border-block-color: var(--border) !important;
  color: var(--foreground) !important;
}

[data-diffs-header] {
  position: sticky !important;
  top: 0;
  z-index: 4;
  background-color: color-mix(in srgb, var(--card) 94%, var(--foreground)) !important;
  border-bottom: 1px solid var(--border) !important;
}

[data-title] {
  cursor: pointer;
  transition:
    color 120ms ease,
    text-decoration-color 120ms ease;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
}

[data-title]:hover {
  color: color-mix(in srgb, var(--foreground) 84%, var(--primary)) !important;
  text-decoration-color: currentColor;
}
`;

type RenderablePatch =
  | {
      kind: "files";
      files: FileDiffMetadata[];
    }
  | {
      kind: "raw";
      text: string;
      reason: string;
    };

function getRenderablePatch(
  patch: string | undefined,
  cacheScope = "diff-panel",
): RenderablePatch | null {
  if (!patch) return null;
  const normalizedPatch = patch.trim();
  if (normalizedPatch.length === 0) return null;

  try {
    const parsedPatches = parsePatchFiles(
      normalizedPatch,
      buildPatchCacheKey(normalizedPatch, cacheScope),
    );
    const files = parsedPatches.flatMap((parsedPatch) => parsedPatch.files);
    if (files.length > 0) {
      return { kind: "files", files };
    }

    return {
      kind: "raw",
      text: normalizedPatch,
      reason: "Unsupported diff format. Showing raw patch.",
    };
  } catch {
    return {
      kind: "raw",
      text: normalizedPatch,
      reason: "Failed to parse patch. Showing raw patch.",
    };
  }
}

function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}

function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

function summarizeFileDiffStats(fileDiff: FileDiffMetadata): {
  additions: number;
  deletions: number;
} {
  return fileDiff.hunks.reduce(
    (summary, hunk) => ({
      additions: summary.additions + hunk.additionLines,
      deletions: summary.deletions + hunk.deletionLines,
    }),
    { additions: 0, deletions: 0 },
  );
}

function DiffFileSection(props: {
  fileDiff: FileDiffMetadata;
  filePath: string;
  fileKey: string;
  diffRenderMode: DiffRenderMode;
  diffWordWrap: boolean;
  resolvedTheme: "light" | "dark";
  collapsed: boolean;
  accepted: boolean;
  onOpenInEditor: (filePath: string) => void;
  onToggleCollapsed: (filePath: string) => void;
  onToggleAccepted: (filePath: string) => void;
}) {
  const {
    accepted,
    collapsed,
    diffRenderMode,
    diffWordWrap,
    fileDiff,
    fileKey,
    filePath,
    onOpenInEditor,
    onToggleAccepted,
    onToggleCollapsed,
    resolvedTheme,
  } = props;
  const stats = summarizeFileDiffStats(fileDiff);

  return (
    <section
      data-diff-file-path={filePath}
      className={cn(
        "diff-render-file mb-2 overflow-hidden rounded-md border border-border/70 bg-card/30 first:mt-2 last:mb-0",
        accepted && "border-success/40",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-card/70 px-2 py-1.5">
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={collapsed ? `Expand ${filePath}` : `Collapse ${filePath}`}
          aria-expanded={!collapsed}
          onClick={() => onToggleCollapsed(filePath)}
          className="text-muted-foreground/80"
        >
          <ChevronDownIcon
            className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")}
          />
        </Button>
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-foreground/90 underline-offset-2 hover:underline"
          onClick={() => onOpenInEditor(filePath)}
          title={`Open ${filePath}`}
        >
          {filePath}
        </button>
        {hasNonZeroStat(stats) && (
          <span className="hidden shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/80 sm:inline">
            <DiffStatLabel additions={stats.additions} deletions={stats.deletions} />
          </span>
        )}
        <Button
          size="xs"
          variant={accepted ? "secondary" : "outline"}
          onClick={() => onToggleAccepted(filePath)}
          className={cn(
            "gap-1.5",
            accepted && "border-success/30 bg-success/12 text-success hover:bg-success/18",
          )}
        >
          <CheckIcon className={cn("size-3.5", accepted ? "opacity-100" : "opacity-35")} />
          {accepted ? "Accepted" : "Accept"}
        </Button>
      </div>
      {!collapsed && (
        <div key={fileKey}>
          <FileDiff
            fileDiff={fileDiff}
            options={{
              diffStyle: diffRenderMode === "split" ? "split" : "unified",
              lineDiffType: "none",
              overflow: diffWordWrap ? "wrap" : "scroll",
              theme: resolveDiffThemeName(resolvedTheme),
              themeType: resolvedTheme as DiffThemeType,
              unsafeCSS: DIFF_PANEL_UNSAFE_CSS,
            }}
          />
        </div>
      )}
    </section>
  );
}

interface DiffPanelProps {
  mode?: DiffPanelMode;
}

export { DiffWorkerPoolProvider } from "./DiffWorkerPoolProvider";

export default function DiffPanel({ mode = "inline" }: DiffPanelProps) {
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const { settings } = useAppSettings();
  const [diffRenderMode, setDiffRenderMode] = useState<DiffRenderMode>("stacked");
  const [diffWordWrap, setDiffWordWrap] = useState(settings.diffWordWrap);
  const patchViewportRef = useRef<HTMLDivElement>(null);
  const previousDiffOpenRef = useRef(false);
  const [reviewStateBySelectionKey, setReviewStateBySelectionKey] = useState<
    Record<string, DiffFileReviewStateByPath>
  >({});
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const diffSearch = useSearch({ strict: false, select: (search) => parseDiffRouteSearch(search) });
  const diffOpen = diffSearch.diff === "1";
  const activeThreadId = routeThreadId;
  const activeThread = useStore((store) =>
    activeThreadId ? store.threads.find((thread) => thread.id === activeThreadId) : undefined,
  );
  const activeProjectId = activeThread?.projectId ?? null;
  const activeProject = useStore((store) =>
    activeProjectId ? store.projects.find((project) => project.id === activeProjectId) : undefined,
  );
  const activeCwd = activeThread?.worktreePath ?? activeProject?.cwd;
  const gitBranchesQuery = useQuery(gitBranchesQueryOptions(activeCwd ?? null));
  const isGitRepo = gitBranchesQuery.data?.isRepo ?? true;
  const { turnDiffSummaries, inferredCheckpointTurnCountByTurnId } =
    useTurnDiffSummaries(activeThread);
  const orderedTurnDiffSummaries = useMemo(
    () =>
      [...turnDiffSummaries].toSorted((left, right) => {
        const leftTurnCount =
          left.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[left.turnId] ?? 0;
        const rightTurnCount =
          right.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[right.turnId] ?? 0;
        if (leftTurnCount !== rightTurnCount) {
          return rightTurnCount - leftTurnCount;
        }
        return right.completedAt.localeCompare(left.completedAt);
      }),
    [inferredCheckpointTurnCountByTurnId, turnDiffSummaries],
  );

  const selectedTurnId = diffSearch.diffTurnId ?? null;
  const selectedFilePath = selectedTurnId !== null ? (diffSearch.diffFilePath ?? null) : null;
  const selectedTurn =
    selectedTurnId === null
      ? undefined
      : (orderedTurnDiffSummaries.find((summary) => summary.turnId === selectedTurnId) ??
        orderedTurnDiffSummaries[0]);
  const selectedCheckpointTurnCount =
    selectedTurn &&
    (selectedTurn.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[selectedTurn.turnId]);
  const selectedCheckpointRange = useMemo(
    () =>
      typeof selectedCheckpointTurnCount === "number"
        ? {
            fromTurnCount: Math.max(0, selectedCheckpointTurnCount - 1),
            toTurnCount: selectedCheckpointTurnCount,
          }
        : null,
    [selectedCheckpointTurnCount],
  );
  const conversationCheckpointTurnCount = useMemo(() => {
    const turnCounts = orderedTurnDiffSummaries
      .map(
        (summary) =>
          summary.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[summary.turnId],
      )
      .filter((value): value is number => typeof value === "number");
    if (turnCounts.length === 0) {
      return undefined;
    }
    const latest = Math.max(...turnCounts);
    return latest > 0 ? latest : undefined;
  }, [inferredCheckpointTurnCountByTurnId, orderedTurnDiffSummaries]);
  const conversationCheckpointRange = useMemo(
    () =>
      !selectedTurn && typeof conversationCheckpointTurnCount === "number"
        ? {
            fromTurnCount: 0,
            toTurnCount: conversationCheckpointTurnCount,
          }
        : null,
    [conversationCheckpointTurnCount, selectedTurn],
  );
  const activeCheckpointRange = selectedTurn
    ? selectedCheckpointRange
    : conversationCheckpointRange;
  const conversationCacheScope = useMemo(() => {
    if (selectedTurn || orderedTurnDiffSummaries.length === 0) {
      return null;
    }
    return `conversation:${orderedTurnDiffSummaries.map((summary) => summary.turnId).join(",")}`;
  }, [orderedTurnDiffSummaries, selectedTurn]);
  const activeCheckpointDiffQuery = useQuery(
    checkpointDiffQueryOptions({
      threadId: activeThreadId,
      fromTurnCount: activeCheckpointRange?.fromTurnCount ?? null,
      toTurnCount: activeCheckpointRange?.toTurnCount ?? null,
      cacheScope: selectedTurn ? `turn:${selectedTurn.turnId}` : conversationCacheScope,
      enabled: isGitRepo,
    }),
  );
  const selectedTurnCheckpointDiff = selectedTurn
    ? activeCheckpointDiffQuery.data?.diff
    : undefined;
  const conversationCheckpointDiff = selectedTurn
    ? undefined
    : activeCheckpointDiffQuery.data?.diff;
  const isLoadingCheckpointDiff = activeCheckpointDiffQuery.isLoading;
  const checkpointDiffError =
    activeCheckpointDiffQuery.error instanceof Error
      ? activeCheckpointDiffQuery.error.message
      : activeCheckpointDiffQuery.error
        ? "Failed to load checkpoint diff."
        : null;

  const selectedPatch = selectedTurn ? selectedTurnCheckpointDiff : conversationCheckpointDiff;
  const hasResolvedPatch = typeof selectedPatch === "string";
  const hasNoNetChanges = hasResolvedPatch && selectedPatch.trim().length === 0;
  const renderablePatch = useMemo(
    () => getRenderablePatch(selectedPatch, `diff-panel:${resolvedTheme}`),
    [resolvedTheme, selectedPatch],
  );
  const renderableFiles = useMemo(() => {
    if (!renderablePatch || renderablePatch.kind !== "files") {
      return [];
    }
    return renderablePatch.files.toSorted((left, right) =>
      resolveFileDiffPath(left).localeCompare(resolveFileDiffPath(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [renderablePatch]);
  const patchReviewSelectionKey = useMemo(() => {
    if (!activeThreadId || !selectedPatch) {
      return null;
    }
    const scope = selectedTurn ? `turn:${selectedTurn.turnId}` : "conversation";
    return `${activeThreadId}:${scope}:${buildPatchCacheKey(selectedPatch, "diff-review")}`;
  }, [activeThreadId, selectedPatch, selectedTurn]);
  const renderableFilePaths = useMemo(
    () => renderableFiles.map((fileDiff) => resolveFileDiffPath(fileDiff)),
    [renderableFiles],
  );
  const activeReviewState = useMemo(() => {
    return patchReviewSelectionKey
      ? (reviewStateBySelectionKey[patchReviewSelectionKey] ?? {})
      : {};
  }, [patchReviewSelectionKey, reviewStateBySelectionKey]);
  const acceptedFileCount = useMemo(
    () =>
      renderableFilePaths.reduce(
        (count, filePath) => count + (activeReviewState[filePath]?.accepted ? 1 : 0),
        0,
      ),
    [activeReviewState, renderableFilePaths],
  );
  const hasUnacceptedFiles =
    renderableFilePaths.length > 0 && acceptedFileCount < renderableFilePaths.length;

  useEffect(() => {
    if (diffOpen && !previousDiffOpenRef.current) {
      setDiffWordWrap(settings.diffWordWrap);
    }
    previousDiffOpenRef.current = diffOpen;
  }, [diffOpen, settings.diffWordWrap]);

  useEffect(() => {
    if (!patchReviewSelectionKey) {
      return;
    }
    setReviewStateBySelectionKey((current) => {
      const nextSelectionState = reconcileDiffFileReviewState(
        renderableFilePaths,
        current[patchReviewSelectionKey],
      );
      if (current[patchReviewSelectionKey] === nextSelectionState) {
        return current;
      }
      return {
        ...current,
        [patchReviewSelectionKey]: nextSelectionState,
      };
    });
  }, [patchReviewSelectionKey, renderableFilePaths]);

  useEffect(() => {
    if (!patchReviewSelectionKey || !selectedFilePath) {
      return;
    }
    setReviewStateBySelectionKey((current) => {
      const selectionState = current[patchReviewSelectionKey];
      if (!selectionState) {
        return current;
      }
      const nextSelectionState = expandDiffFile(selectionState, selectedFilePath);
      if (nextSelectionState === selectionState) {
        return current;
      }
      return {
        ...current,
        [patchReviewSelectionKey]: nextSelectionState,
      };
    });
  }, [patchReviewSelectionKey, selectedFilePath]);

  useEffect(() => {
    if (!selectedFilePath || !patchViewportRef.current) {
      return;
    }
    const target = Array.from(
      patchViewportRef.current.querySelectorAll<HTMLElement>("[data-diff-file-path]"),
    ).find((element) => element.dataset.diffFilePath === selectedFilePath);
    target?.scrollIntoView({ block: "nearest" });
  }, [selectedFilePath, renderableFiles]);

  const openFileInCodeViewer = useCodeViewerStore((state) => state.openFile);
  const openDiffFileInCodeViewer = useCallback(
    (filePath: string) => {
      if (!activeCwd) return;
      openFileInCodeViewer(activeCwd, filePath);
    },
    [activeCwd, openFileInCodeViewer],
  );
  const updateActiveReviewState = useCallback(
    (updater: (current: DiffFileReviewStateByPath) => DiffFileReviewStateByPath) => {
      if (!patchReviewSelectionKey) {
        return;
      }
      setReviewStateBySelectionKey((current) => ({
        ...current,
        [patchReviewSelectionKey]: updater(current[patchReviewSelectionKey] ?? {}),
      }));
    },
    [patchReviewSelectionKey],
  );
  const onToggleFileAccepted = useCallback(
    (filePath: string) => {
      updateActiveReviewState((current) => toggleDiffFileAccepted(current, filePath));
    },
    [updateActiveReviewState],
  );
  const onAcceptAllFiles = useCallback(() => {
    if (renderableFilePaths.length === 0) {
      return;
    }
    updateActiveReviewState((current) => acceptAllDiffFiles(current, renderableFilePaths));
  }, [renderableFilePaths, updateActiveReviewState]);
  const onToggleFileCollapsed = useCallback(
    (filePath: string) => {
      updateActiveReviewState((current) => toggleDiffFileCollapsed(current, filePath));
    },
    [updateActiveReviewState],
  );

  const latestSelectedTurnId = orderedTurnDiffSummaries[0]?.turnId ?? null;

  const selectTurn = (turnId: TurnId) => {
    if (!activeThread) return;
    void navigate({
      to: "/$threadId",
      params: { threadId: activeThread.id },
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return { ...rest, diff: "1", diffTurnId: turnId };
      },
    });
  };
  const selectWholeConversation = () => {
    if (!activeThread) return;
    void navigate({
      to: "/$threadId",
      params: { threadId: activeThread.id },
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return { ...rest, diff: "1" };
      },
    });
  };
  const turnSelectValue = selectedTurnId ?? "all";
  const handleTurnSelectChange = useCallback(
    (value: string | null) => {
      if (value === "all" || value === null) {
        selectWholeConversation();
      } else {
        selectTurn(value as TurnId);
      }
    },
    [selectTurn, selectWholeConversation],
  );

  const headerRow = (
    <>
      <div className="min-w-0 flex-1 [-webkit-app-region:no-drag]">
        <Select value={turnSelectValue} onValueChange={handleTurnSelectChange}>
          <SelectButton size="xs" variant="ghost">
            {selectedTurnId === null
              ? "All changes"
              : selectedTurn?.turnId === latestSelectedTurnId
                ? `Latest • ${formatShortTimestamp(selectedTurn.completedAt, settings.timestampFormat)}`
                : `Change ${
                    selectedTurn?.checkpointTurnCount ??
                    (selectedTurn
                      ? inferredCheckpointTurnCountByTurnId[selectedTurn.turnId]
                      : null) ??
                    "?"
                  } • ${selectedTurn ? formatShortTimestamp(selectedTurn.completedAt, settings.timestampFormat) : ""}`}
          </SelectButton>
          <SelectPopup>
            <SelectItem value="all">All changes</SelectItem>
            {orderedTurnDiffSummaries.map((summary) => (
              <SelectItem key={summary.turnId} value={summary.turnId}>
                <span className="flex items-center justify-between gap-3">
                  <span>
                    {summary.turnId === latestSelectedTurnId
                      ? "Latest"
                      : `Change ${
                          summary.checkpointTurnCount ??
                          inferredCheckpointTurnCountByTurnId[summary.turnId] ??
                          "?"
                        }`}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatShortTimestamp(summary.completedAt, settings.timestampFormat)}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>
      <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">
        {renderablePatch?.kind === "files" ? (
          <Button
            size="xs"
            variant="outline"
            onClick={onAcceptAllFiles}
            disabled={!hasUnacceptedFiles}
            className="gap-1.5"
          >
            <CheckIcon className="size-3.5" />
            {hasUnacceptedFiles ? "Accept All" : "All Accepted"}
          </Button>
        ) : null}
        <ToggleGroup
          className="shrink-0"
          variant="outline"
          size="xs"
          value={[diffRenderMode]}
          onValueChange={(value) => {
            const next = value[0];
            if (next === "stacked" || next === "split") {
              setDiffRenderMode(next);
            }
          }}
        >
          <Toggle aria-label="Stacked diff view" value="stacked">
            <Rows3Icon className="size-3" />
          </Toggle>
          <Toggle aria-label="Split diff view" value="split">
            <Columns2Icon className="size-3" />
          </Toggle>
        </ToggleGroup>
        <Toggle
          aria-label={diffWordWrap ? "Disable diff line wrapping" : "Enable diff line wrapping"}
          title={diffWordWrap ? "Disable line wrapping" : "Enable line wrapping"}
          variant="outline"
          size="xs"
          pressed={diffWordWrap}
          onPressedChange={(pressed) => {
            setDiffWordWrap(Boolean(pressed));
          }}
        >
          <TextWrapIcon className="size-3" />
        </Toggle>
      </div>
    </>
  );

  return (
    <DiffPanelShell mode={mode} header={headerRow}>
      {!activeThread ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          Select a thread to inspect changes.
        </div>
      ) : !isGitRepo ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          Changes are unavailable because this project is not a git repository.
        </div>
      ) : orderedTurnDiffSummaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          No captured changes yet.
        </div>
      ) : (
        <>
          <div
            ref={patchViewportRef}
            className="diff-panel-viewport min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            {checkpointDiffError && !renderablePatch && (
              <div className="px-3">
                <p className="mb-2 text-[11px] text-red-500/80">{checkpointDiffError}</p>
              </div>
            )}
            {!renderablePatch ? (
              isLoadingCheckpointDiff ? (
                <DiffPanelLoadingState label="Loading changes..." />
              ) : (
                <div className="flex h-full items-center justify-center px-3 py-2 text-xs text-muted-foreground/70">
                  <p>
                    {hasNoNetChanges
                      ? "No net changes in this selection."
                      : "No patch available for this selection."}
                  </p>
                </div>
              )
            ) : renderablePatch.kind === "files" ? (
              <Virtualizer
                className="diff-render-surface h-full min-h-0 overflow-auto px-2 pb-2"
                config={{
                  overscrollSize: 600,
                  intersectionObserverMargin: 1200,
                }}
              >
                {renderableFiles.map((fileDiff) => {
                  const filePath = resolveFileDiffPath(fileDiff);
                  const fileKey = buildFileDiffRenderKey(fileDiff);
                  const themedFileKey = `${fileKey}:${resolvedTheme}`;
                  const fileReviewState = activeReviewState[filePath] ?? {
                    accepted: false,
                    collapsed: true,
                  };
                  return (
                    <DiffFileSection
                      key={themedFileKey}
                      accepted={fileReviewState.accepted}
                      collapsed={fileReviewState.collapsed}
                      diffRenderMode={diffRenderMode}
                      diffWordWrap={diffWordWrap}
                      fileDiff={fileDiff}
                      fileKey={themedFileKey}
                      filePath={filePath}
                      onOpenInEditor={openDiffFileInCodeViewer}
                      onToggleAccepted={onToggleFileAccepted}
                      onToggleCollapsed={onToggleFileCollapsed}
                      resolvedTheme={resolvedTheme}
                    />
                  );
                })}
              </Virtualizer>
            ) : (
              <div className="h-full overflow-auto p-2">
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground/75">{renderablePatch.reason}</p>
                  <pre
                    className={cn(
                      "max-h-[72vh] rounded-md border border-border/70 bg-background/70 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground/90",
                      diffWordWrap
                        ? "overflow-auto whitespace-pre-wrap wrap-break-word"
                        : "overflow-auto",
                    )}
                  >
                    {renderablePatch.text}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </DiffPanelShell>
  );
}
