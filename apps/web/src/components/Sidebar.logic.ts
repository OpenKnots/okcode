import { DEFAULT_MODEL_BY_PROVIDER } from "@okcode/contracts";
import type { SidebarProjectSortOrder, SidebarThreadSortOrder } from "../appSettings";
import type { DraftThreadState } from "../composerDraftStore";
import { buildLocalDraftThread } from "../draftThreads";
import type { Thread } from "../types";
import { cn } from "../lib/utils";
import {
  findLatestProposedPlan,
  hasActionableProposedPlan,
  isLatestTurnSettled,
} from "../session-logic";

export const THREAD_SELECTION_SAFE_SELECTOR = "[data-thread-item], [data-thread-selection-safe]";
export type SidebarNewThreadEnvMode = "local" | "worktree";
type SidebarProject = {
  id: Thread["projectId"];
  name: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
};
type SidebarThreadSortInput = Pick<Thread, "createdAt" | "updatedAt" | "messages">;
type SidebarProjectThread = Pick<Thread, "projectId">;

export interface ThreadStatusPill {
  label:
    | "Error"
    | "Working"
    | "Connecting"
    | "Completed"
    | "Pending Approval"
    | "Awaiting Input"
    | "Plan Ready";
  colorClass: string;
  dotClass: string;
  pulse: boolean;
}

const THREAD_STATUS_PRIORITY: Record<ThreadStatusPill["label"], number> = {
  Error: 6,
  "Pending Approval": 5,
  "Awaiting Input": 4,
  Working: 3,
  Connecting: 3,
  "Plan Ready": 2,
  Completed: 1,
};

type ThreadStatusInput = Pick<
  Thread,
  "error" | "interactionMode" | "latestTurn" | "lastVisitedAt" | "proposedPlans" | "session"
>;

export function isActionableThreadStatus(status: ThreadStatusPill | null): boolean {
  if (!status) {
    return false;
  }
  return (
    status.label === "Error" ||
    status.label === "Pending Approval" ||
    status.label === "Awaiting Input" ||
    status.label === "Plan Ready"
  );
}

export function hasUnseenCompletion(thread: ThreadStatusInput): boolean {
  if (!thread.latestTurn?.completedAt) return false;
  const completedAt = Date.parse(thread.latestTurn.completedAt);
  if (Number.isNaN(completedAt)) return false;
  if (!thread.lastVisitedAt) return true;

  const lastVisitedAt = Date.parse(thread.lastVisitedAt);
  if (Number.isNaN(lastVisitedAt)) return true;
  return completedAt > lastVisitedAt;
}

export function shouldClearThreadSelectionOnMouseDown(target: HTMLElement | null): boolean {
  if (target === null) return true;
  return !target.closest(THREAD_SELECTION_SAFE_SELECTOR);
}

export function resolveSidebarNewThreadEnvMode(input: {
  requestedEnvMode?: SidebarNewThreadEnvMode;
  defaultEnvMode: SidebarNewThreadEnvMode;
}): SidebarNewThreadEnvMode {
  return input.requestedEnvMode ?? input.defaultEnvMode;
}

export function resolveThreadRowClassName(input: {
  isActive: boolean;
  isSelected: boolean;
}): string {
  const baseClassName =
    "h-7 w-full translate-x-0 cursor-pointer justify-start px-2 text-left select-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

  if (input.isSelected && input.isActive) {
    return cn(
      baseClassName,
      "bg-primary/22 text-foreground font-medium hover:bg-primary/26 hover:text-foreground dark:bg-primary/30 dark:hover:bg-primary/36",
    );
  }

  if (input.isSelected) {
    return cn(
      baseClassName,
      "bg-primary/15 text-foreground hover:bg-primary/19 hover:text-foreground dark:bg-primary/22 dark:hover:bg-primary/28",
    );
  }

  if (input.isActive) {
    return cn(
      baseClassName,
      "bg-accent/85 text-foreground font-medium hover:bg-accent hover:text-foreground dark:bg-accent/55 dark:hover:bg-accent/70",
    );
  }

  return cn(baseClassName, "text-muted-foreground hover:bg-accent hover:text-foreground");
}

export function resolveProjectNameTone(input: {
  isSelectedProject: boolean;
  accentProjectNames: boolean;
  visualIndex: number;
}): "project" | "mutedStrong" | "mutedSoft" {
  if (input.isSelectedProject || input.accentProjectNames) {
    return "project";
  }

  return input.visualIndex % 2 === 0 ? "mutedStrong" : "mutedSoft";
}

export function resolveThreadStatusPill(input: {
  thread: ThreadStatusInput;
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
}): ThreadStatusPill | null {
  const { hasPendingApprovals, hasPendingUserInput, thread } = input;

  if (thread.session?.status === "error") {
    return {
      label: "Error",
      colorClass: "text-rose-600 dark:text-rose-300/90",
      dotClass: "bg-rose-500 dark:bg-rose-300/90",
      pulse: false,
    };
  }

  if (hasPendingApprovals) {
    return {
      label: "Pending Approval",
      colorClass: "text-amber-600 dark:text-amber-300/90",
      dotClass: "bg-amber-500 dark:bg-amber-300/90",
      pulse: false,
    };
  }

  if (hasPendingUserInput) {
    return {
      label: "Awaiting Input",
      colorClass: "text-indigo-600 dark:text-indigo-300/90",
      dotClass: "bg-indigo-500 dark:bg-indigo-300/90",
      pulse: false,
    };
  }

  if (thread.session?.status === "running") {
    return {
      label: "Working",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      dotClass: "bg-sky-500 dark:bg-sky-300/80",
      pulse: true,
    };
  }

  if (thread.session?.status === "connecting") {
    return {
      label: "Connecting",
      colorClass: "text-sky-600 dark:text-sky-300/80",
      dotClass: "bg-sky-500 dark:bg-sky-300/80",
      pulse: true,
    };
  }

  const hasPlanReadyPrompt =
    !hasPendingUserInput &&
    thread.interactionMode === "plan" &&
    isLatestTurnSettled(thread.latestTurn, thread.session) &&
    hasActionableProposedPlan(
      findLatestProposedPlan(thread.proposedPlans, thread.latestTurn?.turnId ?? null),
    );
  if (hasPlanReadyPrompt) {
    return {
      label: "Plan Ready",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      dotClass: "bg-violet-500 dark:bg-violet-300/90",
      pulse: false,
    };
  }

  if (hasUnseenCompletion(thread)) {
    return {
      label: "Completed",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      dotClass: "bg-emerald-500 dark:bg-emerald-300/90",
      pulse: false,
    };
  }

  return null;
}

export function resolveProjectStatusIndicator(
  statuses: ReadonlyArray<ThreadStatusPill | null>,
): ThreadStatusPill | null {
  let highestPriorityStatus: ThreadStatusPill | null = null;

  for (const status of statuses) {
    if (status === null) continue;
    if (
      highestPriorityStatus === null ||
      THREAD_STATUS_PRIORITY[status.label] > THREAD_STATUS_PRIORITY[highestPriorityStatus.label]
    ) {
      highestPriorityStatus = status;
    }
  }

  return highestPriorityStatus;
}

export function getVisibleThreadsForProject(input: {
  threads: readonly Thread[];
  activeThreadId: Thread["id"] | undefined;
  isThreadListExpanded: boolean;
  previewLimit: number;
}): {
  hasHiddenThreads: boolean;
  visibleThreads: Thread[];
} {
  const { activeThreadId, isThreadListExpanded, previewLimit, threads } = input;
  const hasHiddenThreads = threads.length > previewLimit;

  if (!hasHiddenThreads || isThreadListExpanded) {
    return {
      hasHiddenThreads,
      visibleThreads: [...threads],
    };
  }

  const previewThreads = threads.slice(0, previewLimit);
  if (!activeThreadId || previewThreads.some((thread) => thread.id === activeThreadId)) {
    return {
      hasHiddenThreads: true,
      visibleThreads: previewThreads,
    };
  }

  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  if (!activeThread) {
    return {
      hasHiddenThreads: true,
      visibleThreads: previewThreads,
    };
  }

  const visibleThreadIds = new Set([...previewThreads, activeThread].map((thread) => thread.id));

  return {
    hasHiddenThreads: true,
    visibleThreads: threads.filter((thread) => visibleThreadIds.has(thread.id)),
  };
}

export function groupThreadsByProjectId<TThread extends SidebarProjectThread>(
  threads: readonly TThread[],
): Map<TThread["projectId"], TThread[]> {
  const threadsByProjectId = new Map<TThread["projectId"], TThread[]>();

  for (const thread of threads) {
    const existing = threadsByProjectId.get(thread.projectId);
    if (existing) {
      existing.push(thread);
      continue;
    }
    threadsByProjectId.set(thread.projectId, [thread]);
  }

  return threadsByProjectId;
}

export function mergeDraftThreadsIntoSidebarThreads(input: {
  serverThreads: readonly Thread[];
  draftThreadsByThreadId: Readonly<Record<string, DraftThreadState>>;
  projectModelByProjectId: ReadonlyMap<Thread["projectId"], string>;
}): Thread[] {
  const serverThreadIds = new Set(input.serverThreads.map((thread) => thread.id));
  const mergedThreads = [...input.serverThreads];

  for (const [threadId, draftThread] of Object.entries(input.draftThreadsByThreadId)) {
    if (serverThreadIds.has(threadId as Thread["id"])) {
      continue;
    }
    const fallbackModel =
      input.projectModelByProjectId.get(draftThread.projectId) ?? DEFAULT_MODEL_BY_PROVIDER.codex;
    mergedThreads.push(
      buildLocalDraftThread(threadId as Thread["id"], draftThread, fallbackModel, null),
    );
  }

  return mergedThreads;
}

function toSortableTimestamp(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function getLatestUserMessageTimestamp(thread: SidebarThreadSortInput): number {
  let latestUserMessageTimestamp: number | null = null;

  for (const message of thread.messages) {
    if (message.role !== "user") continue;
    const messageTimestamp = toSortableTimestamp(message.createdAt);
    if (messageTimestamp === null) continue;
    latestUserMessageTimestamp =
      latestUserMessageTimestamp === null
        ? messageTimestamp
        : Math.max(latestUserMessageTimestamp, messageTimestamp);
  }

  if (latestUserMessageTimestamp !== null) {
    return latestUserMessageTimestamp;
  }

  return toSortableTimestamp(thread.updatedAt ?? thread.createdAt) ?? Number.NEGATIVE_INFINITY;
}

function getThreadSortTimestamp(
  thread: SidebarThreadSortInput,
  sortOrder: SidebarThreadSortOrder | Exclude<SidebarProjectSortOrder, "manual">,
): number {
  if (sortOrder === "created_at") {
    return toSortableTimestamp(thread.createdAt) ?? Number.NEGATIVE_INFINITY;
  }
  return getLatestUserMessageTimestamp(thread);
}

export function sortThreadsForSidebar<
  T extends Pick<Thread, "id" | "createdAt" | "updatedAt" | "messages">,
>(threads: readonly T[], sortOrder: SidebarThreadSortOrder): T[] {
  return threads.toSorted((left, right) => {
    const rightTimestamp = getThreadSortTimestamp(right, sortOrder);
    const leftTimestamp = getThreadSortTimestamp(left, sortOrder);
    const byTimestamp =
      rightTimestamp === leftTimestamp ? 0 : rightTimestamp > leftTimestamp ? 1 : -1;
    if (byTimestamp !== 0) return byTimestamp;
    return right.id.localeCompare(left.id);
  });
}

export function sortThreadsByProjectIdForSidebar<
  TThread extends SidebarProjectThread &
    Pick<Thread, "id" | "createdAt" | "updatedAt" | "messages">,
>(
  threads: readonly TThread[],
  sortOrder: SidebarThreadSortOrder,
): Map<TThread["projectId"], TThread[]> {
  const sortedThreadsByProjectId = new Map<TThread["projectId"], TThread[]>();

  for (const [projectId, projectThreads] of groupThreadsByProjectId(threads)) {
    sortedThreadsByProjectId.set(projectId, sortThreadsForSidebar(projectThreads, sortOrder));
  }

  return sortedThreadsByProjectId;
}

export function getProjectSortTimestamp(
  project: SidebarProject,
  projectThreads: readonly SidebarThreadSortInput[],
  sortOrder: Exclude<SidebarProjectSortOrder, "manual">,
): number {
  if (projectThreads.length > 0) {
    return projectThreads.reduce(
      (latest, thread) => Math.max(latest, getThreadSortTimestamp(thread, sortOrder)),
      Number.NEGATIVE_INFINITY,
    );
  }

  if (sortOrder === "created_at") {
    return toSortableTimestamp(project.createdAt) ?? Number.NEGATIVE_INFINITY;
  }
  return toSortableTimestamp(project.updatedAt ?? project.createdAt) ?? Number.NEGATIVE_INFINITY;
}

// ── Path disambiguation for duplicate project names ──────────────────

type DisambiguableProject = { id: string; name: string; cwd: string };

/**
 * Computes disambiguating path labels for projects that share the same display name.
 * Returns a Map from projectId to a short path hint (e.g. "~/work/api" vs "~/personal").
 * Projects with unique names will not appear in the map.
 */
export function computeProjectDisambiguationPaths(
  projects: readonly DisambiguableProject[],
): Map<string, string> {
  const result = new Map<string, string>();

  // Group projects by display name
  const byName = new Map<string, DisambiguableProject[]>();
  for (const project of projects) {
    const group = byName.get(project.name) ?? [];
    group.push(project);
    byName.set(project.name, group);
  }

  for (const [, group] of byName) {
    if (group.length <= 1) continue;

    // Split each project's cwd into path segments (excluding the final segment which is the name)
    const segmentsList = group.map((project) => {
      const parts = project.cwd.replace(/\\/g, "/").replace(/\/+$/, "").split("/");
      // Remove the last segment (the project folder name itself)
      parts.pop();
      return parts;
    });

    // Walk up the path segments until we find enough to disambiguate each project
    // Start with 1 parent segment and increase until all are unique
    let depth = 1;
    const maxDepth = Math.max(...segmentsList.map((s) => s.length));

    while (depth <= maxDepth) {
      const suffixes = segmentsList.map((segments) => {
        const start = Math.max(0, segments.length - depth);
        return segments.slice(start).join("/");
      });

      // Check if all suffixes are unique
      const unique = new Set(suffixes);
      if (unique.size === group.length) {
        for (let i = 0; i < group.length; i++) {
          result.set(group[i]!.id, suffixes[i]!);
        }
        break;
      }
      depth++;
    }

    // If we exhausted depth and still have duplicates (identical paths), use full parent path
    if (depth > maxDepth) {
      for (let i = 0; i < group.length; i++) {
        const fullParent = segmentsList[i]!.join("/");
        if (fullParent) {
          result.set(group[i]!.id, fullParent);
        }
      }
    }
  }

  return result;
}

export function sortProjectsForSidebar<TProject extends SidebarProject, TThread extends Thread>(
  projects: readonly TProject[],
  threads: readonly TThread[],
  sortOrder: SidebarProjectSortOrder,
): TProject[] {
  if (sortOrder === "manual") {
    return [...projects];
  }

  const threadsByProjectId = groupThreadsByProjectId(threads);

  return [...projects].toSorted((left, right) => {
    const rightTimestamp = getProjectSortTimestamp(
      right,
      threadsByProjectId.get(right.id) ?? [],
      sortOrder,
    );
    const leftTimestamp = getProjectSortTimestamp(
      left,
      threadsByProjectId.get(left.id) ?? [],
      sortOrder,
    );
    const byTimestamp =
      rightTimestamp === leftTimestamp ? 0 : rightTimestamp > leftTimestamp ? 1 : -1;
    if (byTimestamp !== 0) return byTimestamp;
    return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
  });
}
