import type { OrchestrationReadModel } from "@okcode/contracts";

const SNAPSHOT_RETRY_DELAYS_MS = [250, 500, 1_000, 2_000, 5_000] as const;

export interface SnapshotSyncManagerOptions {
  readonly fetchSnapshot: () => Promise<OrchestrationReadModel>;
  readonly applySnapshot: (snapshot: OrchestrationReadModel) => void;
}

export interface SnapshotSyncManager {
  readonly scheduleSync: () => Promise<void>;
  readonly dispose: () => void;
}

export function createSnapshotSyncManager(
  options: SnapshotSyncManagerOptions,
): SnapshotSyncManager {
  let disposed = false;
  let syncing = false;
  let pending = false;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let inFlightSync: Promise<void> | null = null;

  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const scheduleRetry = () => {
    if (disposed || retryTimer !== null) {
      return;
    }
    const delay =
      SNAPSHOT_RETRY_DELAYS_MS[Math.min(retryAttempt, SNAPSHOT_RETRY_DELAYS_MS.length - 1)] ??
      SNAPSHOT_RETRY_DELAYS_MS[0];
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void runSync();
    }, delay);
  };

  const runSync = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    clearRetryTimer();
    if (syncing) {
      pending = true;
      return;
    }

    syncing = true;
    pending = false;

    try {
      const snapshot = await options.fetchSnapshot();
      if (disposed) {
        return;
      }
      retryAttempt = 0;
      options.applySnapshot(snapshot);
    } catch {
      if (!disposed) {
        scheduleRetry();
      }
      return;
    } finally {
      syncing = false;
    }

    if (pending && !disposed) {
      pending = false;
      void runSync();
    }
  };

  return {
    scheduleSync: () => {
      if (syncing) {
        pending = true;
        return inFlightSync ?? Promise.resolve();
      }
      const sync = runSync().finally(() => {
        if (inFlightSync === sync) {
          inFlightSync = null;
        }
      });
      inFlightSync = sync;
      return sync;
    },
    dispose: () => {
      disposed = true;
      pending = false;
      clearRetryTimer();
    },
  };
}
