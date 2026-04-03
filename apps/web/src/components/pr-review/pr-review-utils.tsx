import { parsePatchFiles } from "@pierre/diffs";
import type { FileDiffMetadata } from "@pierre/diffs/react";
import type {
  GitHubUserPreview,
  PrReviewConfig,
  PrReviewParticipant,
  PrReviewThread,
  PrWorkflowDefinition,
} from "@okcode/contracts";
import { Schema } from "effect";
import { CircleDotIcon, GitMergeIcon, GitPullRequestIcon, XCircleIcon } from "lucide-react";
import { openInPreferredEditor } from "~/editorPreferences";
import { buildPatchCacheKey } from "~/lib/diffRendering";
import { ensureNativeApi } from "~/nativeApi";

export type PullRequestState = "open" | "closed" | "merged";
export type InspectorTab = "threads" | "workflow" | "people";

export type RenderablePatch =
  | { kind: "files"; files: FileDiffMetadata[] }
  | { kind: "raw"; text: string; reason: string };

export const TEXT_DRAFT_SCHEMA = Schema.String;
export const REVIEWED_FILES_SCHEMA = Schema.Array(Schema.String);

export const PR_REVIEW_DIFF_UNSAFE_CSS = `
[data-diff],
[data-file],
[data-diffs-header],
[data-error-wrapper],
[data-virtualizer-buffer] {
  --diffs-bg: color-mix(in srgb, var(--card) 92%, var(--background)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--card) 92%, var(--background)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--card) 92%, var(--background)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;
  --diffs-bg-context-override: color-mix(in srgb, var(--background) 97%, var(--foreground));
  --diffs-bg-hover-override: color-mix(in srgb, var(--background) 95%, var(--foreground));
  --diffs-bg-separator-override: color-mix(in srgb, var(--background) 96%, var(--foreground));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--background) 92%, var(--foreground));
  --diffs-bg-addition-override: color-mix(in srgb, var(--background) 90%, #1f9d55);
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--background) 86%, #1f9d55);
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--background) 82%, #1f9d55);
  --diffs-bg-deletion-override: color-mix(in srgb, var(--background) 90%, #dc6b2f);
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--background) 86%, #dc6b2f);
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--background) 82%, #dc6b2f);
  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  background-color: color-mix(in srgb, var(--card) 96%, var(--foreground)) !important;
  border-block-color: var(--border) !important;
  color: var(--foreground) !important;
}
`;

export function formatRelativeTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export function stateTone(state: PullRequestState | string) {
  switch (state) {
    case "open":
      return "text-emerald-500";
    case "merged":
      return "text-sky-500";
    case "closed":
      return "text-muted-foreground";
    default:
      return "text-amber-500";
  }
}

export function stateBadgeClassName(state: PullRequestState | string, active = false) {
  if (active) {
    switch (state) {
      case "open":
        return "border-emerald-500/30 bg-emerald-500/12 text-emerald-600 dark:text-emerald-300";
      case "merged":
        return "border-sky-500/30 bg-sky-500/12 text-sky-600 dark:text-sky-300";
      case "closed":
        return "border-border bg-muted/70 text-foreground";
      default:
        return "border-amber-500/30 bg-amber-500/12 text-amber-600 dark:text-amber-300";
    }
  }
  return "border-border/70 bg-background text-muted-foreground hover:bg-muted/45";
}

export function stateIcon(state: PullRequestState | string, className = "size-4") {
  switch (state) {
    case "open":
      return <GitPullRequestIcon className={className} />;
    case "merged":
      return <GitMergeIcon className={className} />;
    case "closed":
      return <XCircleIcon className={className} />;
    default:
      return <CircleDotIcon className={className} />;
  }
}

export function threadTone(state: PrReviewThread["state"]) {
  switch (state) {
    case "resolved":
      return "border-emerald-500/20 bg-emerald-500/8 text-emerald-600 dark:text-emerald-300";
    case "outdated":
      return "border-border bg-muted/45 text-muted-foreground";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}

export function labelStyle(hex: string) {
  if (!hex) return undefined;
  return { backgroundColor: `#${hex}` };
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

export function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}

export function parseRenderablePatch(
  patch: string | undefined,
  scope = "pr-review",
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

export function extractMentionQuery(
  value: string,
  selectionStart: number | null,
): { query: string; from: number; to: number } | null {
  if (selectionStart === null) return null;
  const beforeCursor = value.slice(0, selectionStart);
  const match = beforeCursor.match(/(^|\s)@([a-zA-Z0-9-]{0,39})$/);
  if (!match) return null;
  const query = match[2] ?? "";
  return {
    query,
    from: selectionStart - query.length - 1,
    to: selectionStart,
  };
}

export function mergeMentionCandidates(
  participants: readonly PrReviewParticipant[],
  users: readonly GitHubUserPreview[],
  query: string,
): GitHubUserPreview[] {
  const normalizedQuery = query.trim().toLowerCase();
  const entries: GitHubUserPreview[] = [];
  const seen = new Set<string>();

  const maybePush = (user: GitHubUserPreview | null) => {
    if (!user) return;
    if (
      normalizedQuery.length > 0 &&
      !user.login.toLowerCase().includes(normalizedQuery) &&
      !(user.name ?? "").toLowerCase().includes(normalizedQuery)
    ) {
      return;
    }
    if (seen.has(user.login)) return;
    seen.add(user.login);
    entries.push(user);
  };

  for (const participant of participants) {
    maybePush(participant.user);
  }
  for (const user of users) {
    maybePush(user);
  }

  return entries.slice(0, 8);
}

export function shortCommentPreview(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim().slice(0, 96) || "Empty comment";
}

export function requiredChecksState(
  config: PrReviewConfig,
  checks: readonly { name: string; status: string; conclusion: string | null }[],
) {
  const requiredChecks = config.rules.requiredChecks;
  if (requiredChecks.length === 0) {
    return { failing: [] as string[], pending: [] as string[] };
  }
  const failing: string[] = [];
  const pending: string[] = [];
  for (const requiredCheck of requiredChecks) {
    const match = checks.find((entry) => entry.name === requiredCheck);
    if (!match) {
      pending.push(requiredCheck);
      continue;
    }
    const conclusion = match.conclusion?.toLowerCase();
    const status = match.status.toLowerCase();
    if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") {
      continue;
    }
    if (status === "completed") {
      failing.push(requiredCheck);
    } else {
      pending.push(requiredCheck);
    }
  }
  return { failing, pending };
}

export function resolveWorkflow(
  config: PrReviewConfig | undefined,
  workflowId: string | null,
): PrWorkflowDefinition | null {
  if (!config) return null;
  if (workflowId) {
    const explicit = config.workflows.find((entry) => entry.id === workflowId);
    if (explicit) return explicit;
  }
  return (
    config.workflows.find((entry) => entry.id === config.defaultWorkflowId) ??
    config.workflows[0] ??
    null
  );
}

export async function openPathInEditor(targetPath: string) {
  await openInPreferredEditor(ensureNativeApi(), targetPath);
}
