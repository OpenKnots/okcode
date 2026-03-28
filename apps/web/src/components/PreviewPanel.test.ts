import { describe, expect, it } from "vitest";

import { resolvePreviewStatusCopy } from "./PreviewPanel";

describe("resolvePreviewStatusCopy", () => {
  it("returns actionable copy for closed, loading, and ready states", () => {
    expect(
      resolvePreviewStatusCopy({
        status: "closed",
        url: null,
        title: null,
        visible: false,
        error: null,
        canGoBack: false,
        canGoForward: false,
      }),
    ).toContain("Enter a URL");

    expect(
      resolvePreviewStatusCopy({
        status: "loading",
        url: "http://localhost:3000/",
        title: null,
        visible: true,
        error: null,
        canGoBack: false,
        canGoForward: false,
      }),
    ).toContain("Loading");

    expect(
      resolvePreviewStatusCopy({
        status: "ready",
        url: "http://localhost:3000/",
        title: "App",
        visible: true,
        error: null,
        canGoBack: true,
        canGoForward: false,
      }),
    ).toContain("http://localhost:3000/");
  });

  it("prefers explicit preview errors", () => {
    expect(
      resolvePreviewStatusCopy({
        status: "error",
        url: "http://localhost:3000/",
        title: null,
        visible: false,
        error: {
          code: "load-failed",
          message: "Dev server did not respond.",
        },
        canGoBack: false,
        canGoForward: false,
      }),
    ).toBe("Dev server did not respond.");
  });
});
