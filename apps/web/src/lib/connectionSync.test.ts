import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createConnectionSyncManager } from "./connectionSync";
import { gitQueryKeys } from "./gitReactQuery";
import { projectQueryKeys } from "./projectReactQuery";
import { prReviewQueryKeys } from "./prReviewReactQuery";
import { providerQueryKeys } from "./providerReactQuery";
import { serverQueryKeys } from "./serverReactQuery";
import { skillQueryKeys } from "./skillReactQuery";
import type { WsTransport } from "../wsTransport";

function createTransportHarness() {
  let reconnectListener: (() => void) | null = null;

  return {
    transport: {
      onReconnected: (listener: () => void) => {
        reconnectListener = listener;
        return () => {
          if (reconnectListener === listener) {
            reconnectListener = null;
          }
        };
      },
    } as unknown as WsTransport,
    reconnect: () => {
      reconnectListener?.();
    },
  };
}

function createQueryClientHarness() {
  const invalidateQueries = vi.fn((_input: unknown) => Promise.resolve());
  return {
    invalidateQueries,
    queryClient: {
      invalidateQueries,
    } as unknown as QueryClient,
  };
}

describe("createConnectionSyncManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates each query root on reconnect and calls onResync afterward", () => {
    const transport = createTransportHarness();
    const { invalidateQueries, queryClient } = createQueryClientHarness();
    const callOrder: string[] = [];
    invalidateQueries.mockImplementation((input: unknown) => {
      const queryKey = (input as { queryKey: readonly string[] }).queryKey;
      callOrder.push(queryKey[0] ?? "");
      return Promise.resolve();
    });
    const onResync = vi.fn(() => {
      callOrder.push("resync");
    });

    createConnectionSyncManager({
      transport: transport.transport,
      queryClient,
      onResync,
    });

    transport.reconnect();

    expect(invalidateQueries.mock.calls.map(([input]) => input)).toEqual([
      { queryKey: gitQueryKeys.all },
      { queryKey: providerQueryKeys.all },
      { queryKey: projectQueryKeys.all },
      { queryKey: serverQueryKeys.all },
      { queryKey: prReviewQueryKeys.all },
      { queryKey: skillQueryKeys.all },
    ]);
    expect(onResync).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual([
      gitQueryKeys.all[0],
      providerQueryKeys.all[0],
      projectQueryKeys.all[0],
      serverQueryKeys.all[0],
      prReviewQueryKeys.all[0],
      skillQueryKeys.all[0],
      "resync",
    ]);
  });

  it("still invalidates query roots when onResync is omitted", () => {
    const transport = createTransportHarness();
    const { invalidateQueries, queryClient } = createQueryClientHarness();

    createConnectionSyncManager({
      transport: transport.transport,
      queryClient,
    });

    transport.reconnect();

    expect(invalidateQueries).toHaveBeenCalledTimes(6);
  });

  it("stops reacting to reconnects after unsubscribe", () => {
    const transport = createTransportHarness();
    const { invalidateQueries, queryClient } = createQueryClientHarness();

    const unsubscribe = createConnectionSyncManager({
      transport: transport.transport,
      queryClient,
      onResync: vi.fn(),
    });

    unsubscribe();
    transport.reconnect();

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
