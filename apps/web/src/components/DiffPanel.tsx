import { parsePatchFiles } from "@pierre/diffs";
import { FileDiff, type FileDiffMetadata, Virtualizer } from "@pierre/diffs/react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  ChevronRightIcon,
  Columns2Icon,
  Rows3Icon,
  TextWrapIcon,
  XIcon,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { openInPreferredEditor } from "../editorPreferences";
import { useDiffViewerStore } from "../diffViewerStore";
import { useTheme } from "../hooks/useTheme";
import { useTurnDiffSummaries } from "../hooks/useTurnDiffSummaries";
import { buildAcceptedDiffFileKey, filterAcceptedDiffFiles } from "../lib/diffPanelAcceptance";
import { checkpointDiffQueryOptions } from "../lib/providerReactQuery";
import { buildPatchCacheKey, resolveDiffThemeName } from "../lib/diffRendering";
import { cn } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { resolvePathLinkTarget } from "../terminal-links";
import { DiffPanelLoadingState, DiffPanelShell, type DiffPanelMode } from "./DiffPanelShell";
import { Button } from "./ui/button";
import { Toggle, ToggleGroup } from "./ui/toggle-group";

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
  display: none !important;
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
  | { kind: "files"; files: FileDiffMetadata[] }
  | { kind: "raw"; text: string; reason: string };

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

type FileDiffCategory = "all" | "added" | "modified" | "deleted" | "renamed";

const CATEGORY_ORDER: FileDiffCategory[] = ["all", "added", "modified", "deleted", "renamed"];

const CATEGORY_LABELS: Record<FileDiffCategory, string> = {
  all: "All",
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
};

function categorizeFileDiff(fileDiff: FileDiffMetadata): Exclude<FileDiffCategory, "all"> {
  switch (fileDiff.type) {
    case "new":
      return "added";
    case "deleted":
      return "deleted";
    case "rename-pure":
    case "rename-changed":
      return "renamed";
    case "change":
    default:
      return "modified";
  }
}

interface DiffPanelProps {
  mode?: DiffPanelMode;
}

export default function DiffPanel({ mode = "inline" }: DiffPanelProps) {
  const { resolvedTheme } = useTheme();
  const [diffRenderMode, setDiffRenderMode] = useState<DiffRenderMode>("stacked");
  const [diffWordWrap, setDiffWordWrap] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FileDiffCategory>("all");
  const [acceptedFileKeys, setAcceptedFileKeys] = useState<Set<string>>(() => new Set());
  const [collapsedFileKeys, setCollapsedFileKeys] = useState<Set<string>>(() => new Set());
  const patchViewportRef = useRef<HTMLDivElement>(null);
  const previousDiffOpenRef = useRef(false);

  const diffViewerThreadId = useDiffViewerStore((state) => state.threadId);
  const diffOpen = useDiffViewerStore((state) => state.isOpen);
  const selectedFilePath = useDiffViewerStore((state) => state.selectedFilePath);
  const closeDiffViewer = useDiffViewerStore((state) => state.close);

  const activeThread = useStore((store) =>
    diffViewerThreadId
      ? store.threads.find((thread) => thread.id === diffViewerThreadId)
      : undefined,
  );
  const activeProjectId = activeThread?.projectId ?? null;
  const activeProject = useStore((store) =>
    activeProjectId ? store.projects.find((project) => project.id === activeProjectId) : undefined,
  );
  const activeCwd = activeThread?.worktreePath ?? activeProject?.cwd;

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
  const activeCheckpointRange = useMemo(
    () =>
      typeof conversationCheckpointTurnCount === "number"
        ? {
            fromTurnCount: 0,
            toTurnCount: conversationCheckpointTurnCount,
          }
        : null,
    [conversationCheckpointTurnCount],
  );
  const conversationCacheScope = useMemo(() => {
    if (orderedTurnDiffSummaries.length === 0) {
      return null;
    }
    return `conversation:${orderedTurnDiffSummaries.map((summary) => summary.turnId).join(",")}`;
  }, [orderedTurnDiffSummaries]);
  const activeCheckpointDiffQuery = useQuery(
    checkpointDiffQueryOptions({
      threadId: diffViewerThreadId,
      fromTurnCount: activeCheckpointRange?.fromTurnCount ?? null,
      toTurnCount: activeCheckpointRange?.toTurnCount ?? null,
      cacheScope: conversationCacheScope,
      enabled: diffOpen,
    }),
  );

  const selectedPatch = activeCheckpointDiffQuery.data?.diff;
  const hasResolvedPatch = typeof selectedPatch === "string";
  const hasNoNetChanges = hasResolvedPatch && selectedPatch.trim().length === 0;
  const isLoadingCheckpointDiff = activeCheckpointDiffQuery.isLoading;
  const checkpointDiffError =
    activeCheckpointDiffQuery.error instanceof Error
      ? activeCheckpointDiffQuery.error.message
      : activeCheckpointDiffQuery.error
        ? "Failed to load checkpoint diff."
        : null;
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

  const remainingFiles = useMemo(
    () => filterAcceptedDiffFiles(renderableFiles, acceptedFileKeys),
    [acceptedFileKeys, renderableFiles],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<Exclude<FileDiffCategory, "all">, number> = {
      added: 0,
      modified: 0,
      deleted: 0,
      renamed: 0,
    };
    for (const fileDiff of renderableFiles) {
      const category = categorizeFileDiff(fileDiff);
      counts[category]++;
    }
    return { all: renderableFiles.length, ...counts };
  }, [renderableFiles]);

  const filteredFiles = useMemo(() => {
    if (selectedCategory === "all") return renderableFiles;
    return renderableFiles.filter((fileDiff) => categorizeFileDiff(fileDiff) === selectedCategory);
  }, [renderableFiles, selectedCategory]);

  useEffect(() => {
    if (diffOpen && !previousDiffOpenRef.current) {
      setDiffWordWrap(false);
      setSelectedCategory("all");
    }
    previousDiffOpenRef.current = diffOpen;
  }, [diffOpen]);

  useEffect(() => {
    setAcceptedFileKeys(new Set());
    setCollapsedFileKeys(new Set());
  }, [selectedPatch]);

  useEffect(() => {
    if (!selectedFilePath || !patchViewportRef.current) {
      return;
    }
    const selectedFile = renderableFiles.find((f) => resolveFileDiffPath(f) === selectedFilePath);
    if (selectedFile) {
      const key = buildFileDiffRenderKey(selectedFile);
      setCollapsedFileKeys((current) => {
        if (!current.has(key)) return current;
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
    requestAnimationFrame(() => {
      const target = Array.from(
        patchViewportRef.current?.querySelectorAll<HTMLElement>("[data-diff-file-path]") ?? [],
      ).find((element) => element.dataset.diffFilePath === selectedFilePath);
      target?.scrollIntoView({ block: "nearest" });
    });
  }, [selectedFilePath, renderableFiles]);

  const openDiffFileInEditor = useCallback(
    (filePath: string) => {
      const api = readNativeApi();
      if (!api) return;
      const targetPath = activeCwd ? resolvePathLinkTarget(filePath, activeCwd) : filePath;
      void openInPreferredEditor(api, targetPath).catch((error) => {
        console.warn("Failed to open diff file in editor.", error);
      });
    },
    [activeCwd],
  );

  const acceptFile = useCallback((fileDiff: FileDiffMetadata) => {
    const fileKey = buildAcceptedDiffFileKey(fileDiff);
    const renderKey = buildFileDiffRenderKey(fileDiff);
    startTransition(() => {
      setAcceptedFileKeys((current) => {
        if (current.has(fileKey)) {
          return current;
        }
        const next = new Set(current);
        next.add(fileKey);
        return next;
      });
      setCollapsedFileKeys((current) => {
        if (current.has(renderKey)) return current;
        const next = new Set(current);
        next.add(renderKey);
        return next;
      });
    });
  }, []);

  const acceptAllFiles = useCallback(() => {
    if (remainingFiles.length === 0) {
      return;
    }
    startTransition(() => {
      setAcceptedFileKeys((current) => {
        const next = new Set(current);
        for (const fileDiff of remainingFiles) {
          next.add(buildAcceptedDiffFileKey(fileDiff));
        }
        return next;
      });
      setCollapsedFileKeys((current) => {
        const next = new Set(current);
        for (const fileDiff of remainingFiles) {
          next.add(buildFileDiffRenderKey(fileDiff));
        }
        return next;
      });
    });
  }, [remainingFiles]);

  const toggleFileCollapse = useCallback((fileKey: string) => {
    setCollapsedFileKeys((current) => {
      const next = new Set(current);
      if (next.has(fileKey)) {
        next.delete(fileKey);
      } else {
        next.add(fileKey);
      }
      return next;
    });
  }, []);

  const noFilesInSelectedCategory = filteredFiles.length === 0;

  const headerRow = (
    <>
      <div className="min-w-0 flex-1 [-webkit-app-region:no-drag]">
        <div className="flex flex-wrap gap-1 py-0.5">
          {CATEGORY_ORDER.map((category) => {
            const count = categoryCounts[category];
            if (category !== "all" && count === 0) return null;
            return (
              <button
                key={category}
                type="button"
                className="shrink-0 rounded-md"
                onClick={() => setSelectedCategory(category)}
              >
                <div
                  className={cn(
                    "rounded-md border px-2 py-1 text-left transition-colors",
                    selectedCategory === category
                      ? "border-border bg-accent text-accent-foreground"
                      : "border-border/70 bg-background/70 text-muted-foreground/80 hover:border-border hover:text-foreground/80",
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] leading-tight font-medium">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <span className="text-[9px] leading-tight opacity-70">{count}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 [-webkit-app-region:no-drag]">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={acceptAllFiles}
          disabled={remainingFiles.length === 0}
        >
          Accept All
        </Button>
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
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={closeDiffViewer}
          aria-label="Close diff panel"
          title="Close diff panel"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </>
  );

  return (
    <DiffPanelShell mode={mode} header={headerRow}>
      {!activeThread ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          Select a thread to inspect turn diffs.
        </div>
      ) : orderedTurnDiffSummaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
          No completed turns yet.
        </div>
      ) : (
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
              <DiffPanelLoadingState label="Loading checkpoint diff..." />
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
            noFilesInSelectedCategory ? (
              <div className="flex h-full items-center justify-center px-3 py-2 text-xs text-muted-foreground/70">
                <p>{`No ${CATEGORY_LABELS[selectedCategory].toLowerCase()} changes.`}</p>
              </div>
            ) : (
              <Virtualizer
                className="diff-render-surface h-full min-h-0 overflow-auto px-2 pb-2"
                config={{
                  overscrollSize: 600,
                  intersectionObserverMargin: 1200,
                }}
              >
                {filteredFiles.map((fileDiff) => {
                  const filePath = resolveFileDiffPath(fileDiff);
                  const fileKey = buildFileDiffRenderKey(fileDiff);
                  const themedFileKey = `${fileKey}:${resolvedTheme}`;
                  const isAccepted = acceptedFileKeys.has(buildAcceptedDiffFileKey(fileDiff));
                  const isCollapsed = collapsedFileKeys.has(fileKey);
                  const changeType = categorizeFileDiff(fileDiff);
                  return (
                    <div
                      key={themedFileKey}
                      data-diff-file-path={filePath}
                      className="diff-render-file mb-2 first:mt-2 last:mb-0"
                    >
                      <div
                        className={cn(
                          "overflow-hidden rounded-md border transition-colors duration-150",
                          isAccepted ? "border-border/40" : "border-border/70",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFileCollapse(fileKey)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left",
                            "bg-[color-mix(in_srgb,var(--card)_94%,var(--foreground))]",
                            "hover:bg-[color-mix(in_srgb,var(--card)_90%,var(--foreground))]",
                            "transition-colors duration-150",
                            !isCollapsed && "border-b border-border/50",
                            isAccepted && "opacity-60 hover:opacity-80",
                          )}
                        >
                          <ChevronRightIcon
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200",
                              !isCollapsed && "rotate-90",
                            )}
                          />
                          <span
                            role="link"
                            tabIndex={0}
                            className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90 hover:text-foreground hover:underline hover:underline-offset-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDiffFileInEditor(filePath);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.stopPropagation();
                                openDiffFileInEditor(filePath);
                              }
                            }}
                          >
                            {filePath}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
                              changeType === "added" &&
                                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                              changeType === "deleted" &&
                                "bg-red-500/15 text-red-600 dark:text-red-400",
                              changeType === "renamed" &&
                                "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                              changeType === "modified" &&
                                "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {changeType === "added"
                              ? "A"
                              : changeType === "deleted"
                                ? "D"
                                : changeType === "renamed"
                                  ? "R"
                                  : "M"}
                          </span>
                          {isAccepted ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-600 dark:text-emerald-400">
                              <CheckIcon className="size-3" />
                              Accepted
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="xs"
                              variant="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                acceptFile(fileDiff);
                              }}
                            >
                              Accept
                            </Button>
                          )}
                        </button>
                        {!isCollapsed && (
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
                        )}
                      </div>
                    </div>
                  );
                })}
              </Virtualizer>
            )
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
      )}
    </DiffPanelShell>
  );
}
