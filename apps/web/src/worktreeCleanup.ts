import type { GitWorktreeCleanupCandidate, ThreadId } from "@okcode/contracts";

import type { Project, Thread } from "./types";

function normalizeWorktreePath(path: string | null): string | null {
  const trimmed = path?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

export function getOrphanedWorktreePathForThread(
  threads: readonly Thread[],
  threadId: Thread["id"],
): string | null {
  const targetThread = threads.find((thread) => thread.id === threadId);
  if (!targetThread) {
    return null;
  }

  const targetWorktreePath = normalizeWorktreePath(targetThread.worktreePath);
  if (!targetWorktreePath) {
    return null;
  }

  const isShared = threads.some((thread) => {
    if (thread.id === threadId) {
      return false;
    }
    return normalizeWorktreePath(thread.worktreePath) === targetWorktreePath;
  });

  return isShared ? null : targetWorktreePath;
}

export function resolveWorktreeCleanupProjectCwd(input: {
  activeThreadId: ThreadId | null | undefined;
  projects: readonly Pick<Project, "id" | "cwd">[];
  threads: readonly Pick<Thread, "id" | "projectId">[];
}): string | null {
  if (input.activeThreadId) {
    const activeThread = input.threads.find((thread) => thread.id === input.activeThreadId);
    if (activeThread) {
      const activeProject = input.projects.find((project) => project.id === activeThread.projectId);
      if (activeProject) {
        return activeProject.cwd;
      }
    }
  }

  return input.projects[0]?.cwd ?? null;
}

export interface WorktreeCleanupCandidateState {
  readonly candidate: GitWorktreeCleanupCandidate;
  readonly usageCount: number;
  readonly canDelete: boolean;
}

export function buildWorktreeCleanupCandidateStates(input: {
  candidates: readonly GitWorktreeCleanupCandidate[];
  threadWorktreePaths: readonly (string | null)[];
}): WorktreeCleanupCandidateState[] {
  return input.candidates.map((candidate) => {
    const usageCount = input.threadWorktreePaths.filter((path) => path === candidate.path).length;
    return {
      candidate,
      usageCount,
      canDelete: usageCount === 0,
    };
  });
}

/**
 * Return a human-readable relative-time label for how long ago a branch was
 * merged.  Expects an ISO-8601 `mergedAt` timestamp and an optional `now`
 * override (for deterministic testing).
 */
export function formatBranchAge(mergedAt: string, now: Date = new Date()): string {
  const mergedDate = new Date(mergedAt);
  const diffMs = now.getTime() - mergedDate.getTime();
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months >= 1) return `${months}mo ago`;
  if (weeks >= 1) return `${weeks}w ago`;
  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (minutes >= 1) return `${minutes}m ago`;
  return "just now";
}

export function formatWorktreePathForDisplay(worktreePath: string): string {
  const trimmed = worktreePath.trim();
  if (!trimmed) {
    return worktreePath;
  }

  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/");
  const lastPart = parts[parts.length - 1]?.trim() ?? "";
  return lastPart.length > 0 ? lastPart : trimmed;
}
