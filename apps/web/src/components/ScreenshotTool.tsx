import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { CameraIcon, XIcon } from "lucide-react";

import { useScreenshotStore } from "~/screenshotStore";
import { readDesktopPreviewBridge } from "~/desktopPreview";
import { toastManager } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipPopup } from "~/components/ui/tooltip";
import { cn, isMacPlatform } from "~/lib/utils";

// ── Types ───────────────────────────────────────────────────────────

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function normalizeRect(rect: SelectionRect) {
  return {
    x: Math.min(rect.startX, rect.endX),
    y: Math.min(rect.startY, rect.endY),
    width: Math.abs(rect.endX - rect.startX),
    height: Math.abs(rect.endY - rect.startY),
  };
}

// ── Capture Logic ───────────────────────────────────────────────────

/**
 * Find the browser preview surface element's bounds (if visible).
 */
function getPreviewSurfaceBounds(): { x: number; y: number; width: number; height: number } | null {
  const el = document.querySelector("[data-preview-surface='true']");
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/**
 * Check whether two rectangles overlap.
 */
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function captureRegion(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<Blob> {
  const dpr = window.devicePixelRatio || 1;

  // Capture the full page at device resolution (DOM only — native BrowserView is excluded)
  const rootElement = document.documentElement;
  const dataUrl = await toPng(rootElement, {
    width: rootElement.scrollWidth,
    height: rootElement.scrollHeight,
    pixelRatio: dpr,
    // Exclude our own overlay from the capture
    filter: (node) => {
      if (node instanceof HTMLElement && node.dataset.screenshotOverlay === "true") {
        return false;
      }
      return true;
    },
  });

  // Load into an Image to crop
  const img = await loadImage(dataUrl);

  // Crop to the selected region
  const canvas = document.createElement("canvas");
  const cropX = rect.x * dpr;
  const cropY = rect.y * dpr;
  const cropW = rect.width * dpr;
  const cropH = rect.height * dpr;

  canvas.width = cropW;
  canvas.height = cropH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas 2D context");

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // Composite the native browser preview if the selection overlaps it
  const previewBridge = readDesktopPreviewBridge();
  const surfaceBounds = getPreviewSurfaceBounds();
  if (previewBridge && surfaceBounds && rectsOverlap(rect, surfaceBounds)) {
    try {
      const browserDataUrl = await previewBridge.captureActiveTab();
      if (browserDataUrl) {
        const browserImg = await loadImage(browserDataUrl);
        // Position the browser image relative to the crop area
        const drawX = (surfaceBounds.x - rect.x) * dpr;
        const drawY = (surfaceBounds.y - rect.y) * dpr;
        const drawW = surfaceBounds.width * dpr;
        const drawH = surfaceBounds.height * dpr;
        ctx.drawImage(browserImg, drawX, drawY, drawW, drawH);
      }
    } catch {
      // If browser capture fails, the DOM-only screenshot is still valid
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null"));
      },
      "image/png",
      1.0,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cleanup = () => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      resolve(img);
    };
    const onError = () => {
      cleanup();
      reject(new Error("Failed to load image"));
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    img.src = src;
  });
}

async function copyBlobToClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Minimum selection threshold ─────────────────────────────────────

const MIN_SELECTION_SIZE = 8;

// ── Selection Overlay ───────────────────────────────────────────────

function ScreenshotOverlay() {
  const deactivate = useScreenshotStore((s) => s.deactivate);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const isDragging = useRef(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Cancel on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        deactivate();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [deactivate]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isCapturing) return;
      e.preventDefault();
      isDragging.current = true;
      setSelection({
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      });
    },
    [isCapturing],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging.current || isCapturing) return;
      setSelection((prev) => (prev ? { ...prev, endX: e.clientX, endY: e.clientY } : null));
    },
    [isCapturing],
  );

  const handleMouseUp = useCallback(async () => {
    if (!isDragging.current || isCapturing) return;
    isDragging.current = false;

    if (!selection) {
      deactivate();
      return;
    }

    const rect = normalizeRect(selection);

    // If the selection is too small, treat as a cancelled click
    if (rect.width < MIN_SELECTION_SIZE || rect.height < MIN_SELECTION_SIZE) {
      setSelection(null);
      return;
    }

    setIsCapturing(true);

    try {
      const blob = await captureRegion(rect);

      // Copy to clipboard
      await copyBlobToClipboard(blob);

      toastManager.add({
        type: "success",
        title: "Screenshot copied",
        description: "Image copied to clipboard",
        data: { dismissAfterVisibleMs: 3000 },
        actionProps: {
          children: "Save file",
          onClick: () => {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            downloadBlob(blob, `screenshot-${timestamp}.png`);
          },
        },
      });
    } catch (error) {
      console.error("Screenshot capture failed:", error);
      toastManager.add({
        type: "error",
        title: "Screenshot failed",
        description: error instanceof Error ? error.message : "Could not capture screenshot",
        data: { dismissAfterVisibleMs: 5000 },
      });
    } finally {
      setIsCapturing(false);
      deactivate();
    }
  }, [selection, isCapturing, deactivate]);

  const normalized = selection ? normalizeRect(selection) : null;
  const hasValidSelection =
    normalized && normalized.width >= MIN_SELECTION_SIZE && normalized.height >= MIN_SELECTION_SIZE;

  return (
    <div
      ref={overlayRef}
      data-screenshot-overlay="true"
      className="fixed inset-0 z-[9999] cursor-crosshair select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Dimmed backdrop - uses CSS clip-path to create a "hole" for the selection */}
      <div
        className="pointer-events-none absolute inset-0 bg-black/40 transition-opacity duration-150"
        style={
          hasValidSelection
            ? {
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                  ${normalized.x}px ${normalized.y}px,
                  ${normalized.x}px ${normalized.y + normalized.height}px,
                  ${normalized.x + normalized.width}px ${normalized.y + normalized.height}px,
                  ${normalized.x + normalized.width}px ${normalized.y}px,
                  ${normalized.x}px ${normalized.y}px
                )`,
              }
            : undefined
        }
      />

      {/* Selection rectangle border */}
      {hasValidSelection && (
        <div
          className="pointer-events-none absolute border-2 border-primary rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_0_20px_rgba(59,130,246,0.3)]"
          style={{
            left: normalized.x,
            top: normalized.y,
            width: normalized.width,
            height: normalized.height,
          }}
        >
          {/* Dimension badge */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm">
            {Math.round(normalized.width)} x {Math.round(normalized.height)}
          </div>
        </div>
      )}

      {/* Instructions banner */}
      {!hasValidSelection && !isCapturing && (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/70 px-4 py-2.5 text-sm font-medium text-white shadow-2xl backdrop-blur-md">
            <CameraIcon className="size-4 text-primary" />
            <span>Click and drag to select an area</span>
            <span className="mx-1 text-white/30">|</span>
            <kbd className="rounded bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold">Esc</kbd>
            <span className="text-white/60">to cancel</span>
          </div>
        </div>
      )}

      {/* Capturing indicator */}
      {isCapturing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-black/70 px-5 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-md">
            <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Capturing...
          </div>
        </div>
      )}
    </div>
  );
}

// ── Screenshot Button ───────────────────────────────────────────────

function ScreenshotButton() {
  const active = useScreenshotStore((s) => s.active);
  const toggle = useScreenshotStore((s) => s.toggle);
  const isMac = isMacPlatform(navigator.platform);
  const shortcutLabel = isMac ? "⌘⇧S" : "Ctrl+Shift+S";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? "secondary" : "ghost"}
            size="icon-xs"
            onClick={toggle}
            aria-label="Take screenshot"
            className={cn(
              "text-muted-foreground transition-colors hover:text-foreground",
              active && "text-primary",
            )}
          />
        }
      >
        {active ? <XIcon className="size-4" /> : <CameraIcon className="size-4" />}
      </TooltipTrigger>
      <TooltipPopup>
        {active ? "Cancel screenshot" : "Take screenshot"} ({shortcutLabel})
      </TooltipPopup>
    </Tooltip>
  );
}

// ── Main Export ──────────────────────────────────────────────────────

function ScreenshotTool() {
  const active = useScreenshotStore((s) => s.active);
  return active ? <ScreenshotOverlay /> : null;
}

export { ScreenshotTool, ScreenshotButton };
