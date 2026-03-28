import type { Rectangle } from "electron";
import type { DesktopPreviewBounds } from "@okcode/contracts";

function normalizeAxisScale(contentSize: number, viewportSize: number): number {
  if (contentSize <= 0) {
    return 1;
  }
  if (viewportSize <= 0) {
    return 1;
  }
  return contentSize / viewportSize;
}

export function projectPreviewBoundsToContent(
  bounds: DesktopPreviewBounds,
  contentBounds: Pick<Rectangle, "width" | "height">,
): Rectangle {
  const contentWidth = Math.max(0, Math.round(contentBounds.width));
  const contentHeight = Math.max(0, Math.round(contentBounds.height));

  if (
    !bounds.visible ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const scaleX = normalizeAxisScale(contentWidth, bounds.viewportWidth);
  const scaleY = normalizeAxisScale(contentHeight, bounds.viewportHeight);
  const width = Math.min(Math.max(0, Math.round(bounds.width * scaleX)), contentWidth);
  const height = Math.min(Math.max(0, Math.round(bounds.height * scaleY)), contentHeight);

  if (width <= 0 || height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const maxX = Math.max(0, contentWidth - width);
  const maxY = Math.max(0, contentHeight - height);
  const x = Math.max(0, Math.min(Math.round(bounds.x * scaleX), maxX));
  const y = Math.max(0, Math.min(Math.round(bounds.y * scaleY), maxY));
  return { x, y, width, height };
}
