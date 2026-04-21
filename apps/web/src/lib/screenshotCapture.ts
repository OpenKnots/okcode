const TRANSPARENT_IMAGE_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

export interface ScreenshotCaptureRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DomCaptureOptions {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
  readonly skipFonts: boolean;
  readonly imagePlaceholder: string;
  readonly onImageErrorHandler: () => undefined;
  readonly filter: (node: HTMLElement) => boolean;
}

export function buildDomCaptureOptions(input: {
  readonly rootElement: HTMLElement;
  readonly pixelRatio: number;
}): DomCaptureOptions {
  return {
    width: input.rootElement.scrollWidth,
    height: input.rootElement.scrollHeight,
    pixelRatio: input.pixelRatio,
    skipFonts: true,
    imagePlaceholder: TRANSPARENT_IMAGE_PLACEHOLDER,
    onImageErrorHandler: () => undefined,
    filter: (node: HTMLElement) => {
      if ("dataset" in node && node.dataset?.screenshotOverlay === "true") {
        return false;
      }
      return true;
    },
  };
}

export async function captureBaseScreenshotDataUrl(input: {
  readonly captureWindow?: (() => Promise<string | null>) | null;
  readonly captureDom: () => Promise<string>;
}): Promise<string> {
  const nativeCapture = await input.captureWindow?.();
  if (typeof nativeCapture === "string" && nativeCapture.length > 0) {
    return nativeCapture;
  }
  return input.captureDom();
}
