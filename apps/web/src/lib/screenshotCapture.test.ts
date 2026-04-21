import { describe, expect, it, vi } from "vitest";

import { buildDomCaptureOptions, captureBaseScreenshotDataUrl } from "./screenshotCapture";

describe("screenshotCapture", () => {
  it("prefers native desktop window capture when available", async () => {
    const captureWindow = vi.fn(async () => "data:image/png;base64,desktop");
    const captureDom = vi.fn(async () => "data:image/png;base64,dom");

    const result = await captureBaseScreenshotDataUrl({ captureWindow, captureDom });

    expect(result).toBe("data:image/png;base64,desktop");
    expect(captureWindow).toHaveBeenCalledOnce();
    expect(captureDom).not.toHaveBeenCalled();
  });

  it("falls back to DOM capture when native window capture is unavailable", async () => {
    const captureWindow = vi.fn(async () => null);
    const captureDom = vi.fn(async () => "data:image/png;base64,dom");

    const result = await captureBaseScreenshotDataUrl({ captureWindow, captureDom });

    expect(result).toBe("data:image/png;base64,dom");
    expect(captureWindow).toHaveBeenCalledOnce();
    expect(captureDom).toHaveBeenCalledOnce();
  });

  it("skips font embedding and excludes the screenshot overlay from DOM capture", () => {
    const rootElement = {
      scrollWidth: 1440,
      scrollHeight: 900,
    } as HTMLElement;

    const options = buildDomCaptureOptions({
      rootElement,
      pixelRatio: 2,
    });

    const overlay = { dataset: { screenshotOverlay: "true" } } as unknown as HTMLElement;
    const content = { dataset: {} } as unknown as HTMLElement;

    expect(options.width).toBe(1440);
    expect(options.height).toBe(900);
    expect(options.pixelRatio).toBe(2);
    expect(options.skipFonts).toBe(true);
    expect(options.filter?.(overlay as HTMLElement)).toBe(false);
    expect(options.filter?.(content as HTMLElement)).toBe(true);
  });
});
