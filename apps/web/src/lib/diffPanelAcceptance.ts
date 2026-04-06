import type { FileDiffMetadata } from "@pierre/diffs/react";

export function buildAcceptedDiffFileKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

export function filterAcceptedDiffFiles(
  fileDiffs: readonly FileDiffMetadata[],
  acceptedFileKeys: ReadonlySet<string>,
): FileDiffMetadata[] {
  if (acceptedFileKeys.size === 0) {
    return [...fileDiffs];
  }
  return fileDiffs.filter((fileDiff) => !acceptedFileKeys.has(buildAcceptedDiffFileKey(fileDiff)));
}
