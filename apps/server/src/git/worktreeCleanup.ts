import { realpathSync } from "node:fs";

export interface WorktreeCleanupCandidate {
  readonly path: string;
  readonly branch: string;
  readonly prNumber: number;
  readonly prTitle: string;
  readonly prUrl: string;
  readonly mergedAt: string;
  readonly pathExists: boolean;
  readonly prunable: boolean;
}

interface WorktreeListEntry {
  path: string;
  branch: string | null;
  prunable: boolean;
}

interface MergedPullRequestLike {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly headBranch: string;
  readonly mergedAt: string;
}

function canonicalizePath(value: string): string {
  try {
    return realpathSync.native(value);
  } catch {
    return value.replace(/\\/g, "/").replace(/\/+$/, "");
  }
}

function parseWorktreeList(stdout: string): WorktreeListEntry[] {
  const entries: WorktreeListEntry[] = [];
  let current: WorktreeListEntry | null = null;

  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      if (current) {
        entries.push(current);
      }
      current = null;
      continue;
    }

    if (line.startsWith("worktree ")) {
      if (current) {
        entries.push(current);
      }
      current = {
        path: line.slice("worktree ".length).trim(),
        branch: null,
        prunable: false,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("branch refs/heads/")) {
      current.branch = line.slice("branch refs/heads/".length).trim() || null;
      continue;
    }

    if (line.startsWith("prunable")) {
      current.prunable = true;
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

export function collectMergedWorktreeCleanupCandidates(input: {
  cwd: string;
  worktreeListStdout: string;
  mergedPullRequests: ReadonlyArray<MergedPullRequestLike>;
}): WorktreeCleanupCandidate[] {
  const mergedPullRequestsByHeadBranch = new Map(
    input.mergedPullRequests.map((pr) => [pr.headBranch, pr] as const),
  );
  const rootPath = canonicalizePath(input.cwd);

  return parseWorktreeList(input.worktreeListStdout)
    .flatMap((entry) => {
      const branch = entry.branch?.trim() ?? "";
      if (!branch) {
        return [];
      }
      const pullRequest = mergedPullRequestsByHeadBranch.get(branch);
      if (!pullRequest) {
        return [];
      }

      const candidatePath = entry.path.trim();
      if (!candidatePath) {
        return [];
      }

      if (canonicalizePath(candidatePath) === rootPath) {
        return [];
      }

      return [
        {
          path: candidatePath,
          branch,
          prNumber: pullRequest.number,
          prTitle: pullRequest.title,
          prUrl: pullRequest.url,
          mergedAt: pullRequest.mergedAt,
          pathExists: !entry.prunable,
          prunable: entry.prunable,
        },
      ];
    })
    .toSorted((a, b) => {
      if (a.pathExists !== b.pathExists) {
        return a.pathExists ? -1 : 1;
      }
      if (a.mergedAt !== b.mergedAt) {
        return b.mergedAt.localeCompare(a.mergedAt);
      }
      return a.branch.localeCompare(b.branch);
    });
}
