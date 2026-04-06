import type { ThreadId } from "@okcode/contracts";

const GIT_PULL_REQUEST_ACTION_EVENT = "okcode:git-pull-request-action";

interface GitPullRequestActionDetail {
  threadId: ThreadId;
}

export function dispatchGitPullRequestAction(threadId: ThreadId): void {
  window.dispatchEvent(
    new CustomEvent<GitPullRequestActionDetail>(GIT_PULL_REQUEST_ACTION_EVENT, {
      detail: { threadId },
    }),
  );
}

export function subscribeToGitPullRequestAction(
  listener: (detail: GitPullRequestActionDetail) => void,
): () => void {
  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<GitPullRequestActionDetail>).detail;
    if (!detail?.threadId) {
      return;
    }
    listener(detail);
  };

  window.addEventListener(GIT_PULL_REQUEST_ACTION_EVENT, handleEvent);
  return () => {
    window.removeEventListener(GIT_PULL_REQUEST_ACTION_EVENT, handleEvent);
  };
}
