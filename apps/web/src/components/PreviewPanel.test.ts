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
      }),
    ).toContain("Enter a URL");

    expect(
      resolvePreviewStatusCopy({
        status: "loading",
        url: "http://localhost:3000/",
        title: null,
        visible: true,
        error: null,
      }),
    ).toContain("Loading");

    expect(
      resolvePreviewStatusCopy({
        status: "ready",
        url: "http://localhost:3000/",
        title: "App",
        visible: true,
        error: null,
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
      }),
    ).toBe("Dev server did not respond.");
  });
});
