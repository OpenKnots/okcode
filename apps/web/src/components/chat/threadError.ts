export interface ThreadErrorPresentation {
  title: string | null;
  description: string;
  technicalDetails: string | null;
}

const WORKTREE_COMMAND_PREFIX = "Git command failed in GitCore.createWorktree:";

function extractWorktreeDetail(error: string): string | null {
  if (!error.startsWith(WORKTREE_COMMAND_PREFIX)) {
    return null;
  }

  const separatorIndex = error.lastIndexOf(" - ");
  const detail = separatorIndex >= 0 ? error.slice(separatorIndex + 3).trim() : error.trim();
  return detail.length > 0 ? detail : null;
}

export function humanizeThreadError(error: string): ThreadErrorPresentation {
  const trimmed = error.trim();
  const worktreeDetail = extractWorktreeDetail(trimmed);
  if (worktreeDetail) {
    return {
      title: "Worktree thread could not start",
      description: worktreeDetail,
      technicalDetails: trimmed,
    };
  }

  return {
    title: null,
    description: trimmed.length > 0 ? trimmed : "An unexpected error occurred.",
    technicalDetails: null,
  };
}
