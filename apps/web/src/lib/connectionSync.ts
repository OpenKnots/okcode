/**
 * ConnectionSyncManager - Coordinates data re-synchronisation after
 * a WebSocket reconnection.
 *
 * When the transport re-opens after a network interruption the client's
 * cached state is stale. This module invalidates relevant React Query
 * caches and re-fetches the orchestration snapshot so the UI converges
 * back to the server's truth as fast as possible.
 */
import type { QueryClient } from "@tanstack/react-query";

import { gitQueryKeys } from "./gitReactQuery";
import { providerQueryKeys } from "./providerReactQuery";
import { projectQueryKeys } from "./projectReactQuery";
import { serverQueryKeys } from "./serverReactQuery";
import { prReviewQueryKeys } from "./prReviewReactQuery";
import { skillQueryKeys } from "./skillReactQuery";
export interface ReconnectableTransport {
  readonly onReconnected: (listener: () => void) => () => void;
}

export interface ConnectionSyncManagerOptions {
  transport: ReconnectableTransport;
  queryClient: QueryClient;
  /**
   * Called after the query caches have been invalidated so the
   * orchestration snapshot can be re-fetched at the app level.
   */
  onResync?: () => void;
}

/**
 * Sets up a listener on the transport's `onReconnected` event.
 * Returns an unsubscribe function for cleanup.
 */
export function createConnectionSyncManager(options: ConnectionSyncManagerOptions): () => void {
  const { transport, queryClient, onResync } = options;

  const unsubscribe = transport.onReconnected(() => {
    // Invalidate all domain query caches so stale data is refetched.
    void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: providerQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: prReviewQueryKeys.all });
    void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });

    onResync?.();
  });

  return unsubscribe;
}
