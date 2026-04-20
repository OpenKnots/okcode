import type { DesktopBridge, NativeApi, ProjectId, ThreadId } from "@okcode/contracts";

import { readDesktopPreviewBridge } from "~/desktopPreview";
import { readNativeApi } from "~/nativeApi";
import { openUrlInAppBrowser } from "~/lib/openUrlInAppBrowser";

export interface OpenGitHubUrlInput {
  url: string;
  projectId: ProjectId | null;
  threadId: ThreadId | null;
  nativeApi?: NativeApi | undefined;
  previewBridge?: DesktopBridge["preview"] | null | undefined;
  setPreviewOpen?: ((threadId: ThreadId, open: boolean) => void) | undefined;
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
  if (isGitHubHttpUrl(input.url) && input.projectId !== null && input.threadId !== null) {
    await openUrlInAppBrowser({
      url: input.url,
      projectId: input.projectId,
      threadId: input.threadId,
      previewBridge: input.previewBridge ?? readDesktopPreviewBridge(),
      setPreviewOpen: input.setPreviewOpen,
      nativeApi: input.nativeApi,
    });
    return "preview";
  }

  const nativeApi = input.nativeApi ?? readNativeApi();
  if (!nativeApi) {
    throw new Error("Link opening is unavailable.");
  }

  await nativeApi.shell.openExternal(input.url);
  return "external";
}
