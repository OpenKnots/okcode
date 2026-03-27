import type { DesktopBridge } from "@okcode/contracts";
import { validateHttpPreviewUrl, validateLocalPreviewUrl } from "@okcode/shared/preview";

export function readDesktopPreviewBridge(): DesktopBridge["preview"] | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.desktopBridge?.preview ?? null;
}

export function canUseDesktopPreview(): boolean {
  return readDesktopPreviewBridge() !== null;
}

export { validateHttpPreviewUrl, validateLocalPreviewUrl };
