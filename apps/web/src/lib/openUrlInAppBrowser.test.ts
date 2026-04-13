import { describe, expect, it, vi } from "vitest";

import type { DesktopBridge, NativeApi, ProjectId, ThreadId } from "@okcode/contracts";

import { openUrlInAppBrowser } from "./openUrlInAppBrowser";

function projectId(value: string): ProjectId {
  return value as ProjectId;
}

function threadId(value: string): ThreadId {
  return value as ThreadId;
}

describe("openUrlInAppBrowser", () => {
  it("opens in the desktop preview when project and thread ids are available", async () => {
    const createTab = vi.fn<DesktopBridge["preview"]["createTab"]>().mockResolvedValue({
      tabId: "tab-1",
      state: { tabs: [], activeTabId: null, visible: false },
    });
    const setPreviewOpen = vi.fn();

    const result = await openUrlInAppBrowser({
      url: "https://tweakcn.com",
      projectId: projectId("project-1"),
      threadId: threadId("thread-1"),
      previewBridge: { createTab } as unknown as DesktopBridge["preview"],
      setPreviewOpen,
    });

    expect(result).toBe("preview");
    expect(setPreviewOpen).toHaveBeenCalledWith(projectId("project-1"), true);
    expect(createTab).toHaveBeenCalledWith({
      url: "https://tweakcn.com",
      threadId: threadId("thread-1"),
    });
  });

  it("pops the preview out when requested", async () => {
    const createTab = vi.fn<DesktopBridge["preview"]["createTab"]>().mockResolvedValue({
      tabId: "tab-1",
      state: { tabs: [], activeTabId: null, visible: false },
    });
    const popOut = vi.fn<DesktopBridge["preview"]["popOut"]>().mockResolvedValue(undefined);

    const result = await openUrlInAppBrowser({
      url: "https://tweakcn.com",
      projectId: projectId("project-1"),
      threadId: threadId("thread-1"),
      previewBridge: { createTab, popOut } as unknown as DesktopBridge["preview"],
      setPreviewOpen: vi.fn(),
      popOut: true,
    });

    expect(result).toBe("popout");
    expect(createTab).toHaveBeenCalledOnce();
    expect(popOut).toHaveBeenCalledOnce();
  });

  it("falls back to an external open when preview context is unavailable", async () => {
    const openExternal = vi.fn<NativeApi["shell"]["openExternal"]>().mockResolvedValue(undefined);

    const result = await openUrlInAppBrowser({
      url: "https://tweakcn.com",
      projectId: null,
      threadId: null,
      nativeApi: { shell: { openExternal } } as unknown as NativeApi,
    });

    expect(result).toBe("external");
    expect(openExternal).toHaveBeenCalledWith("https://tweakcn.com");
  });
});
