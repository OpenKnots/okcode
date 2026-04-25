import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { ProjectId, ThreadId } from "@okcode/contracts";

import { AppSettingsSchema, type AppSettings } from "../appSettings";
import { gitQueryKeys } from "../lib/gitReactQuery";
import { useStore } from "../store";
import { useAutoDeleteMergedThreads } from "./useAutoDeleteMergedThreads";

const {
  readNativeApiMock,
  newCommandIdMock,
  toastAddMock,
  toastCloseMock,
  useQueriesMock,
  useQueryClientMock,
  invalidateQueriesMock,
} = vi.hoisted(() => ({
  readNativeApiMock: vi.fn(),
  newCommandIdMock: vi.fn(),
  toastAddMock: vi.fn(),
  toastCloseMock: vi.fn(),
  useQueriesMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  invalidateQueriesMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  return {
    ...actual,
    useQueries: useQueriesMock,
    useQueryClient: useQueryClientMock,
  };
});

vi.mock("../nativeApi", () => ({
  readNativeApi: readNativeApiMock,
}));

vi.mock("../lib/utils", () => ({
  newCommandId: newCommandIdMock,
}));

vi.mock("../components/ui/toast", () => ({
  toastManager: {
    add: toastAddMock,
    close: toastCloseMock,
  },
}));

interface StatusQueryResult {
  data?: {
    pr?: {
      state?: string | null;
    } | null;
  };
}

interface ToastCall {
  type: string;
  title: string;
  description?: string;
  actionProps?: {
    children: string;
    onClick: () => void;
  };
}

const baseStoreState = useStore.getState();
const projectId = ProjectId.makeUnsafe("project-1");
const threadId = ThreadId.makeUnsafe("thread-1");
const threadTwoId = ThreadId.makeUnsafe("thread-2");

let renderer: ReactTestRenderer | null = null;
let statusQueriesResult: StatusQueryResult[] = [];
let toastCalls: ToastCall[] = [];
let dispatchCommandMock = vi.fn();
let closeTerminalMock = vi.fn();
let removeWorktreeMock = vi.fn();
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;
const originalConsoleError = console.error;

function HookHarness({ settings }: { settings: AppSettings }) {
  useAutoDeleteMergedThreads(settings);
  return null;
}

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return AppSettingsSchema.makeUnsafe({
    autoDeleteMergedThreads: true,
    autoDeleteMergedThreadsDelayMinutes: 1,
    ...overrides,
  });
}

function seedStore(input?: { sharedWorktreePath?: string | null }) {
  const worktreePath = "/workspace/.okcode/thread-1";
  const secondWorktreePath = input?.sharedWorktreePath ?? "/workspace/.okcode/thread-2";

  useStore.setState({
    projects: [
      {
        id: projectId,
        name: "OK Code",
        cwd: "/workspace",
        model: "gpt-5.4",
        expanded: true,
        scripts: [],
      },
    ],
    threads: [
      {
        id: threadId,
        codexThreadId: null,
        kind: "thread",
        projectId,
        title: "Merged worktree",
        model: "gpt-5.4",
        runtimeMode: "full-access",
        interactionMode: "chat",
        session: null,
        messages: [],
        proposedPlans: [],
        error: null,
        createdAt: "2026-04-09T20:00:00.000Z",
        updatedAt: "2026-04-09T20:00:00.000Z",
        latestTurn: null,
        branch: "feature/merged",
        worktreePath,
        turnDiffSummaries: [],
        activities: [],
      },
      {
        id: threadTwoId,
        codexThreadId: null,
        kind: "thread",
        projectId,
        title: "Neighbor thread",
        model: "gpt-5.4",
        runtimeMode: "full-access",
        interactionMode: "chat",
        session: null,
        messages: [],
        proposedPlans: [],
        error: null,
        createdAt: "2026-04-09T20:01:00.000Z",
        updatedAt: "2026-04-09T20:01:00.000Z",
        latestTurn: null,
        branch: "feature/open",
        worktreePath: secondWorktreePath,
        turnDiffSummaries: [],
        activities: [],
      },
    ],
    threadsHydrated: true,
  });
}

function buildNativeApi() {
  dispatchCommandMock = vi.fn().mockResolvedValue(undefined);
  closeTerminalMock = vi.fn().mockResolvedValue(undefined);
  removeWorktreeMock = vi.fn().mockResolvedValue(undefined);

  return {
    orchestration: {
      dispatchCommand: dispatchCommandMock,
    },
    terminal: {
      close: closeTerminalMock,
    },
    git: {
      removeWorktree: removeWorktreeMock,
    },
  };
}

async function mountHook(settings: AppSettings) {
  await act(async () => {
    renderer = create(<HookHarness settings={settings} />);
  });
}

async function updateHook(settings: AppSettings) {
  await act(async () => {
    renderer?.update(<HookHarness settings={settings} />);
  });
}

async function unmountHook() {
  if (!renderer) {
    return;
  }

  await act(async () => {
    renderer?.unmount();
  });
  renderer = null;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
}

async function advanceTime(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await flushAsyncWork();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (typeof message === "string" && message.includes("react-test-renderer is deprecated")) {
      return;
    }
    originalConsoleError.call(console, message, ...args);
  });

  renderer = null;
  statusQueriesResult = [];
  toastCalls = [];

  useStore.setState({
    projects: baseStoreState.projects,
    threads: baseStoreState.threads,
    threadsHydrated: baseStoreState.threadsHydrated,
  });

  seedStore();
  vi.clearAllTimers();

  readNativeApiMock.mockReset().mockReturnValue(buildNativeApi());
  newCommandIdMock.mockReset();
  newCommandIdMock.mockImplementation(
    (() => {
      let commandCounter = 0;
      return () => `command-${++commandCounter}`;
    })(),
  );

  toastAddMock.mockReset().mockImplementation((input: ToastCall) => {
    toastCalls.push(input);
    return `toast-${toastCalls.length}`;
  });
  toastCloseMock.mockReset();

  invalidateQueriesMock.mockReset().mockResolvedValue(undefined);
  useQueryClientMock.mockReset().mockReturnValue({
    invalidateQueries: invalidateQueriesMock,
  });
  useQueriesMock.mockReset().mockImplementation(() => statusQueriesResult);
});

afterEach(async () => {
  await unmountHook();
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
  useStore.setState({
    projects: baseStoreState.projects,
    threads: baseStoreState.threads,
    threadsHydrated: baseStoreState.threadsHydrated,
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAutoDeleteMergedThreads", () => {
  it("starts a countdown toast and lets the user cancel before deletion", async () => {
    statusQueriesResult = [
      { data: { pr: { state: "merged" } } },
      { data: { pr: { state: "open" } } },
    ];

    await mountHook(makeSettings());

    expect(toastCalls).toHaveLength(1);
    expect(toastCalls[0]).toMatchObject({
      type: "info",
      title: 'PR merged – "Merged worktree" will be deleted',
    });

    await act(async () => {
      toastCalls[0]?.actionProps?.onClick();
      await flushAsyncWork();
    });

    expect(toastCalls.at(-1)).toMatchObject({
      type: "success",
      title: "Auto-delete cancelled",
    });

    await advanceTime(60_000);

    expect(dispatchCommandMock).not.toHaveBeenCalled();
    expect(closeTerminalMock).not.toHaveBeenCalled();
    expect(removeWorktreeMock).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });

  it("auto-deletes merged threads, removes orphaned worktrees, and invalidates git queries", async () => {
    statusQueriesResult = [
      { data: { pr: { state: "merged" } } },
      { data: { pr: { state: "open" } } },
    ];

    await mountHook(makeSettings());
    await advanceTime(60_000);

    expect(dispatchCommandMock).toHaveBeenCalledTimes(2);
    expect(dispatchCommandMock.mock.calls[0]?.[0]).toMatchObject({
      type: "thread.session.stop",
      threadId,
    });
    expect(dispatchCommandMock.mock.calls[1]?.[0]).toMatchObject({
      type: "thread.delete",
      threadId,
    });
    expect(closeTerminalMock).toHaveBeenCalledWith({
      threadId,
      deleteHistory: true,
    });
    expect(removeWorktreeMock).toHaveBeenCalledWith({
      cwd: "/workspace",
      path: "/workspace/.okcode/thread-1",
      force: true,
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: gitQueryKeys.all });
    expect(toastCalls.at(-1)).toMatchObject({
      type: "success",
      title: "Merged thread deleted",
    });
  });

  it("clears pending timers when the feature is toggled off", async () => {
    statusQueriesResult = [
      { data: { pr: { state: "merged" } } },
      { data: { pr: { state: "open" } } },
    ];

    await mountHook(makeSettings());
    await updateHook(makeSettings({ autoDeleteMergedThreads: false }));
    await advanceTime(60_000);

    expect(toastCloseMock).toHaveBeenCalledWith("toast-1");
    expect(dispatchCommandMock).not.toHaveBeenCalled();
    expect(closeTerminalMock).not.toHaveBeenCalled();
    expect(removeWorktreeMock).not.toHaveBeenCalled();
  });

  it("skips auto-delete when the merged thread still shares its worktree", async () => {
    seedStore({ sharedWorktreePath: "/workspace/.okcode/thread-1" });
    vi.clearAllTimers();
    statusQueriesResult = [
      { data: { pr: { state: "merged" } } },
      { data: { pr: { state: "open" } } },
    ];

    await mountHook(makeSettings());
    await advanceTime(60_000);

    expect(toastCalls).toHaveLength(0);
    expect(dispatchCommandMock).not.toHaveBeenCalled();
    expect(removeWorktreeMock).not.toHaveBeenCalled();
  });
});
