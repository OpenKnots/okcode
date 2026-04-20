import type { FileDiffMetadata } from "@pierre/diffs/react";

import type { TurnDiffFileChange } from "../types";
import { inferLanguageIdForPath } from "../vscode-icons";
import {
  parseRenderablePatch,
  resolveFileDiffPath,
  summarizeFileDiffStats,
} from "./renderablePatch";

const DIFF_FILE_NAME_PATTERN = /\.(?:diff|patch)$/i;
const DIFF_MIME_SUBSTRING_PATTERN = /(diff|patch)/i;
const DIFF_CONTENT_PREFIXES = ["diff --git ", "Index: ", "--- ", "*** ", "Binary files "];

export type AttachmentPreviewModel =
  | {
      kind: "diff";
      text: string;
      files: FileDiffMetadata[];
    }
  | {
      kind: "text";
      text: string;
      language: string;
    };

export function isLikelyDiffAttachment(input: {
  readonly name: string;
  readonly mimeType: string;
  readonly text: string;
}): boolean {
  if (DIFF_FILE_NAME_PATTERN.test(input.name)) {
    return true;
  }
  if (DIFF_MIME_SUBSTRING_PATTERN.test(input.mimeType)) {
    return true;
  }
  const trimmed = input.text.trimStart();
  return DIFF_CONTENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function buildAttachmentPreviewTreeFiles(
  files: ReadonlyArray<FileDiffMetadata>,
): TurnDiffFileChange[] {
  return files.map((fileDiff) => {
    const stat = summarizeFileDiffStats(fileDiff);
    return {
      path: resolveFileDiffPath(fileDiff),
      additions: stat.additions,
      deletions: stat.deletions,
    };
  });
}

export function buildAttachmentPreviewModel(input: {
  readonly name: string;
  readonly mimeType: string;
  readonly text: string;
}): AttachmentPreviewModel {
  if (isLikelyDiffAttachment(input)) {
    const parsed = parseRenderablePatch(input.text, `attachment:${input.name}`);
    if (parsed?.kind === "files") {
      return {
        kind: "diff",
        text: input.text,
        files: parsed.files,
      };
    }
  }

  return {
    kind: "text",
    text: input.text,
    language: inferLanguageIdForPath(input.name) ?? "text",
  };
}
