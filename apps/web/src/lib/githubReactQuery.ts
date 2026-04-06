import { mutationOptions, queryOptions, type QueryClient } from "@tanstack/react-query";
import { ensureNativeApi } from "../nativeApi";

export const githubQueryKeys = {
  all: ["github"] as const,
  issues: (cwd: string | null) => ["github", "issues", cwd] as const,
  issue: (cwd: string | null, number: number | null) => ["github", "issue", cwd, number] as const,
};

export function invalidateGithubIssueQueries(queryClient: QueryClient, cwd: string) {
  return Promise.all([queryClient.invalidateQueries({ queryKey: githubQueryKeys.issues(cwd) })]);
}

export function githubListIssuesQueryOptions(input: {
  cwd: string | null;
  assignee?: string;
  state?: "open" | "closed";
  limit?: number;
}) {
  return queryOptions({
    queryKey: githubQueryKeys.issues(input.cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) throw new Error("GitHub issues are unavailable.");
      return api.github.listIssues({
        cwd: input.cwd,
        assignee: input.assignee,
        state: input.state,
        limit: input.limit,
      });
    },
    enabled: input.cwd !== null,
    staleTime: 30_000,
  });
}

export function githubGetIssueQueryOptions(input: { cwd: string | null; number: number | null }) {
  return queryOptions({
    queryKey: githubQueryKeys.issue(input.cwd, input.number),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.number) throw new Error("GitHub issue is unavailable.");
      return api.github.getIssue({ cwd: input.cwd, number: input.number });
    },
    enabled: input.cwd !== null && input.number !== null,
    staleTime: 60_000,
  });
}

export function githubPostCommentMutationOptions(input: { cwd: string; queryClient: QueryClient }) {
  return mutationOptions({
    mutationFn: async (
      args: Parameters<ReturnType<typeof ensureNativeApi>["github"]["postComment"]>[0],
    ) => ensureNativeApi().github.postComment(args),
    onSuccess: async () => invalidateGithubIssueQueries(input.queryClient, input.cwd),
  });
}
