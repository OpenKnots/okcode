export interface DiffFileReviewState {
  collapsed: boolean;
  accepted: boolean;
}

export type DiffFileReviewStateByPath = Record<string, DiffFileReviewState>;

const DEFAULT_DIFF_FILE_REVIEW_STATE: DiffFileReviewState = {
  collapsed: true,
  accepted: false,
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
    },
  };
}

export function acceptAllDiffFiles(
  current: DiffFileReviewStateByPath,
  paths: ReadonlyArray<string>,
): DiffFileReviewStateByPath {
  let next = current;

  for (const path of paths) {
    const previous = next[path] ?? DEFAULT_DIFF_FILE_REVIEW_STATE;
    if (previous.accepted && previous.collapsed) {
      continue;
    }
    if (next === current) {
      next = { ...current };
    }
    next[path] = {
      accepted: true,
      collapsed: true,
      contextMode: previous.contextMode,
    };
  }

  return next;
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
