import { describe, expect, it } from "vitest";
import type { DesktopPreviewBounds } from "@okcode/contracts";

import { sanitizeLocalPreviewBounds, validateLocalPreviewUrl } from "./preview";

describe("validateLocalPreviewUrl", () => {
  it("accepts loopback http URLs with explicit ports", () => {
    expect(validateLocalPreviewUrl("http://localhost:3000")).toEqual({
      ok: true,
      url: "http://localhost:3000/",
    });
    expect(validateLocalPreviewUrl("http://127.0.0.1:4173/app")).toEqual({
      ok: true,
      url: "http://127.0.0.1:4173/app",
    });
  });

  it("rejects empty, malformed, secure, and remote URLs", () => {
    expect(validateLocalPreviewUrl("")).toEqual({
      ok: false,
      error: {
        code: "invalid-url",
        message: "Preview URL must be a non-empty string.",
      },
    });
    expect(validateLocalPreviewUrl("notaurl")).toEqual({
      ok: false,
      error: {
        code: "invalid-url",
        message: "Preview URL is not a valid URL.",
      },
    });
    expect(validateLocalPreviewUrl("https://localhost:3000")).toEqual({
      ok: false,
      error: {
        code: "non-local-url",
        message: "Preview only supports local http URLs.",
      },
    });
    expect(validateLocalPreviewUrl("http://example.com:3000")).toEqual({
      ok: false,
      error: {
        code: "non-local-url",
        message: "Preview only supports localhost, 127.0.0.1, or ::1.",
      },
    });
  });
});

describe("sanitizeLocalPreviewBounds", () => {
  it("rounds values and hides invalid regions", () => {
    const floatingBounds: DesktopPreviewBounds = {
      x: 10.2,
      y: 20.7,
      width: 480.4,
      height: 320.6,
      visible: true,
      viewportWidth: 1440.4,
      viewportHeight: 900.6,
    };
    expect(sanitizeLocalPreviewBounds(floatingBounds)).toEqual({
      x: 10,
      y: 21,
      width: 480,
      height: 321,
      visible: true,
      viewportWidth: 1440,
      viewportHeight: 901,
    });

    expect(
      sanitizeLocalPreviewBounds({
        x: Number.NaN,
        y: Number.NaN,
        width: -10,
        height: 0,
        visible: true,
        viewportWidth: Number.NaN,
        viewportHeight: Number.NaN,
      }),
    ).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
      viewportWidth: 0,
      viewportHeight: 0,
    });
  });
});
