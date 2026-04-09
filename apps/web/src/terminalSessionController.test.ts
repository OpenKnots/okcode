import type { TerminalSessionSnapshot } from "@okcode/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./nativeApi", () => ({
  readNativeApi: vi.fn(),
}));

import { readNativeApi } from "./nativeApi";
import {
  applyTerminalLaunchEvent,
  buildTerminalLaunchRequestKey,
  clearTerminalLaunchState,
  ensureTerminalOpen,
  selectTerminalLaunchState,
  useTerminalLaunchStore,
} from "./terminalSessionController";

const readNativeApiMock = vi.mocked(readNativeApi);

function makeSnapshot(overrides: Partial<TerminalSessionSnapshot> = {}): TerminalSessionSnapshot {
  return {
    threadId: "thread-1",
    terminalId: "default",
    cwd: "/repo",
    status: "running",
    pid: 4242,
    history: "",
    exitCode: null,
    exitSignal: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("terminalSessionController", () => {
  beforeEach(() => {
    useTerminalLaunchStore.setState({ stateByKey: {} });
    readNativeApiMock.mockReset();
  });

  it("dedupes in-flight open requests for the same terminal", async () => {
    let resolveOpen: ((value: TerminalSessionSnapshot) => void) | null = null;
    const open = vi.fn(
      () =>
        new Promise<TerminalSessionSnapshot>((resolve) => {
          resolveOpen = resolve;
        }),
    );
    readNativeApiMock.mockReturnValue({
      terminal: {
        open,
      },
    } as never);

    const input = {
      threadId: "thread-1",
      terminalId: "default",
      cwd: "/repo",
      cols: 100,
      rows: 24,
      env: { FOO: "bar" },
    } as const;

    const first = ensureTerminalOpen(input);
    const second = ensureTerminalOpen(input);

    expect(open).toHaveBeenCalledTimes(1);
    expect(resolveOpen).not.toBeNull();
    resolveOpen!(makeSnapshot());
    await Promise.all([first, second]);

    applyTerminalLaunchEvent({
      type: "started",
      threadId: "thread-1",
      terminalId: "default",
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshot: makeSnapshot(),
    });

    expect(
      selectTerminalLaunchState(
        useTerminalLaunchStore.getState().stateByKey,
        "thread-1",
        "default",
      ),
    ).toMatchObject({
      status: "open",
      errorMessage: null,
      lastRequestKey: buildTerminalLaunchRequestKey(input),
    });
  });

  it("skips reopening a terminal while the same launch is still settling and after it is open", async () => {
    const open = vi.fn().mockResolvedValue(makeSnapshot());
    readNativeApiMock.mockReturnValue({
      terminal: {
        open,
      },
    } as never);

    const input = {
      threadId: "thread-2",
      terminalId: "terminal-2",
      cwd: "/repo",
      cols: 120,
      rows: 30,
    } as const;

    await ensureTerminalOpen(input);
    await ensureTerminalOpen(input);
    applyTerminalLaunchEvent({
      type: "started",
      threadId: "thread-2",
      terminalId: "terminal-2",
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshot: makeSnapshot({
        threadId: "thread-2",
        terminalId: "terminal-2",
      }),
    });

    await ensureTerminalOpen(input);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it("surfaces open failures and recovers on explicit retry", async () => {
    const open = vi
      .fn()
      .mockRejectedValueOnce(new Error("spawn failed"))
      .mockResolvedValueOnce(
        makeSnapshot({
          threadId: "thread-3",
          terminalId: "terminal-3",
        }),
      );
    readNativeApiMock.mockReturnValue({
      terminal: {
        open,
      },
    } as never);

    const input = {
      threadId: "thread-3",
      terminalId: "terminal-3",
      cwd: "/repo",
    } as const;

    await expect(ensureTerminalOpen(input)).rejects.toThrow("spawn failed");
    expect(
      selectTerminalLaunchState(
        useTerminalLaunchStore.getState().stateByKey,
        "thread-3",
        "terminal-3",
      ),
    ).toMatchObject({
      status: "error",
      errorMessage: "spawn failed",
    });

    await ensureTerminalOpen(input);
    applyTerminalLaunchEvent({
      type: "started",
      threadId: "thread-3",
      terminalId: "terminal-3",
      createdAt: "2026-01-01T00:00:00.000Z",
      snapshot: makeSnapshot({
        threadId: "thread-3",
        terminalId: "terminal-3",
      }),
    });

    expect(open).toHaveBeenCalledTimes(2);
    expect(
      selectTerminalLaunchState(
        useTerminalLaunchStore.getState().stateByKey,
        "thread-3",
        "terminal-3",
      ),
    ).toMatchObject({
      status: "open",
      errorMessage: null,
    });

    clearTerminalLaunchState("thread-3", "terminal-3");
    expect(
      selectTerminalLaunchState(
        useTerminalLaunchStore.getState().stateByKey,
        "thread-3",
        "terminal-3",
      ),
    ).toMatchObject({
      status: "idle",
    });
  });
});
