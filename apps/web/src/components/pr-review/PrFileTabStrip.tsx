import type { FileDiffMetadata } from "@pierre/diffs/react";
import type { PrReviewThread } from "@okcode/contracts";
import { useMemo, useRef, useEffect } from "react";
import { ListIcon, FileIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { resolveFileDiffPath, summarizeFileDiffStats } from "./pr-review-utils";

export type FileViewMode = "single" | "all";

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

export function PrFileTabStrip({
  files,
  threads,
  selectedFilePath,
  onSelectFilePath,
  fileViewMode,
  onFileViewModeChange,
}: {
  files: FileDiffMetadata[];
  threads: readonly PrReviewThread[];
  selectedFilePath: string | null;
  onSelectFilePath: (path: string) => void;
  fileViewMode: FileViewMode;
  onFileViewModeChange: (mode: FileViewMode) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const threadsByPath = useMemo(() => {
    const map: Record<string, number> = {};
    for (const thread of threads) {
      if (thread.path) {
        map[thread.path] = (map[thread.path] ?? 0) + 1;
      }
    }
    return map;
  }, [threads]);

  const fileEntries = useMemo(
    () =>
      files.map((fileDiff) => {
        const path = resolveFileDiffPath(fileDiff);
        const stats = summarizeFileDiffStats(fileDiff);
        return {
          path,
          basename: basename(path),
          additions: stats.additions,
          deletions: stats.deletions,
          threadCount: threadsByPath[path] ?? 0,
        };
      }),
    [files, threadsByPath],
  );

  // Scroll the active tab into view when it changes
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedFilePath]);

  if (fileEntries.length === 0) return null;

  return (
    <div className="flex items-center gap-1 border-b border-border/70 bg-background/95 px-2">
      <div
        ref={scrollRef}
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none py-1"
      >
        {fileEntries.map((entry) => {
          const isActive = selectedFilePath === entry.path;
          return (
            <button
              ref={isActive ? activeTabRef : undefined}
              key={entry.path}
              title={entry.path.split("/").pop() ?? entry.path}
              onClick={() => onSelectFilePath(entry.path)}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              type="button"
            >
              <FileIcon className="size-3 shrink-0 opacity-60" />
              <span className="truncate max-w-[120px]">{entry.basename}</span>
              <span
                className={cn(
                  "shrink-0 text-[10px]",
                  isActive
                    ? "text-amber-600/80 dark:text-amber-400/80"
                    : "text-muted-foreground/60",
                )}
              >
                +{entry.additions}/-{entry.deletions}
              </span>
              {entry.threadCount > 0 ? (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                  {entry.threadCount}
                </span>
              ) : null}
              {isActive ? (
                <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-amber-500" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center border-l border-border/50 pl-1">
        <Button
          size="icon-xs"
          variant={fileViewMode === "all" ? "secondary" : "ghost"}
          onClick={() => onFileViewModeChange(fileViewMode === "all" ? "single" : "all")}
          title={fileViewMode === "all" ? "Show single file" : "Show all files"}
        >
          <ListIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
