import { useMemo } from "react";
import { cn } from "~/lib/utils";

/**
 * Represents a segment of a file parsed around Git conflict markers.
 *
 * - `"context"` – lines outside any conflict block
 * - `"ours-header"` – the `<<<<<<< branch` line
 * - `"ours"` – lines belonging to the current (local) side
 * - `"separator"` – the `=======` divider
 * - `"theirs"` – lines belonging to the incoming (remote) side
 * - `"theirs-header"` – the `>>>>>>> branch` line
 */
type ConflictSegmentKind =
  | "context"
  | "ours-header"
  | "ours"
  | "separator"
  | "theirs"
  | "theirs-header";

interface ConflictLine {
  kind: ConflictSegmentKind;
  text: string;
  lineNumber: number;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const MARKER_OURS_RE = /^<{7} (.+)$/;
const MARKER_SEPARATOR_RE = /^={7}$/;
const MARKER_THEIRS_RE = /^>{7} (.+)$/;

export function parseConflictMarkers(contents: string): ConflictLine[] {
  const rawLines = contents.split("\n");
  // Drop a single trailing empty line that split() creates for files ending in \n
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  const result: ConflictLine[] = [];
  let insideConflict: "ours" | "theirs" | false = false;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!;
    const lineNumber = i + 1;

    if (MARKER_OURS_RE.test(line)) {
      insideConflict = "ours";
      result.push({ kind: "ours-header", text: line, lineNumber });
    } else if (insideConflict === "ours" && MARKER_SEPARATOR_RE.test(line)) {
      insideConflict = "theirs";
      result.push({ kind: "separator", text: line, lineNumber });
    } else if (insideConflict === "theirs" && MARKER_THEIRS_RE.test(line)) {
      insideConflict = false;
      result.push({ kind: "theirs-header", text: line, lineNumber });
    } else if (insideConflict === "ours") {
      result.push({ kind: "ours", text: line, lineNumber });
    } else if (insideConflict === "theirs") {
      result.push({ kind: "theirs", text: line, lineNumber });
    } else {
      result.push({ kind: "context", text: line, lineNumber });
    }
  }

  return result;
}

const HAS_CONFLICT_RE = /(?:^|\n)<{7} /;

export function hasConflictMarkers(text: string): boolean {
  return HAS_CONFLICT_RE.test(text);
}

// ---------------------------------------------------------------------------
// Styling helpers – emulate GitHub's web conflict resolver
// ---------------------------------------------------------------------------

function lineClassName(kind: ConflictSegmentKind): string {
  switch (kind) {
    case "ours-header":
      return "bg-emerald-500/18 text-emerald-200 font-semibold";
    case "ours":
      return "bg-emerald-500/10";
    case "separator":
      return "bg-border/25 text-muted-foreground font-semibold";
    case "theirs":
      return "bg-sky-500/10";
    case "theirs-header":
      return "bg-sky-500/18 text-sky-200 font-semibold";
    case "context":
      return "";
  }
}

function gutterClassName(kind: ConflictSegmentKind): string {
  switch (kind) {
    case "ours-header":
    case "ours":
      return "border-e-emerald-500/40 text-emerald-400/60";
    case "separator":
      return "border-e-border/50 text-muted-foreground/50";
    case "theirs-header":
    case "theirs":
      return "border-e-sky-500/40 text-sky-400/60";
    case "context":
      return "border-e-border/30 text-muted-foreground/40";
  }
}

function sectionLabel(kind: ConflictSegmentKind): string | null {
  switch (kind) {
    case "ours-header":
      return "Current changes";
    case "theirs-header":
      return "Incoming changes";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConflictMarkerViewer({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = useMemo(() => parseConflictMarkers(content), [content]);
  const gutterWidth = String(lines.length).length;

  return (
    <div
      className={cn(
        "overflow-auto rounded-xl border border-border/60 bg-[#0d1117] font-mono text-xs leading-6",
        className,
      )}
      role="code"
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line) => {
            const label = sectionLabel(line.kind);
            return (
              <tr key={line.lineNumber} className={cn("group", lineClassName(line.kind))}>
                {/* Line number gutter */}
                <td
                  className={cn(
                    "select-none border-e px-2 text-right align-top tabular-nums",
                    gutterClassName(line.kind),
                  )}
                  style={{ minWidth: `${gutterWidth + 2}ch` }}
                >
                  {line.lineNumber}
                </td>

                {/* Section label badge (only on marker header lines) */}
                {label ? (
                  <td className="w-0 whitespace-nowrap px-0 align-top">
                    <span
                      className={cn(
                        "ml-2 inline-block rounded-sm px-1.5 py-px text-[10px] font-semibold uppercase leading-5 tracking-wider",
                        line.kind === "ours-header"
                          ? "bg-emerald-500/22 text-emerald-300"
                          : "bg-sky-500/22 text-sky-300",
                      )}
                    >
                      {label}
                    </span>
                  </td>
                ) : (
                  <td className="w-0 px-0" />
                )}

                {/* Code content */}
                <td className="whitespace-pre-wrap break-all px-3 text-foreground/88">
                  {line.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
