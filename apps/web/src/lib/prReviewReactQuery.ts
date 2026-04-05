import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { ensureNativeApi } from "../nativeApi";

export const prReviewQueryKeys = {
  all: ["prReview"] as const,
  config: (cwd: string | null) => ["prReview", "config", cwd] as const,
  dashboard: (cwd: string | null, prNumber: number | null) =>
    ["prReview", "dashboard", cwd, prNumber] as const,
  patch: (cwd: string | null, prNumber: number | null) =>
    ["prReview", "patch", cwd, prNumber] as const,
  conflicts: (cwd: string | null, prNumber: number | null) =>
    ["prReview", "conflicts", cwd, prNumber] as const,
  userSearch: (cwd: string | null, query: string) => ["prReview", "users", cwd, query] as const,
  userPreview: (cwd: string | null, login: string | null) =>
    ["prReview", "user", cwd, login] as const,
};

export function invalidatePrReviewQueries(queryClient: QueryClient, cwd: string, prNumber: number) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: prReviewQueryKeys.config(cwd) }),
    queryClient.invalidateQueries({ queryKey: prReviewQueryKeys.dashboard(cwd, prNumber) }),
    queryClient.invalidateQueries({ queryKey: prReviewQueryKeys.patch(cwd, prNumber) }),
    queryClient.invalidateQueries({ queryKey: prReviewQueryKeys.conflicts(cwd, prNumber) }),
  ]);
}

export function prReviewConfigQueryOptions(cwd: string | null) {
  return queryOptions({
    queryKey: prReviewQueryKeys.config(cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!cwd) throw new Error("PR review config is unavailable.");
      return api.prReview.getConfig({ cwd });
    },
    enabled: cwd !== null,
    staleTime: 15_000,
  });
}

export function prReviewDashboardQueryOptions(input: {
  cwd: string | null;
  prNumber: number | null;
}) {
  return queryOptions({
    queryKey: prReviewQueryKeys.dashboard(input.cwd, input.prNumber),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.prNumber) throw new Error("PR review dashboard is unavailable.");
      return api.prReview.getDashboard({ cwd: input.cwd, prNumber: input.prNumber });
    },
    enabled: input.cwd !== null && input.prNumber !== null,
    staleTime: 10_000,
  });
}

export function prReviewPatchQueryOptions(input: { cwd: string | null; prNumber: number | null }) {
  return queryOptions({
    queryKey: prReviewQueryKeys.patch(input.cwd, input.prNumber),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.prNumber) throw new Error("PR review patch is unavailable.");
      return api.prReview.getPatch({ cwd: input.cwd, prNumber: input.prNumber });
    },
    enabled: input.cwd !== null && input.prNumber !== null,
    staleTime: 30_000,
  });
}

export function prReviewConflictsQueryOptions(input: {
  cwd: string | null;
  prNumber: number | null;
}) {
  return queryOptions({
    queryKey: prReviewQueryKeys.conflicts(input.cwd, input.prNumber),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.prNumber) throw new Error("PR conflict analysis is unavailable.");
      return api.prReview.analyzeConflicts({ cwd: input.cwd, prNumber: input.prNumber });
    },
    enabled: input.cwd !== null && input.prNumber !== null,
    staleTime: 10_000,
  });
}

export function prReviewSearchUsersQueryOptions(input: { cwd: string | null; query: string }) {
  return queryOptions({
    queryKey: prReviewQueryKeys.userSearch(input.cwd, input.query),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || input.query.trim().length === 0) return { users: [] };
      return api.prReview.searchUsers({ cwd: input.cwd, query: input.query.trim(), limit: 8 });
    },
    enabled: input.cwd !== null && input.query.trim().length > 0,
    staleTime: 30_000,
  });
}

export function prReviewUserPreviewQueryOptions(input: {
  cwd: string | null;
  login: string | null;
}) {
  return queryOptions({
    queryKey: prReviewQueryKeys.userPreview(input.cwd, input.login),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.login) throw new Error("GitHub user preview is unavailable.");
      return api.prReview.getUserPreview({ cwd: input.cwd, login: input.login });
    },
    enabled: input.cwd !== null && input.login !== null,
    staleTime: 60_000,
  });
}

export function prReviewAddThreadMutationOptions(input: {
  cwd: string;
  prNumber: number;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<ReturnType<typeof ensureNativeApi>["prReview"]["addThread"]>[0],
    ) => ensureNativeApi().prReview.addThread(args),
    onSuccess: async () => invalidatePrReviewQueries(input.queryClient, input.cwd, input.prNumber),
  });
}

export function prReviewReplyToThreadMutationOptions(input: {
  cwd: string;
  prNumber: number;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<ReturnType<typeof ensureNativeApi>["prReview"]["replyToThread"]>[0],
    ) => ensureNativeApi().prReview.replyToThread(args),
    onSuccess: async () => invalidatePrReviewQueries(input.queryClient, input.cwd, input.prNumber),
  });
}

export function prReviewResolveThreadMutationOptions(input: {
  cwd: string;
  prNumber: number;
  queryClient: QueryClient;
  action: "resolve" | "unresolve";
}) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<ReturnType<typeof ensureNativeApi>["prReview"]["resolveThread"]>[0],
    ) =>
      input.action === "resolve"
        ? ensureNativeApi().prReview.resolveThread(args)
        : ensureNativeApi().prReview.unresolveThread(args),
    onSuccess: async () => invalidatePrReviewQueries(input.queryClient, input.cwd, input.prNumber),
  });
}

export function prReviewRunWorkflowStepMutationOptions(input: {
  cwd: string;
  prNumber: number;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<ReturnType<typeof ensureNativeApi>["prReview"]["runWorkflowStep"]>[0],
    ) => ensureNativeApi().prReview.runWorkflowStep(args),
    onSuccess: async () => invalidatePrReviewQueries(input.queryClient, input.cwd, input.prNumber),
  });
}

export function prReviewApplyConflictResolutionMutationOptions(input: {
  cwd: string;
  prNumber: number;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<
        ReturnType<typeof ensureNativeApi>["prReview"]["applyConflictResolution"]
      >[0],
    ) => ensureNativeApi().prReview.applyConflictResolution(args),
    onSuccess: async () => invalidatePrReviewQueries(input.queryClient, input.cwd, input.prNumber),
  });
}

export function prReviewSubmitReviewMutationOptions(input: {
  cwd: string;
  prNumber: number;
  queryClient: QueryClient;
}) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<ReturnType<typeof ensureNativeApi>["prReview"]["submitReview"]>[0],
    ) => ensureNativeApi().prReview.submitReview(args),
    onSuccess: async () => invalidatePrReviewQueries(input.queryClient, input.cwd, input.prNumber),
  });
}
