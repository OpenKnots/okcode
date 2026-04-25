import type { ThreadId } from "@okcode/contracts";
import type { DraftThreadState } from "./composerDraftStore";
import type { Thread } from "./types";
import { normalizeThreadTitle } from "./threadTitle";

export function buildLocalDraftThread(
  threadId: ThreadId,
  draftThread: DraftThreadState,
  fallbackModel: string,
  error: string | null,
): Thread {
  return {
    id: threadId,
    codexThreadId: null,
    kind: "thread",
    projectId: draftThread.projectId,
    title: normalizeThreadTitle(draftThread.title),
    model: fallbackModel,
    runtimeMode: draftThread.runtimeMode,
    interactionMode: draftThread.interactionMode,
    session: null,
    messages: [],
    error,
    createdAt: draftThread.createdAt,
    latestTurn: null,
    lastVisitedAt: draftThread.createdAt,
    branch: draftThread.branch,
    worktreePath: draftThread.worktreePath,
    worktreeBaseBranch: null,
    ...(draftThread.githubRef ? { githubRef: draftThread.githubRef } : {}),
    turnDiffSummaries: [],
    activities: [],
    proposedPlans: [],
  };
}
