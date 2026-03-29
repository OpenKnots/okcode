import type { SkillListResult, SkillSearchResult } from "@okcode/contracts";
import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const skillQueryKeys = {
  all: ["skills"] as const,
  list: (cwd: string | null) => ["skills", "list", cwd] as const,
  search: (cwd: string | null, query: string) => ["skills", "search", cwd, query] as const,
};

const EMPTY_SKILL_LIST_RESULT: SkillListResult = { skills: [] };

export function skillListQueryOptions(input: {
  cwd: string | null;
  enabled?: boolean;
  staleTime?: number;
}) {
  return queryOptions({
    queryKey: skillQueryKeys.list(input.cwd),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd) return EMPTY_SKILL_LIST_RESULT;
      return api.skills.list({ cwd: input.cwd });
    },
    enabled: input.enabled !== false,
    staleTime: input.staleTime ?? 30_000,
    placeholderData: EMPTY_SKILL_LIST_RESULT,
  });
}

export function skillSearchQueryOptions(input: {
  cwd: string | null;
  query: string;
  enabled?: boolean;
}) {
  const EMPTY_SEARCH_RESULT: SkillSearchResult = { skills: [] };
  return queryOptions({
    queryKey: skillQueryKeys.search(input.cwd, input.query),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!input.cwd || !input.query.trim()) return EMPTY_SEARCH_RESULT;
      return api.skills.search({ query: input.query, cwd: input.cwd });
    },
    enabled: input.enabled !== false && input.query.trim().length > 0,
    staleTime: 15_000,
    placeholderData: EMPTY_SEARCH_RESULT,
  });
}
