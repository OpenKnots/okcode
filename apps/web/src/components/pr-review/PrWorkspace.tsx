import { FileDiff, Virtualizer } from "@pierre/diffs/react";
import type { NativeApi, PrAgentReviewResult, PrReviewThread } from "@okcode/contracts";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Schema } from "effect";
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleIcon,
  ExternalLinkIcon,
  FileCode2Icon,
  GitBranchIcon,
  MessageSquareIcon,
} from "lucide-react";
import { useTheme } from "~/hooks/useTheme";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import { MissingOnDiskBadge } from "~/components/MissingOnDiskBadge";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";
import { useFileViewNavigation } from "~/hooks/useFileViewNavigation";
import { joinPath } from "~/components/review/reviewUtils";
import { projectPathExistsQueryOptions } from "~/lib/projectReactQuery";
import type { Project } from "~/types";
import { PrAgentReviewBanner } from "./PrAgentReviewBanner";
import { PrRuleViolationBanner } from "./PrRuleViolationBanner";
import { PrFileCommentComposer } from "./PrFileCommentComposer";
import { PrFileTabStrip } from "./PrFileTabStrip";
import {
  PR_REVIEW_DIFF_UNSAFE_CSS,
  buildFileDiffRenderKey,
  parseRenderablePatch,
  resolveFileDiffPath,
  shortCommentPreview,
  summarizeFileDiffStats,
  threadTone,
  withInferredFileDiffLanguage,
} from "./pr-review-utils";
import { RawPatchViewer } from "./RawPatchViewer";

const FILE_VIEW_MODE_SCHEMA = Schema.Literals(["single", "all"]);

export function PrWorkspace({
  project,
  patch,
  dashboard,
  agentResult,
  onStartAgentReview,
  isStartingAgentReview,
  selectedFilePath,
  selectedThreadId,
  reviewedFiles,
  approvalBlockers,
  onSelectFilePath,
  onSelectThreadId,
  onCreateThread,
  onToggleFileReviewed,
  onOpenConflictDrawer,
}: {
  project: Project;
  patch: string | null;
  dashboard: Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;
  agentResult: PrAgentReviewResult | null | undefined;
  onStartAgentReview: () => void;
  isStartingAgentReview: boolean;
  selectedFilePath: string | null;
  selectedThreadId: string | null;
  reviewedFiles: readonly string[];
  approvalBlockers: string[];
  onSelectFilePath: (path: string) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onCreateThread: (input: { path: string; line: number; body: string }) => Promise<void>;
  onToggleFileReviewed: (path: string) => void;
  onOpenConflictDrawer: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const openFileInCodeViewer = useFileViewNavigation();
  const [fileViewMode, setFileViewMode] = useLocalStorage(
    "okcode:pr-review:file-view-mode",
    "single",
    FILE_VIEW_MODE_SCHEMA,
  );

  const reviewedFilesSet = useMemo(() => new Set(reviewedFiles), [reviewedFiles]);

  const renderablePatch = useMemo(
    () =>
      parseRenderablePatch(
        patch ?? undefined,
        `pr-review:${dashboard?.pullRequest.number ?? "none"}`,
      ),
    [dashboard?.pullRequest.number, patch],
  );

  const threadsByPath = useMemo<Record<string, PrReviewThread[]>>(() => {
    if (!dashboard) return {};
    return dashboard.threads.reduce<Record<string, PrReviewThread[]>>((acc, thread) => {
      if (!thread.path) return acc;
      if (!acc[thread.path]) acc[thread.path] = [];
      acc[thread.path]!.push(thread);
      return acc;
    }, {});
  }, [dashboard]);

  // Agent findings grouped by file path
  const agentFindingsByPath = useMemo<Record<string, typeof agentResult extends { findings: infer F } ? F : never>>(() => {
    if (!agentResult?.findings) return {};
    return agentResult.findings.reduce<Record<string, typeof agentResult.findings>>((acc, finding) => {
      if (!finding.path) return acc;
      if (!acc[finding.path]) acc[finding.path] = [];
      acc[finding.path]!.push(finding);
      return acc;
    }, {});
  }, [agentResult?.findings]);

  const patchFiles = useMemo(
    () => (renderablePatch?.kind === "files" ? renderablePatch.files : []),
    [renderablePatch],
  );

  const visibleFiles = useMemo(
    () =>
      fileViewMode === "single" && selectedFilePath
        ? patchFiles.filter((file) => resolveFileDiffPath(file) === selectedFilePath)
        : patchFiles,
    [fileViewMode, patchFiles, selectedFilePath],
  );

  const renderedFiles = useMemo(
    () => visibleFiles.map(withInferredFileDiffLanguage),
    [visibleFiles],
  );

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Select a pull request to load the review cockpit.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--background)_86%,var(--foreground))_0%,transparent_54%)]">
      {/* Compact header toolbar — single line */}
      <div className="flex h-10 items-center gap-3 border-b border-border/70 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <span className="shrink-0 font-medium text-foreground">
            #{dashboard.pullRequest.number}
          </span>
          <span
            className="truncate font-medium text-foreground"
            title={dashboard.pullRequest.title}
          >
            {dashboard.pullRequest.title}
          </span>
          <span className="shrink-0 text-muted-foreground/50">&middot;</span>
          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
            <GitBranchIcon className="size-3" />
            {dashboard.pullRequest.headBranch} &rarr; {dashboard.pullRequest.baseBranch}
          </span>
          <span className="hidden shrink-0 text-muted-foreground/50 sm:inline">&middot;</span>
          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
            <MessageSquareIcon className="size-3" />
            {dashboard.pullRequest.unresolvedThreadCount}/{dashboard.pullRequest.totalThreadCount}
          </span>
          <span className="hidden shrink-0 text-muted-foreground/50 sm:inline">&middot;</span>
          <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
            <FileCode2Icon className="size-3" />
            {dashboard.files.length}
          </span>
          {patchFiles.length > 0
            ? (() => {
                const reviewedCount = patchFiles.filter((f) =>
                  reviewedFilesSet.has(resolveFileDiffPath(f)),
                ).length;
                return (
                  <>
                    <span className="hidden shrink-0 text-muted-foreground/50 sm:inline">
                      &middot;
                    </span>
                    <span
                      className={cn(
                        "hidden shrink-0 items-center gap-1.5 text-xs font-medium sm:flex",
                        reviewedCount >= patchFiles.length
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      <CheckCircle2Icon className="size-3" />
                      {reviewedCount}/{patchFiles.length} viewed
                    </span>
                  </>
                );
              })()
            : null}
        </div>
        <Button
          onClick={() => {
            void ensureNativeApi().shell.openExternal(dashboard.pullRequest.url);
          }}
          size="icon-xs"
          variant="ghost"
          title="Open on GitHub"
        >
          <ExternalLinkIcon className="size-3.5" />
        </Button>
      </div>

      {/* Agent review banner */}
      <PrAgentReviewBanner
        agentStatus={agentResult}
        onStartReview={onStartAgentReview}
        onSelectFile={onSelectFilePath}
        onOpenFindings={() => {
          // Handled by inspector tab switch via store
        }}
        isStarting={isStartingAgentReview}
        fileCount={dashboard.files.length}
      />

      {/* Rule violation banner */}
      <PrRuleViolationBanner
        approvalBlockers={approvalBlockers}
        onOpenConflictDrawer={onOpenConflictDrawer}
      />

      {/* File tab strip */}
      {patchFiles.length > 0 ? (
        <PrFileTabStrip
          files={patchFiles}
          threads={dashboard.threads}
          selectedFilePath={selectedFilePath}
          reviewedFiles={reviewedFilesSet}
          cwd={project.cwd}
          onSelectFilePath={(path) => {
            onSelectFilePath(path);
            // In all-files mode, scroll to the file
            if (fileViewMode === "all") {
              requestAnimationFrame(() => {
                const target = document.querySelector(`[data-review-file="${CSS.escape(path)}"]`);
                target?.scrollIntoView({ behavior: "smooth", block: "start" });
              });
            }
          }}
          fileViewMode={fileViewMode}
          onFileViewModeChange={setFileViewMode}
        />
      ) : null}

      {/* Diff content */}
      {!renderablePatch ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No patch is available for this pull request.
        </div>
      ) : renderablePatch.kind === "raw" ? (
        <RawPatchViewer text={renderablePatch.text} reason={renderablePatch.reason} />
      ) : (
        <Virtualizer className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-3">
          {renderedFiles.map((fileDiff) => {
            const filePath = resolveFileDiffPath(fileDiff);
            const fileKey = `${buildFileDiffRenderKey(fileDiff)}:${resolvedTheme}`;
            const fileThreads = threadsByPath[filePath] ?? [];
            const fileFindings = agentFindingsByPath[filePath] ?? [];
            const isSelected = selectedFilePath === filePath;
            const isReviewed = reviewedFilesSet.has(filePath);
            const firstCommentLine = fileThreads[0]?.line ?? 1;
            const stats = summarizeFileDiffStats(fileDiff);
            return (
              <section
                className={cn(
                  "mb-4 overflow-hidden rounded-[24px] border bg-background/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors",
                  isSelected ? "border-amber-500/30" : "border-border/70",
                )}
                data-review-file={filePath}
                key={fileKey}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-2">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => onSelectFilePath(filePath)}
                    type="button"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <FileCode2Icon className="size-3.5 text-muted-foreground" />
                      <span className="truncate">{filePath}</span>
                      <PrDiffFileHeaderBadge cwd={project.cwd} path={filePath} />
                      <span className="text-xs text-muted-foreground">
                        +{stats.additions} -{stats.deletions}
                      </span>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {fileThreads.slice(0, 2).map((thread) => (
                      <button
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          threadTone(thread.state),
                          selectedThreadId === thread.id && "ring-1 ring-amber-500/30",
                        )}
                        key={thread.id}
                        onClick={() => {
                          onSelectFilePath(filePath);
                          onSelectThreadId(thread.id);
                        }}
                        type="button"
                      >
                        <MessageSquareIcon className="size-3" />L{thread.line ?? "?"}
                      </button>
                    ))}
                    {fileThreads.length > 2 ? (
                      <span className="text-[11px] text-muted-foreground">
                        +{fileThreads.length - 2} more
                      </span>
                    ) : null}
                    {/* Agent findings indicator for this file */}
                    {fileFindings.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/8 px-2.5 py-0.5 text-[11px] font-medium text-indigo-400">
                        <SparklesIconInline />
                        {fileFindings.length} finding{fileFindings.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    <button
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        isReviewed
                          ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-300"
                          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/40",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFileReviewed(filePath);
                      }}
                      type="button"
                      title={isReviewed ? "Mark as unreviewed" : "Mark as reviewed"}
                    >
                      {isReviewed ? (
                        <CheckCircle2Icon className="size-3" />
                      ) : (
                        <CircleIcon className="size-3" />
                      )}
                      Viewed
                    </button>
                    <Button
                      onClick={() => {
                        openFileInCodeViewer(project.cwd, filePath);
                      }}
                      size="xs"
                      variant="outline"
                    >
                      Open
                    </Button>
                  </div>
                </div>

                {/* Inline agent findings for this file */}
                {fileFindings.length > 0 ? (
                  <div className="border-b border-indigo-500/15 bg-indigo-500/5 px-4 py-2 space-y-1.5">
                    {fileFindings.map((finding) => (
                      <div
                        className="flex items-start gap-2 text-xs"
                        key={finding.id}
                      >
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 size-3.5 rounded-full flex items-center justify-center text-[8px] font-bold",
                            finding.severity === "critical"
                              ? "bg-rose-500/20 text-rose-400"
                              : finding.severity === "warning"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-sky-500/20 text-sky-400",
                          )}
                        >
                          {finding.severity === "critical" ? "!" : finding.severity === "warning" ? "!" : "i"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-foreground">{finding.title}</span>
                          {finding.line ? (
                            <span className="ml-1.5 text-muted-foreground">L{finding.line}</span>
                          ) : null}
                        </div>
                        <button
                          className="shrink-0 text-[11px] text-indigo-400 hover:text-indigo-300"
                          onClick={() => {
                            if (finding.path && finding.line) {
                              void onCreateThread({
                                path: finding.path,
                                line: finding.line,
                                body: `**AI Finding (${finding.severity}):** ${finding.title}\n\n${finding.detail}`,
                              });
                            }
                          }}
                          type="button"
                        >
                          Create thread
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="p-3">
                  <FileDiff
                    fileDiff={fileDiff}
                    options={{
                      diffStyle: "unified",
                      lineDiffType: "none",
                      overflow: "wrap",
                      theme: resolveDiffThemeName(resolvedTheme),
                      themeType: resolvedTheme,
                      unsafeCSS: PR_REVIEW_DIFF_UNSAFE_CSS,
                    }}
                  />
                </div>
                <div className="space-y-3 border-t border-border/70 bg-muted/18 px-4 py-4">
                  <PrFileCommentComposer
                    cwd={project.cwd}
                    defaultLine={firstCommentLine}
                    participants={dashboard.pullRequest.participants}
                    path={filePath}
                    onSubmit={(input) => onCreateThread({ ...input, path: filePath })}
                  />
                  {fileThreads.length > 0 ? (
                    <div className="space-y-2">
                      {fileThreads.map((thread) => {
                        const firstComment = thread.comments[0];
                        return (
                          <button
                            className={cn(
                              "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition-colors",
                              threadTone(thread.state),
                              selectedThreadId === thread.id && "ring-1 ring-amber-500/30",
                            )}
                            key={thread.id}
                            onClick={() => {
                              onSelectFilePath(filePath);
                              onSelectThreadId(thread.id);
                            }}
                            type="button"
                          >
                            <div className="min-w-0 space-y-1">
                              <p className="truncate text-sm font-medium">
                                {firstComment?.author?.login
                                  ? `@${firstComment.author.login}`
                                  : "Conversation"}{" "}
                                · L{thread.line ?? "?"}
                              </p>
                              <p className="truncate text-xs text-current/80">
                                {shortCommentPreview(firstComment?.body ?? "")}
                              </p>
                            </div>
                            <ChevronRightIcon className="size-4 shrink-0 opacity-60" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No conversations on this file yet.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </Virtualizer>
      )}
    </div>
  );
}

function PrDiffFileHeaderBadge({ cwd, path }: { cwd: string; path: string }) {
  const absolutePath = joinPath(cwd, path);
  const pathExistsQuery = useQuery(
    projectPathExistsQueryOptions({
      path: absolutePath,
    }),
  );
  if (pathExistsQuery.data?.exists !== false) {
    return null;
  }
  return <MissingOnDiskBadge path={absolutePath} compact />;
}

/** Tiny inline sparkles icon to avoid importing full lucide for a single use */
function SparklesIconInline() {
  return (
    <svg
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}
