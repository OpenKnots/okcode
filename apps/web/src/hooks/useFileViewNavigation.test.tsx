import { ProjectId, ThreadId } from "@okcode/contracts";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCodeViewerStore } from "~/codeViewerStore";
import { useStore } from "~/store";
import { useFileViewNavigation } from "./useFileViewNavigation";

const navigateMock = vi.fn();

let currentThreadId: string | null = null;

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useParams: ({
    select,
  }: {
    select?: (params: Record<string, string | undefined>) => unknown;
  } = {}) => {
    const params = currentThreadId ? { threadId: currentThreadId } : {};
    return typeof select === "function" ? select(params) : params;
  },
}));

const baseStoreState = useStore.getState();

const projectId = ProjectId.makeUnsafe("project-1");
const firstThreadId = ThreadId.makeUnsafe("thread-1");
const secondThreadId = ThreadId.makeUnsafe("thread-2");

let renderer: ReactTestRenderer | null = null;
let latestOpenInViewer: ((cwd: string, relativePath: string) => void) | null = null;

function HookHarness() {
  latestOpenInViewer = useFileViewNavigation();
  return null;
}

function seedThreads() {
  useStore.setState({
    projects: [
      {
        id: projectId,
        name: "OK Code",
        cwd: "/repo/project",
        model: "gpt-5.4",
        expanded: true,
        scripts: [],
      },
    ],
    threads: [
      {
        id: firstThreadId,
        codexThreadId: null,
        kind: "thread",
        projectId,
        title: "First",
        model: "gpt-5.4",
        runtimeMode: "full-access",
        interactionMode: "chat",
        session: null,
        messages: [],
        proposedPlans: [],
        error: null,
        createdAt: "2026-05-04T10:00:00.000Z",
        updatedAt: "2026-05-04T10:00:00.000Z",
        latestTurn: null,
        branch: "main",
        worktreePath: null,
        turnDiffSummaries: [],
        activities: [],
      },
      {
        id: secondThreadId,
        codexThreadId: null,
        kind: "thread",
        projectId,
        title: "Second",
        model: "gpt-5.4",
        runtimeMode: "full-access",
        interactionMode: "chat",
        session: null,
        messages: [],
        proposedPlans: [],
        error: null,
        createdAt: "2026-05-04T10:00:01.000Z",
        updatedAt: "2026-05-04T10:00:01.000Z",
        latestTurn: null,
        branch: "main",
        worktreePath: null,
        turnDiffSummaries: [],
        activities: [],
      },
    ],
    threadsHydrated: true,
  });
}

async function mountHarness() {
  await act(async () => {
    renderer = create(<HookHarness />);
  });
}

async function unmountHarness() {
  if (!renderer) {
    return;
  }
  await act(async () => {
    renderer?.unmount();
  });
  renderer = null;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  currentThreadId = null;
  navigateMock.mockReset();
  latestOpenInViewer = null;
  seedThreads();
  useCodeViewerStore.setState({
    isOpen: false,
    tabs: [],
    activeTabId: null,
    pendingContext: null,
  });
});

afterEach(async () => {
  await unmountHarness();
  useStore.setState(baseStoreState);
  currentThreadId = null;
});

describe("useFileViewNavigation", () => {
  it("keeps the callback stable across thread snapshot churn", async () => {
    await mountHarness();

    const firstCallback = latestOpenInViewer;
    expect(firstCallback).not.toBeNull();

    await act(async () => {
      useStore.setState((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === secondThreadId
            ? { ...thread, updatedAt: "2026-05-04T10:05:00.000Z" }
            : { ...thread },
        ),
      }));
    });

    expect(latestOpenInViewer).toBe(firstCallback);
  });

  it("reads the latest thread list lazily when navigating from outside a thread page", async () => {
    await mountHarness();

    const initialCallback = latestOpenInViewer;
    expect(initialCallback).not.toBeNull();

    await act(async () => {
      useStore.setState((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === firstThreadId
            ? { ...thread, updatedAt: "2026-05-04T09:59:00.000Z" }
            : thread.id === secondThreadId
              ? { ...thread, updatedAt: "2026-05-04T10:06:00.000Z" }
              : { ...thread },
        ),
      }));
    });

    await act(async () => {
      initialCallback?.("/repo/project", "README.md");
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/$threadId",
      params: { threadId: secondThreadId },
    });
  });
});
