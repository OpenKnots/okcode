import type { DesktopBridge, NativeApi, ProjectId, ThreadId } from "@okcode/contracts";

import { readDesktopPreviewBridge } from "~/desktopPreview";
import { readNativeApi } from "~/nativeApi";
import { usePreviewStateStore } from "~/previewStateStore";

export interface OpenGitHubUrlInput {
  url: string;
  projectId: ProjectId | null;
  threadId: ThreadId | null;
  nativeApi?: NativeApi | undefined;
  previewBridge?: DesktopBridge["preview"] | null | undefined;
  setPreviewOpen?: ((projectId: ProjectId, open: boolean) => void) | undefined;
}

function isGitHubHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (hostname === "github.com" || hostname === "www.github.com")
    );
  } catch {
    return false;
  }
}

export function canOpenGitHubUrlInPreview(input: OpenGitHubUrlInput): boolean {
  return (
    isGitHubHttpUrl(input.url) &&
    input.projectId !== null &&
    input.threadId !== null &&
    (input.previewBridge ?? readDesktopPreviewBridge()) !== null
  );
}

export async function openGitHubUrl(input: OpenGitHubUrlInput): Promise<"preview" | "external"> {
  const previewBridge = input.previewBridge ?? readDesktopPreviewBridge();
  const setPreviewOpen = input.setPreviewOpen ?? usePreviewStateStore.getState().setProjectOpen;

  if (
    isGitHubHttpUrl(input.url) &&
    previewBridge !== null &&
    input.projectId !== null &&
    input.threadId !== null
  ) {
    setPreviewOpen(input.projectId, true);
    await previewBridge.createTab({ url: input.url, threadId: input.threadId });
    return "preview";
  }

  const nativeApi = input.nativeApi ?? readNativeApi();
  if (!nativeApi) {
    throw new Error("Link opening is unavailable.");
  }

  await nativeApi.shell.openExternal(input.url);
  return "external";
}
