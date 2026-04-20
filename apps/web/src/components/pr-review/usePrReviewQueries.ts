import { useQuery } from "@tanstack/react-query";
import {
  prReviewAgentStatusQueryOptions,
  prReviewConfigQueryOptions,
  prReviewConflictsQueryOptions,
  prReviewDashboardQueryOptions,
  prReviewPatchQueryOptions,
} from "~/lib/prReviewReactQuery";
import { gitListPullRequestsQueryOptions } from "~/lib/gitReactQuery";
import { usePrReviewStore } from "~/prReviewStore";

/**
 * Centralizes all PR review React Query subscriptions.
 * Reads `selectedPrNumber` and `pullRequestState` from the Zustand store.
 */
export function usePrReviewQueries(projectCwd: string | null) {
  const selectedPrNumber = usePrReviewStore((s) => s.selectedPrNumber);
  const pullRequestState = usePrReviewStore((s) => s.pullRequestState);

  const configQuery = useQuery(prReviewConfigQueryOptions(projectCwd));

  const dashboardQuery = useQuery(
    prReviewDashboardQueryOptions({
      cwd: projectCwd,
      prNumber: selectedPrNumber,
    }),
  );

  const patchQuery = useQuery(
    prReviewPatchQueryOptions({
      cwd: projectCwd,
      prNumber: selectedPrNumber,
    }),
  );

  const conflictQuery = useQuery(
    prReviewConflictsQueryOptions({
      cwd: projectCwd,
      prNumber: selectedPrNumber,
    }),
  );

  const pullRequestsQuery = useQuery(
    gitListPullRequestsQueryOptions({
      cwd: projectCwd ?? "",
      state: pullRequestState,
    }),
  );

  const agentReviewRunning =
    dashboardQuery.data != null &&
    selectedPrNumber != null;

  const agentReviewQuery = useQuery(
    prReviewAgentStatusQueryOptions({
      cwd: projectCwd,
      prNumber: selectedPrNumber,
      isRunning: agentReviewRunning,
    }),
  );

  return {
    configQuery,
    dashboardQuery,
    patchQuery,
    conflictQuery,
    pullRequestsQuery,
    agentReviewQuery,
  } as const;
}
