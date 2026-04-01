export interface DiffFileReviewState {
  collapsed: boolean;
  accepted: boolean;
  contextMode: "patch" | "full";
}

export type DiffFileReviewStateByPath = Record<string, DiffFileReviewState>;

const DEFAULT_DIFF_FILE_REVIEW_STATE: DiffFileReviewState = {
  collapsed: true,
  accepted: false,
  contextMode: "patch",
};

export function reconcileDiffFileReviewState(
  paths: ReadonlyArray<string>,
  current: DiffFileReviewStateByPath | undefined,
): DiffFileReviewStateByPath {
  const next: DiffFileReviewStateByPath = {};
  for (const path of paths) {
    next[path] = current?.[path] ?? DEFAULT_DIFF_FILE_REVIEW_STATE;
  }
  return next;
}

export function toggleDiffFileAccepted(
  current: DiffFileReviewStateByPath,
  path: string,
): DiffFileReviewStateByPath {
  const previous = current[path] ?? DEFAULT_DIFF_FILE_REVIEW_STATE;
  const accepted = !previous.accepted;
  return {
    ...current,
    [path]: {
      accepted,
      collapsed: accepted,
      contextMode: previous.contextMode,
    },
  };
}

export function toggleDiffFileCollapsed(
  current: DiffFileReviewStateByPath,
  path: string,
): DiffFileReviewStateByPath {
  const previous = current[path] ?? DEFAULT_DIFF_FILE_REVIEW_STATE;
  return {
    ...current,
    [path]: {
      ...previous,
      collapsed: !previous.collapsed,
    },
  };
}

export function setDiffFileContextMode(
  current: DiffFileReviewStateByPath,
  path: string,
  contextMode: "patch" | "full",
): DiffFileReviewStateByPath {
  const previous = current[path] ?? DEFAULT_DIFF_FILE_REVIEW_STATE;
  if (previous.contextMode === contextMode) {
    return current;
  }
  return {
    ...current,
    [path]: {
      ...previous,
      contextMode,
    },
  };
}

export function expandDiffFile(
  current: DiffFileReviewStateByPath,
  path: string,
): DiffFileReviewStateByPath {
  const previous = current[path] ?? DEFAULT_DIFF_FILE_REVIEW_STATE;
  if (!previous.collapsed) {
    return current;
  }
  return {
    ...current,
    [path]: {
      ...previous,
      collapsed: false,
    },
  };
}
