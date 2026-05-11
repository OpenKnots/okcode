import type { DesktopBridge, NativeApi, ProjectId, ThreadId } from "@okcode/contracts";

import { readDesktopPreviewBridge } from "~/desktopPreview";
import { readNativeApi } from "~/nativeApi";
import { usePreviewStateStore } from "~/previewStateStore";

export interface OpenUrlInAppBrowserInput {
  url: string;
  projectId: ProjectId | null;
  threadId: ThreadId | null;
  nativeApi?: NativeApi | undefined;
  previewBridge?: DesktopBridge["preview"] | null | undefined;
  setPreviewOpen?: ((threadId: ThreadId, open: boolean) => void) | undefined;
  setPreviewLayoutMode?: ((projectId: ProjectId, mode: "side") => void) | undefined;
  popOut?: boolean | undefined;
}

export async function openUrlInAppBrowser(
  input: OpenUrlInAppBrowserInput,
): Promise<"preview" | "popout" | "external"> {
  const previewBridge = input.previewBridge ?? readDesktopPreviewBridge();
  const previewStateStore = usePreviewStateStore.getState();
  const setPreviewOpen = input.setPreviewOpen ?? previewStateStore.setThreadOpen;
  const setPreviewLayoutMode = input.setPreviewLayoutMode ?? previewStateStore.setProjectLayoutMode;

  if (previewBridge !== null && input.projectId !== null && input.threadId !== null) {
    setPreviewOpen(input.threadId, true);
    if (!input.popOut) {
      setPreviewLayoutMode(input.projectId, "side");
      await previewBridge.popIn?.();
    }
    await previewBridge.createTab({ url: input.url, threadId: input.threadId });
    if (input.popOut) {
      await previewBridge.popOut();
      return "popout";
    }
    return "preview";
  }

  const nativeApi = input.nativeApi ?? readNativeApi();
  if (!nativeApi) {
    throw new Error("Link opening is unavailable.");
  }

  await nativeApi.shell.openExternal(input.url);
  return "external";
}
