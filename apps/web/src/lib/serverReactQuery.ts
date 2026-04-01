import { queryOptions } from "@tanstack/react-query";
import { ensureNativeApi } from "~/nativeApi";

export const serverQueryKeys = {
  all: ["server"] as const,
  config: () => ["server", "config"] as const,
  update: () => ["server", "update"] as const,
};

export function serverConfigQueryOptions() {
  return queryOptions({
    queryKey: serverQueryKeys.config(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.server.getConfig();
    },
    staleTime: Infinity,
  });
}

export function serverUpdateQueryOptions() {
  return queryOptions({
    queryKey: serverQueryKeys.update(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.server.checkUpdate();
    },
    // Re-check every hour; stale immediately so background refetch happens on focus
    staleTime: 60 * 60 * 1_000,
    gcTime: 2 * 60 * 60 * 1_000,
    retry: false,
  });
}
