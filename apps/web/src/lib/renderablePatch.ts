import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";

import { buildPatchCacheKey } from "./diffRendering";

export type RenderablePatch =
  | { kind: "files"; files: FileDiffMetadata[] }
  | { kind: "raw"; text: string; reason: string };

export function parseRenderablePatch(
  patch: string | undefined,
  scope = "renderable-patch",
): RenderablePatch | null {
  if (!patch || patch.trim().length === 0) return null;
  const normalizedPatch = patch.trim();

  try {
    const parsed = parsePatchFiles(normalizedPatch, buildPatchCacheKey(normalizedPatch, scope));
    const files = parsed.flatMap((entry) => entry.files);
    if (files.length === 0) {
      return {
        kind: "raw",
        text: normalizedPatch,
        reason: "Unsupported diff format. Showing raw patch instead.",
      };
    }
    return { kind: "files", files };
  } catch {
    return {
      kind: "raw",
      text: normalizedPatch,
      reason: "Failed to parse patch. Showing raw patch instead.",
    };
  }
}

export function summarizeFileDiffStats(fileDiff: FileDiffMetadata): {
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

export function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}
