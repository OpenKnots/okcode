import type { DesktopPreviewBounds, DesktopPreviewError } from "@okcode/contracts";

function makePreviewError(
  code: DesktopPreviewError["code"],
  message: string,
): DesktopPreviewError {
  return { code, message };
}

export function validateLocalPreviewUrl(
  rawUrl: unknown,
): { ok: true; url: string } | { ok: false; error: DesktopPreviewError } {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return {
      ok: false,
      error: makePreviewError("invalid-url", "Preview URL must be a non-empty string."),
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      error: makePreviewError("invalid-url", "Preview URL is not a valid URL."),
    };
  }

  if (parsedUrl.protocol !== "http:") {
    return {
      ok: false,
      error: makePreviewError("non-local-url", "Preview only supports local http URLs."),
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1") {
    return {
      ok: false,
      error: makePreviewError(
        "non-local-url",
        "Preview only supports localhost, 127.0.0.1, or ::1.",
      ),
    };
  }

  if (parsedUrl.port.length === 0) {
    return {
      ok: false,
      error: makePreviewError("invalid-url", "Preview URL must include an explicit port."),
    };
  }

  return { ok: true, url: parsedUrl.toString() };
}

export function sanitizeLocalPreviewBounds(bounds: DesktopPreviewBounds): DesktopPreviewBounds {
  const width = Number.isFinite(bounds.width) ? Math.max(0, Math.round(bounds.width)) : 0;
  const height = Number.isFinite(bounds.height) ? Math.max(0, Math.round(bounds.height)) : 0;

  return {
    x: Number.isFinite(bounds.x) ? Math.round(bounds.x) : 0,
    y: Number.isFinite(bounds.y) ? Math.round(bounds.y) : 0,
    width,
    height,
    visible: bounds.visible && width > 0 && height > 0,
  };
}
