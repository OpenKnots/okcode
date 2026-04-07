import { ThreadId } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";

import { gitMergedWorktreeCleanupCandidatesQueryOptions } from "~/lib/gitReactQuery";
import { useStore } from "~/store";
import { resolveWorktreeCleanupProjectCwd } from "~/worktreeCleanup";

export function useCurrentWorktreeCleanupCandidates() {
  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });

  const cwd = useMemo(
    () =>
      resolveWorktreeCleanupProjectCwd({
        activeThreadId: routeThreadId,
        projects,
        threads,
      }),
    [projects, routeThreadId, threads],
  );

  const candidatesQuery = useQuery(gitMergedWorktreeCleanupCandidatesQueryOptions(cwd));
  const candidates = useMemo(
    () => (Array.isArray(candidatesQuery.data) ? candidatesQuery.data : []),
    [candidatesQuery.data],
  );

  return {
    cwd,
    candidates,
    candidatesQuery,
    hasCandidates: candidates.length > 0,
  };
}
