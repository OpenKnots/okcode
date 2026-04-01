import { FileDiff, Virtualizer } from "@pierre/diffs/react";
import type { NativeApi, PrReviewThread } from "@okcode/contracts";
import { useMemo } from "react";
import { Schema } from "effect";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FileCode2Icon,
  GitBranchIcon,
  MessageSquareIcon,
} from "lucide-react";
import { useTheme } from "~/hooks/useTheme";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";
import { useCodeViewerStore } from "~/codeViewerStore";
import type { Project } from "~/types";
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
} from "./pr-review-utils";
import { RawPatchViewer } from "./RawPatchViewer";

const FILE_VIEW_MODE_SCHEMA = Schema.Literals(["single", "all"]);

export function PrWorkspace({
  project,
  patch,
  dashboard,
  selectedFilePath,
  selectedThreadId,
  onSelectFilePath,
  onSelectThreadId,
  onCreateThread,
}: {
  project: Project;
  patch: string | null;
  dashboard: Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;
  selectedFilePath: string | null;
  selectedThreadId: string | null;
  onSelectFilePath: (path: string) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onCreateThread: (input: { path: string; line: number; body: string }) => Promise<void>;
}) {
  const { resolvedTheme } = useTheme();
  const openFileInCodeViewer = useCodeViewerStore((state) => state.openFile);
  const [fileViewMode, setFileViewMode] = useLocalStorage(
    "okcode:pr-review:file-view-mode",
    "single",
    FILE_VIEW_MODE_SCHEMA,
  );

  const renderablePatch = useMemo(
    () =>
      parseRenderablePatch(
        patch ?? undefined,
        `pr-review:${dashboard?.pullRequest.number ?? "none"}`,
      ),
    [dashboard?.pullRequest.number, patch],
  );

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Select a pull request to load the review cockpit.
      </div>
    );
  }

  const threadsByPath = dashboard.threads.reduce<Record<string, PrReviewThread[]>>(
    (acc, thread) => {
      if (!thread.path) return acc;
      if (!acc[thread.path]) acc[thread.path] = [];
      acc[thread.path]!.push(thread);
      return acc;
    },
    {},
  );

  const patchFiles = renderablePatch?.kind === "files" ? renderablePatch.files : [];

  // In single-file mode, filter to just the selected file
  const visibleFiles =
    fileViewMode === "single" && selectedFilePath
      ? patchFiles.filter((f) => resolveFileDiffPath(f) === selectedFilePath)
      : patchFiles;

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

      {/* File tab strip */}
      {patchFiles.length > 0 ? (
        <PrFileTabStrip
          files={patchFiles}
          threads={dashboard.threads}
          selectedFilePath={selectedFilePath}
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
          {visibleFiles.map((fileDiff) => {
            const filePath = resolveFileDiffPath(fileDiff);
            const fileKey = `${buildFileDiffRenderKey(fileDiff)}:${resolvedTheme}`;
            const fileThreads = threadsByPath[filePath] ?? [];
            const isSelected = selectedFilePath === filePath;
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
