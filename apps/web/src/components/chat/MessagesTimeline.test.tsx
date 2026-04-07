import { MessageId, TurnId } from "@okcode/contracts";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { buildChatShortcutGuides } from "~/lib/chatShortcutGuidance";
import { I18nProvider } from "~/i18n/I18nProvider";

vi.mock("~/hooks/useFileViewNavigation", () => ({
  useFileViewNavigation: () => () => {},
}));

function matchMedia() {
  return {
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

beforeAll(() => {
  const classList = {
    add: () => {},
    remove: () => {},
    toggle: () => {},
    contains: () => false,
  };

  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  });
  vi.stubGlobal("window", {
    matchMedia,
    addEventListener: () => {},
    removeEventListener: () => {},
    desktopBridge: undefined,
  });
  vi.stubGlobal("document", {
    documentElement: {
      classList,
      offsetHeight: 0,
      style: {
        setProperty: () => {},
      },
    },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

const EMPTY_SHORTCUT_GUIDES = buildChatShortcutGuides([], "Win32");

function renderWithI18n(element: ReactElement) {
  return renderToStaticMarkup(<I18nProvider>{element}</I18nProvider>);
}

describe("MessagesTimeline", () => {
  it("renders inline terminal labels with the composer chip UI", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const markup = renderWithI18n(
      <MessagesTimeline
        threadId={"thread-1" as never}
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[
          {
            id: "entry-1",
            kind: "message",
            createdAt: "2026-03-17T19:12:28.000Z",
            message: {
              id: MessageId.makeUnsafe("message-2"),
              role: "user",
              text: [
                "yoo what's @terminal-1:1-5 mean",
                "",
                "<terminal_context>",
                "- Terminal 1 lines 1-5:",
                "  1 | julius@mac effect-http-ws-cli % bun i",
                "  2 | bun install v1.3.9 (cf6cdbbb)",
                "</terminal_context>",
              ].join("\n"),
              createdAt: "2026-03-17T19:12:28.000Z",
              streaming: false,
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={new Map()}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        showReasoningContent={false}
        timestampFormat="locale"
        workspaceRoot={undefined}
        onRemoveQueuedMessage={() => {}}
        shortcutGuides={EMPTY_SHORTCUT_GUIDES}
        onOpenSettings={() => {}}
        onOpenTurnDiff={() => {}}
      />,
    );

    expect(markup).toContain("Terminal 1 lines 1-5");
    expect(markup).toContain("lucide-terminal");
    expect(markup).toContain("yoo what&#x27;s ");
  }, 15_000);

  it("renders context compaction entries in the normal work log", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const markup = renderWithI18n(
      <MessagesTimeline
        threadId={"thread-1" as never}
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[
          {
            id: "entry-1",
            kind: "work",
            createdAt: "2026-03-17T19:12:28.000Z",
            entry: {
              id: "work-1",
              createdAt: "2026-03-17T19:12:28.000Z",
              label: "Context compacted",
              tone: "info",
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={new Map()}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        showReasoningContent={false}
        timestampFormat="locale"
        workspaceRoot={undefined}
        onRemoveQueuedMessage={() => {}}
        shortcutGuides={EMPTY_SHORTCUT_GUIDES}
        onOpenSettings={() => {}}
        onOpenTurnDiff={() => {}}
      />,
    );

    expect(markup).toContain("Context compacted");
    expect(markup).toContain("Work log");
  });

  it("renders shortcut guidance when the timeline is empty", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const markup = renderWithI18n(
      <MessagesTimeline
        threadId={"thread-1" as never}
        hasMessages={false}
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={new Map()}
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        showReasoningContent={false}
        timestampFormat="locale"
        workspaceRoot={undefined}
        onRemoveQueuedMessage={() => {}}
        shortcutGuides={EMPTY_SHORTCUT_GUIDES}
        onOpenSettings={() => {}}
        onOpenTurnDiff={() => {}}
      />,
    );

    expect(markup).toContain("Hotkey tip");
    expect(markup).toContain("Manage hotkeys");
    expect(markup).toContain("No shortcut assigned");
  });

  it("renders an open diff action when a turn diff summary has files", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const assistantMessageId = MessageId.makeUnsafe("assistant-1");
    const markup = renderWithI18n(
      <MessagesTimeline
        threadId={"thread-1" as never}
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[
          {
            id: "entry-1",
            kind: "message",
            createdAt: "2026-03-17T19:12:28.000Z",
            message: {
              id: assistantMessageId,
              role: "assistant",
              text: "Updated the repo.",
              createdAt: "2026-03-17T19:12:28.000Z",
              completedAt: "2026-03-17T19:12:30.000Z",
              streaming: false,
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={
          new Map([
            [
              assistantMessageId,
              {
                turnId: TurnId.makeUnsafe("turn-1"),
                completedAt: "2026-03-17T19:12:30.000Z",
                files: [{ path: "src/index.ts", additions: 1, deletions: 0 }],
              },
            ],
          ])
        }
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        showReasoningContent={false}
        timestampFormat="locale"
        workspaceRoot={undefined}
        onRemoveQueuedMessage={() => {}}
        shortcutGuides={EMPTY_SHORTCUT_GUIDES}
        onOpenSettings={() => {}}
        onOpenTurnDiff={() => {}}
      />,
    );

    expect(markup).toContain("Open diff");
    expect(markup).toContain("Changed files (1)");
    expect(markup).toContain("Copy response");
  });

  it("renders an open diff action when a turn diff exists but the file summary is empty", async () => {
    const { MessagesTimeline } = await import("./MessagesTimeline");
    const assistantMessageId = MessageId.makeUnsafe("assistant-2");
    const markup = renderWithI18n(
      <MessagesTimeline
        threadId={"thread-1" as never}
        hasMessages
        isWorking={false}
        activeTurnInProgress={false}
        activeTurnStartedAt={null}
        scrollContainer={null}
        timelineEntries={[
          {
            id: "entry-1",
            kind: "message",
            createdAt: "2026-03-17T19:12:28.000Z",
            message: {
              id: assistantMessageId,
              role: "assistant",
              text: "Updated the repo.",
              createdAt: "2026-03-17T19:12:28.000Z",
              completedAt: "2026-03-17T19:12:30.000Z",
              streaming: false,
            },
          },
        ]}
        completionDividerBeforeEntryId={null}
        completionSummary={null}
        turnDiffSummaryByAssistantMessageId={
          new Map([
            [
              assistantMessageId,
              {
                turnId: TurnId.makeUnsafe("turn-2"),
                completedAt: "2026-03-17T19:12:30.000Z",
                files: [],
              },
            ],
          ])
        }
        nowIso="2026-03-17T19:12:30.000Z"
        expandedWorkGroups={{}}
        onToggleWorkGroup={() => {}}
        revertTurnCountByUserMessageId={new Map()}
        onRevertUserMessage={() => {}}
        isRevertingCheckpoint={false}
        onImageExpand={() => {}}
        markdownCwd={undefined}
        resolvedTheme="light"
        showReasoningContent={false}
        timestampFormat="locale"
        workspaceRoot={undefined}
        onRemoveQueuedMessage={() => {}}
        shortcutGuides={EMPTY_SHORTCUT_GUIDES}
        onOpenSettings={() => {}}
        onOpenTurnDiff={() => {}}
      />,
    );

    expect(markup).toContain("Open diff");
    expect(markup).toContain("Diff available");
  });
});
