import type {
  GlobalEnvironmentVariablesResult,
  ProjectId,
  ProjectEnvironmentVariablesResult,
} from "@okcode/contracts";
import { queryOptions } from "@tanstack/react-query";

import { ensureNativeApi } from "~/nativeApi";

export const environmentVariablesQueryKeys = {
  all: ["environment-variables"] as const,
  global: () => ["environment-variables", "global"] as const,
  project: (projectId: ProjectId | null) =>
    ["environment-variables", "project", projectId] as const,
};

export function globalEnvironmentVariablesQueryOptions() {
  return queryOptions<GlobalEnvironmentVariablesResult>({
    queryKey: environmentVariablesQueryKeys.global(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.server.getGlobalEnvironmentVariables();
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function projectEnvironmentVariablesQueryOptions(projectId: ProjectId | null) {
  return queryOptions<ProjectEnvironmentVariablesResult>({
    queryKey: environmentVariablesQueryKeys.project(projectId),
    queryFn: async () => {
      const api = ensureNativeApi();
      if (!projectId) {
        throw new Error("Project environment variables are unavailable.");
      }
      return api.server.getProjectEnvironmentVariables({ projectId });
    },
    enabled: projectId !== null,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
