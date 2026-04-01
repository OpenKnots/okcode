import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  CheckIcon,
  FileCode2Icon,
  FileIcon,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RawFileDiff {
  /** File path extracted from the diff header */
  path: string;
  /** Starting line index (inclusive) in the full lines array */
  startLine: number;
  /** Ending line index (exclusive) in the full lines array */
  endLine: number;
  /** Number of added lines */
  additions: number;
  /** Number of deleted lines */
  deletions: number;
}

type LineKind =
  | "addition"
  | "deletion"
  | "hunk-header"
  | "file-header"
  | "index"
  | "context"
  | "empty";

/* ------------------------------------------------------------------ */
/*  Line classification                                                */
/* ------------------------------------------------------------------ */

function classifyLine(line: string): LineKind {
  if (line.startsWith("diff --git") || line.startsWith("--- ") || line.startsWith("+++ ")) {
    return "file-header";
  }
  if (line.startsWith("@@")) {
    return "hunk-header";
  }
  if (
    line.startsWith("index ") ||
    line.startsWith("new file mode") ||
    line.startsWith("deleted file mode") ||
    line.startsWith("old mode") ||
    line.startsWith("new mode") ||
    line.startsWith("similarity index") ||
    line.startsWith("rename from") ||
    line.startsWith("rename to") ||
    line.startsWith("Binary files")
  ) {
    return "index";
  }
  if (line.startsWith("+")) {
    return "addition";
  }
  if (line.startsWith("-")) {
    return "deletion";
  }
  if (line.trim() === "") {
    return "empty";
  }
  return "context";
}

function lineKindStyles(kind: LineKind): string {
  switch (kind) {
    case "addition":
      return "bg-emerald-500/10 text-emerald-300 border-l-emerald-500/60";
    case "deletion":
      return "bg-red-500/8 text-red-400/90 border-l-red-500/50";
    case "hunk-header":
      return "bg-sky-500/8 text-sky-400 border-l-sky-500/40 font-medium";
    case "file-header":
      return "bg-violet-500/8 text-violet-300 border-l-violet-500/50 font-semibold";
    case "index":
      return "text-muted-foreground/60 border-l-transparent";
    case "empty":
      return "text-muted-foreground/40 border-l-transparent";
    case "context":
    default:
      return "text-foreground/70 border-l-transparent";
  }
}

function lineGutterStyles(kind: LineKind): string {
  switch (kind) {
    case "addition":
      return "text-emerald-600/60 dark:text-emerald-500/50";
    case "deletion":
      return "text-red-600/60 dark:text-red-500/50";
    case "hunk-header":
      return "text-sky-600/60 dark:text-sky-500/40";
    case "file-header":
      return "text-violet-600/60 dark:text-violet-500/50";
    default:
      return "text-muted-foreground/30";
  }
}

function prefixBadge(kind: LineKind): string | null {
  switch (kind) {
    case "addition":
      return "+";
    case "deletion":
      return "\u2212";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  File extraction from raw patch text                                */
/* ------------------------------------------------------------------ */

function extractFilesFromPatch(lines: string[]): RawFileDiff[] {
  const files: RawFileDiff[] = [];
  let currentFile: Partial<RawFileDiff> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith("diff --git")) {
      // Close previous file
      if (currentFile?.path) {
        files.push({
          path: currentFile.path,
          startLine: currentFile.startLine!,
          endLine: i,
          additions: currentFile.additions ?? 0,
          deletions: currentFile.deletions ?? 0,
        });
      }

      // Extract file path from "diff --git a/path b/path"
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      const path = match?.[2] ?? match?.[1] ?? line;

      currentFile = {
        path,
        startLine: i,
        additions: 0,
        deletions: 0,
      };
    } else if (currentFile) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        currentFile.additions = (currentFile.additions ?? 0) + 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        currentFile.deletions = (currentFile.deletions ?? 0) + 1;
      }
    }
  }

  // Close last file
  if (currentFile?.path) {
    files.push({
      path: currentFile.path,
      startLine: currentFile.startLine!,
      endLine: lines.length,
      additions: currentFile.additions ?? 0,
      deletions: currentFile.deletions ?? 0,
    });
  }

  return files;
}

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

function dirname(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/") + "/";
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function RawPatchLine({
  line,
  lineNumber,
  kind,
}: {
  line: string;
  lineNumber: number;
  kind: LineKind;
}) {
  const badge = prefixBadge(kind);

  return (
    <div
      className={cn(
        "group flex border-l-2 transition-colors hover:brightness-125",
        lineKindStyles(kind),
      )}
    >
      {/* Gutter: line number */}
      <span
        className={cn(
          "flex w-12 shrink-0 select-none items-baseline justify-end pr-3 text-right font-mono text-[10px] leading-6",
          lineGutterStyles(kind),
        )}
      >
        {lineNumber}
      </span>

      {/* +/- badge */}
      <span
        className={cn(
          "flex w-5 shrink-0 select-none items-baseline justify-center font-mono text-xs leading-6 font-bold",
          badge ? "opacity-80" : "opacity-0",
        )}
      >
        {badge ?? " "}
      </span>

      {/* Content */}
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-6 pr-4">
        {kind === "addition" || kind === "deletion" ? line.slice(1) : line}
      </code>
    </div>
  );
}

function FileNavigationChip({
  file,
  isActive,
  onClick,
}: {
  file: RawFileDiff;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={file.path}
      className={cn(
        "group relative flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        isActive
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
      type="button"
    >
      <FileIcon className="size-3 shrink-0 opacity-60" />
      <span className="truncate max-w-[120px]">{basename(file.path)}</span>
      <span
        className={cn(
          "shrink-0 text-[10px]",
          isActive ? "text-amber-600/80 dark:text-amber-400/80" : "text-muted-foreground/60",
        )}
      >
        +{file.additions}/-{file.deletions}
      </span>
      {isActive ? (
        <span className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-amber-500" />
      ) : null}
    </button>
  );
}

function CollapsibleFileSection({
  file,
  lines,
  isActive,
  onActivate,
}: {
  file: RawFileDiff;
  lines: string[];
  isActive: boolean;
  onActivate: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={sectionRef}
      data-raw-file={file.path}
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        isActive ? "border-amber-500/30" : "border-border/70",
      )}
    >
      {/* File header */}
      <button
        onClick={() => {
          onActivate();
          setCollapsed(!collapsed);
        }}
        className="flex w-full items-center gap-2 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
        type="button"
      >
        {collapsed ? (
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <FileCode2Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">{dirname(file.path)}</span>
        <span className="shrink-0 text-sm font-medium text-foreground">{basename(file.path)}</span>
        <span className="ml-auto flex items-center gap-2 text-xs">
          <span className="text-emerald-500">+{file.additions}</span>
          <span className="text-red-400">&minus;{file.deletions}</span>
        </span>
      </button>

      {/* Lines */}
      {!collapsed ? (
        <div className="border-t border-border/50">
          {lines.map((line, offset) => {
            const globalIndex = file.startLine + offset;
            const kind = classifyLine(line);
            // Skip the "diff --git" line itself since we show it in the header
            if (offset === 0 && kind === "file-header" && line.startsWith("diff --git")) {
              return null;
            }
            return (
              <RawPatchLine
                key={globalIndex}
                line={line}
                lineNumber={globalIndex + 1}
                kind={kind}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function RawPatchViewer({ text, reason }: { text: string; reason: string }) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const files = useMemo(() => extractFilesFromPatch(lines), [lines]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(files[0]?.path ?? null);
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Reset active file when patch changes
  useEffect(() => {
    setActiveFilePath(files[0]?.path ?? null);
  }, [files]);

  const handleScrollToFile = useCallback((path: string) => {
    setActiveFilePath(path);
    const target = scrollContainerRef.current?.querySelector(
      `[data-raw-file="${CSS.escape(path)}"]`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard errors
    }
  }, [text]);

  const hasFiles = files.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Info banner */}
      <div className="flex items-center gap-3 border-b border-border/70 bg-amber-500/5 px-4 py-2.5">
        <AlertTriangleIcon className="size-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{reason}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasFiles
              ? `${files.length} file${files.length === 1 ? "" : "s"} detected \u2022 ${lines.length} lines`
              : `${lines.length} lines of raw patch content`}
          </p>
        </div>
        <Button onClick={() => void handleCopy()} size="xs" variant="outline" className="shrink-0">
          {copied ? (
            <CheckIcon className="size-3 text-emerald-500" />
          ) : (
            <CopyIcon className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {/* File navigation strip (only when files are detected) */}
      {hasFiles ? (
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border/70 bg-background/95 px-2 py-1 scrollbar-none">
          <div
            ref={navRef}
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none"
          >
            {files.map((file) => (
              <FileNavigationChip
                key={file.path}
                file={file}
                isActive={activeFilePath === file.path}
                onClick={() => handleScrollToFile(file.path)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Diff content */}
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-3">
        {hasFiles ? (
          <div className="space-y-4">
            {files.map((file) => {
              const fileLines = lines.slice(file.startLine, file.endLine);
              return (
                <CollapsibleFileSection
                  key={file.path}
                  file={file}
                  lines={fileLines}
                  isActive={activeFilePath === file.path}
                  onActivate={() => setActiveFilePath(file.path)}
                />
              );
            })}
          </div>
        ) : (
          /* Fallback: no file structure detected, render all lines with highlighting */
          <div className="overflow-hidden rounded-xl border border-border/70">
            {lines
              .reduce<Array<{ line: string; key: string; lineNumber: number }>>(
                (items, line, lineIndex) => {
                  const lineNumber = lineIndex + 1;
                  items.push({
                    line,
                    lineNumber,
                    key: `${lineNumber}-${line}`,
                  });
                  return items;
                },
                [],
              )
              .map(({ key, line, lineNumber }) => (
                <RawPatchLine
                  key={key}
                  line={line}
                  lineNumber={lineNumber}
                  kind={classifyLine(line)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
