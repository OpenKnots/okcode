import type { OrchestrationReadModel } from "@okcode/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSnapshotSyncManager } from "./snapshotSyncManager";

function makeSnapshot(sequence: number): OrchestrationReadModel {
  return {
    snapshotSequence: sequence,
    updatedAt: "2026-01-01T00:00:00.000Z",
    projects: [],
    threads: [],
  };
}

describe("createSnapshotSyncManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries after a failed fetch until a later sync succeeds", async () => {
    const fetchSnapshot = vi
      .fn<() => Promise<OrchestrationReadModel>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(makeSnapshot(2));
    const applySnapshot = vi.fn();
    const manager = createSnapshotSyncManager({
      fetchSnapshot,
      applySnapshot,
    });

    void manager.scheduleSync();
    await Promise.resolve();

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(applySnapshot).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    expect(applySnapshot).toHaveBeenCalledWith(makeSnapshot(2));
  });

  it("coalesces overlapping sync requests and reruns once after success", async () => {
    let releaseFirstFetch!: (snapshot: OrchestrationReadModel) => void;
    const firstFetchPromise = new Promise<OrchestrationReadModel>((resolve) => {
      releaseFirstFetch = resolve;
    });
    const fetchSnapshot = vi
      .fn<() => Promise<OrchestrationReadModel>>()
      .mockImplementationOnce(() => firstFetchPromise)
      .mockResolvedValueOnce(makeSnapshot(2));
    const applySnapshot = vi.fn();
    const manager = createSnapshotSyncManager({
      fetchSnapshot,
      applySnapshot,
    });

    const firstSync = manager.scheduleSync();
    const secondSync = manager.scheduleSync();

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(firstSync).toBe(secondSync);

    releaseFirstFetch(makeSnapshot(1));
    await firstSync;
    await Promise.resolve();

    expect(fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(applySnapshot.mock.calls).toEqual([[makeSnapshot(1)], [makeSnapshot(2)]]);
  });

  it("stops retrying after dispose", async () => {
    const fetchSnapshot = vi
      .fn<() => Promise<OrchestrationReadModel>>()
      .mockRejectedValue(new Error("offline"));
    const applySnapshot = vi.fn();
    const manager = createSnapshotSyncManager({
      fetchSnapshot,
      applySnapshot,
    });

    void manager.scheduleSync();
    await Promise.resolve();
    manager.dispose();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(applySnapshot).not.toHaveBeenCalled();
  });
});
