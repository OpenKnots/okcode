import type {
  DesktopPreviewBounds,
  DesktopPreviewError,
  DesktopPreviewErrorCode,
  DesktopPreviewState,
} from "@okcode/contracts";
import {
  sanitizeLocalPreviewBounds,
  validateHttpPreviewUrl,
  validateLocalPreviewUrl,
} from "@okcode/shared/preview";

const CLOSED_PREVIEW_STATE: DesktopPreviewState = {
  status: "closed",
  url: null,
  title: null,
  visible: false,
  error: null,
  canGoBack: false,
  canGoForward: false,
};

function makePreviewError(code: DesktopPreviewErrorCode, message: string): DesktopPreviewError {
  return { code, message };
}

export function createClosedPreviewState(): DesktopPreviewState {
  return { ...CLOSED_PREVIEW_STATE };
}

export function createPreviewErrorState(
  code: DesktopPreviewErrorCode,
  message: string,
  partial?: Partial<DesktopPreviewState>,
): DesktopPreviewState {
  return {
    status: "error",
    url: partial?.url ?? null,
    title: partial?.title ?? null,
    visible: false,
    error: makePreviewError(code, message),
    canGoBack: false,
    canGoForward: false,
  };
}

export function validateDesktopPreviewUrl(
  rawUrl: unknown,
): { ok: true; url: string } | { ok: false; error: DesktopPreviewError } {
  return validateHttpPreviewUrl(rawUrl);
}

/**
 * Stricter validation that only allows localhost URLs.
 * Kept for contexts where only local dev servers should be previewed.
 */
export function validateDesktopLocalPreviewUrl(
  rawUrl: unknown,
): { ok: true; url: string } | { ok: false; error: DesktopPreviewError } {
  return validateLocalPreviewUrl(rawUrl);
}

export function sanitizeDesktopPreviewBounds(bounds: DesktopPreviewBounds): DesktopPreviewBounds {
  return sanitizeLocalPreviewBounds(bounds);
}
