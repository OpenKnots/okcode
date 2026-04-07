import { memo, Suspense, use, useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { VscodeEntryIcon } from "./VscodeEntryIcon";
import { CodeHighlightErrorBoundary } from "../CodeHighlightErrorBoundary";
import { inferLanguageIdForPath } from "../../vscode-icons";
import { resolveDiffThemeName } from "~/lib/diffRendering";
import {
  extractHighlightedCodeInnerHtml,
  getCachedHighlightedHtml,
  getHighlighterPromise,
  renderHighlightedCodeHtml,
  setCachedHighlightedHtml,
} from "~/lib/syntaxHighlighting";
import type { InlineDiffData } from "../../session-logic";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DiffLineKind = "addition" | "deletion" | "context";

interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

/* ------------------------------------------------------------------ */
/*  Diff computation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Simple line-level diff between two strings.
 * Uses a basic LCS approach for short inputs, falls back to
 * showing all old lines as deletions and all new lines as additions
 * for very large inputs.
 */
function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  // For very large diffs, skip LCS and just show removed + added
  if (oldLines.length + newLines.length > 400) {
    return [
      ...oldLines.map((text): DiffLine => ({ kind: "deletion", text })),
      ...newLines.map((text): DiffLine => ({ kind: "addition", text })),
    ];
  }

  // Simple LCS for line-level diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to build diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ kind: "context", text: oldLines[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.push({ kind: "addition", text: newLines[j - 1]! });
      j--;
    } else {
      result.push({ kind: "deletion", text: oldLines[i - 1]! });
      i--;
    }
  }

  return result.toReversed();
}

/**
 * Build diff lines from InlineDiffData.
 * For edits (old_string + new_string): computes line-level diff.
 * For writes (content only): all lines are additions.
 */
function buildDiffLines(data: InlineDiffData): DiffLine[] {
  if (data.oldString != null && data.newString != null) {
    return computeLineDiff(data.oldString, data.newString);
  }
  if (data.content != null) {
    return data.content.split("\n").map((text): DiffLine => ({ kind: "addition", text }));
  }
  return [];
}

function countStats(lines: DiffLine[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.kind === "addition") additions++;
    else if (line.kind === "deletion") deletions++;
  }
  return { additions, deletions };
}

/* ------------------------------------------------------------------ */
/*  Styling                                                            */
/* ------------------------------------------------------------------ */

function lineKindStyle(kind: DiffLineKind): string {
  switch (kind) {
    case "addition":
      return "bg-emerald-500/10 border-l-emerald-500/60";
    case "deletion":
      return "bg-red-500/8 border-l-red-500/50";
    case "context":
    default:
      return "border-l-transparent";
  }
}

function lineTextStyle(kind: DiffLineKind): string {
  switch (kind) {
    case "addition":
      return "text-emerald-300";
    case "deletion":
      return "text-red-400/90";
    case "context":
    default:
      return "text-foreground/70";
  }
}

function linePrefixChar(kind: DiffLineKind): string {
  switch (kind) {
    case "addition":
      return "+";
    case "deletion":
      return "\u2212";
    case "context":
      return " ";
  }
}

function linePrefixStyle(kind: DiffLineKind): string {
  switch (kind) {
    case "addition":
      return "text-emerald-500/60";
    case "deletion":
      return "text-red-500/50";
    case "context":
    default:
      return "text-transparent";
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

/** Max lines to show before collapsing with a "show more" toggle. */
const MAX_VISIBLE_LINES = 18;

function DiffLineRow(props: { line: DiffLine; html?: string }) {
  const { line, html } = props;

  return (
    <div
      className={cn("flex border-l-2 font-mono text-[11px] leading-5", lineKindStyle(line.kind))}
    >
      <span
        className={cn(
          "flex w-5 shrink-0 select-none items-baseline justify-center text-[10px] font-bold",
          linePrefixStyle(line.kind),
        )}
      >
        {linePrefixChar(line.kind)}
      </span>
      <code
        className={cn(
          "min-w-0 flex-1 whitespace-pre-wrap break-all pr-3",
          lineTextStyle(line.kind),
        )}
        {...(html != null
          ? { dangerouslySetInnerHTML: { __html: html } }
          : { children: line.text })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const InlineDiffBlock = memo(function InlineDiffBlock(props: {
  diffData: InlineDiffData;
  resolvedTheme: "light" | "dark";
}) {
  const { diffData, resolvedTheme } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const diffThemeName = resolveDiffThemeName(resolvedTheme);

  const allLines = useMemo(() => buildDiffLines(diffData), [diffData]);
  const stats = useMemo(() => countStats(allLines), [allLines]);
  const languageId = inferLanguageIdForPath(diffData.filePath) ?? "text";
  const highlighter = use(getHighlighterPromise(languageId));
  const keyedLines = useMemo(() => {
    const occurrenceBySignature = new Map<string, number>();
    return allLines.map((line) => {
      const signature = `${line.kind}:${line.text}`;
      const occurrence = (occurrenceBySignature.get(signature) ?? 0) + 1;
      occurrenceBySignature.set(signature, occurrence);
      return {
        key: `${signature}:${occurrence}`,
        line,
      };
    });
  }, [allLines]);

  if (allLines.length === 0) return null;

  const needsTruncation = allLines.length > MAX_VISIBLE_LINES;
  const visibleLines =
    needsTruncation && !isExpanded ? keyedLines.slice(0, MAX_VISIBLE_LINES) : keyedLines;
  const hiddenCount = allLines.length - visibleLines.length;
  const fileName = basename(diffData.filePath);
  const highlightedLines = useMemo(() => {
    return visibleLines.map(({ key, line }) => {
      const cacheScope = `chat-inline-diff:${line.kind}`;
      const cachedHighlightedHtml = getCachedHighlightedHtml(
        line.text,
        languageId,
        diffThemeName,
        cacheScope,
      );
      if (cachedHighlightedHtml != null) {
        return {
          key,
          line,
          fullHtml: cachedHighlightedHtml,
          html: extractHighlightedCodeInnerHtml(cachedHighlightedHtml),
        };
      }

      const highlightedHtml = renderHighlightedCodeHtml(
        highlighter,
        line.text,
        languageId,
        diffThemeName,
      );
      return {
        key,
        line,
        fullHtml: highlightedHtml,
        html: extractHighlightedCodeInnerHtml(highlightedHtml),
      };
    });
  }, [highlighter, languageId, diffThemeName, visibleLines]);
  useEffect(() => {
    for (const { line, fullHtml } of highlightedLines) {
      const cacheScope = `chat-inline-diff:${line.kind}`;
      setCachedHighlightedHtml(line.text, languageId, diffThemeName, cacheScope, fullHtml);
    }
  }, [highlightedLines, languageId, diffThemeName]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/70">
      {/* File header */}
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5">
        <VscodeEntryIcon
          pathValue={fileName}
          kind="file"
          theme={resolvedTheme}
          className="size-3.5"
        />
        <span className="min-w-0 truncate font-mono text-xs font-medium text-foreground/90">
          {fileName}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          {stats.additions > 0 && (
            <span className="font-mono text-emerald-500">+{stats.additions}</span>
          )}
          {stats.deletions > 0 && (
            <span className="font-mono text-red-400">&minus;{stats.deletions}</span>
          )}
        </span>
      </div>

      {/* Diff lines */}
      <CodeHighlightErrorBoundary
        fallback={
          <div className="border-t border-border/40">
            {visibleLines.map(({ key, line }) => (
              <DiffLineRow key={key} line={line} />
            ))}

            {needsTruncation && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 border-t border-border/40 bg-muted/20 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-muted-foreground/80"
                onClick={() => setIsExpanded((prev) => !prev)}
              >
                {isExpanded ? (
                  <>
                    <ChevronDownIcon className="size-3 rotate-180" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="size-3 rotate-90" />
                    Show {hiddenCount} more lines
                  </>
                )}
              </button>
            )}
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="border-t border-border/40">
              {visibleLines.map(({ key, line }) => (
                <DiffLineRow key={key} line={line} />
              ))}

              {needsTruncation && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 border-t border-border/40 bg-muted/20 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-muted-foreground/80"
                  onClick={() => setIsExpanded((prev) => !prev)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronDownIcon className="size-3 rotate-180" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronRightIcon className="size-3 rotate-90" />
                      Show {hiddenCount} more lines
                    </>
                  )}
                </button>
              )}
            </div>
          }
        >
          <div className="border-t border-border/40">
            {highlightedLines.map(({ key, line, html }) => (
              <DiffLineRow key={key} line={line} html={html} />
            ))}

            {needsTruncation && (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 border-t border-border/40 bg-muted/20 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:bg-muted/40 hover:text-muted-foreground/80"
                onClick={() => setIsExpanded((prev) => !prev)}
              >
                {isExpanded ? (
                  <>
                    <ChevronDownIcon className="size-3 rotate-180" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronRightIcon className="size-3 rotate-90" />
                    Show {hiddenCount} more lines
                  </>
                )}
              </button>
            )}
          </div>
        </Suspense>
      </CodeHighlightErrorBoundary>
    </div>
  );
});
