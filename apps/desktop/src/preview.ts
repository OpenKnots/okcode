import type {
  DesktopPreviewBounds,
  DesktopPreviewError,
  PreviewTabsState,
} from "@okcode/contracts";
import { sanitizeLocalPreviewBounds, validateHttpPreviewUrl } from "@okcode/shared/preview";

const EMPTY_TABS_STATE: PreviewTabsState = {
  tabs: [],
  activeTabId: null,
  visible: false,
};

export function createEmptyTabsState(): PreviewTabsState {
  return { ...EMPTY_TABS_STATE };
}

export function validateDesktopPreviewUrl(
  rawUrl: unknown,
): { ok: true; url: string } | { ok: false; error: DesktopPreviewError } {
  return validateHttpPreviewUrl(rawUrl);
}

export function sanitizeDesktopPreviewBounds(bounds: DesktopPreviewBounds): DesktopPreviewBounds {
  return sanitizeLocalPreviewBounds(bounds);
}
