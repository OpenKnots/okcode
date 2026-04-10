import type { DesktopBridge, NativeApi } from "@okcode/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canOpenGitHubUrlInPreview, openGitHubUrl } from "./openGitHubUrl";

describe("openGitHubUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("opens GitHub URLs in preview when desktop preview context is available", async () => {
    const createTab = vi.fn<DesktopBridge["preview"]["createTab"]>().mockResolvedValue({
      tabId: "tab-1",
      state: { tabs: [], activeTabId: null, visible: true },
    });
    const previewBridge = { createTab } as unknown as DesktopBridge["preview"];
    const setPreviewOpen = vi.fn();
    const openExternal = vi.fn<NativeApi["shell"]["openExternal"]>().mockResolvedValue(undefined);
    const nativeApi = { shell: { openExternal } } as unknown as NativeApi;

    const result = await openGitHubUrl({
      url: "https://github.com/OpenKnots/okcode/pull/42",
      projectId: "project-1" as never,
      threadId: "thread-1" as never,
      previewBridge,
      nativeApi,
      setPreviewOpen,
    });

    expect(result).toBe("preview");
    expect(setPreviewOpen).toHaveBeenCalledWith("project-1", true);
    expect(createTab).toHaveBeenCalledWith({
      url: "https://github.com/OpenKnots/okcode/pull/42",
      threadId: "thread-1",
    });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("falls back to external open when preview is unavailable", async () => {
    const openExternal = vi.fn<NativeApi["shell"]["openExternal"]>().mockResolvedValue(undefined);
    const nativeApi = { shell: { openExternal } } as unknown as NativeApi;
    const setPreviewOpen = vi.fn();

    const result = await openGitHubUrl({
      url: "https://github.com/OpenKnots/okcode/issues/42",
      projectId: "project-1" as never,
      threadId: null,
      nativeApi,
      setPreviewOpen,
    });

    expect(result).toBe("external");
    expect(setPreviewOpen).not.toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalledWith("https://github.com/OpenKnots/okcode/issues/42");
  });

  it("only treats GitHub http urls as preview eligible", () => {
    expect(
      canOpenGitHubUrlInPreview({
        url: "https://github.com/OpenKnots/okcode/pull/42",
        projectId: "project-1" as never,
        threadId: "thread-1" as never,
        previewBridge: {} as never,
      }),
    ).toBe(true);

    expect(
      canOpenGitHubUrlInPreview({
        url: "https://example.com/OpenKnots/okcode/pull/42",
        projectId: "project-1" as never,
        threadId: "thread-1" as never,
        previewBridge: {} as never,
      }),
    ).toBe(false);
  });
});
