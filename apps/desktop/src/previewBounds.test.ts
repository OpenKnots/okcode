import { describe, expect, it } from "vitest";

import { projectPreviewBoundsToContent } from "./previewBounds";

describe("projectPreviewBoundsToContent", () => {
  it("maps renderer bounds into native content coordinates using viewport scaling", () => {
    expect(
      projectPreviewBoundsToContent(
        {
          x: 100,
          y: 52,
          width: 400,
          height: 300,
          visible: true,
          viewportWidth: 1000,
          viewportHeight: 800,
        },
        { width: 1200, height: 960 },
      ),
    ).toEqual({
      x: 120,
      y: 62,
      width: 480,
      height: 360,
    });
  });

  it("clamps projected bounds to the native content area", () => {
    expect(
      projectPreviewBoundsToContent(
        {
          x: 700,
          y: 580,
          width: 300,
          height: 220,
          visible: true,
          viewportWidth: 1000,
          viewportHeight: 800,
        },
        { width: 900, height: 700 },
      ),
    ).toEqual({
      x: 630,
      y: 507,
      width: 270,
      height: 193,
    });
  });

  it("falls back to content-space coordinates when viewport metadata is unavailable", () => {
    expect(
      projectPreviewBoundsToContent(
        {
          x: 64,
          y: 96,
          width: 320,
          height: 240,
          visible: true,
          viewportWidth: 0,
          viewportHeight: 0,
        },
        { width: 1200, height: 900 },
      ),
    ).toEqual({
      x: 64,
      y: 96,
      width: 320,
      height: 240,
    });
  });

  it("hides the native view for invisible or empty regions", () => {
    expect(
      projectPreviewBoundsToContent(
        {
          x: 10,
          y: 10,
          width: 320,
          height: 240,
          visible: false,
          viewportWidth: 800,
          viewportHeight: 600,
        },
        { width: 1200, height: 900 },
      ),
    ).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});
