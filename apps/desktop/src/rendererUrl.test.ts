import { describe, expect, it } from "vitest";

import { resolveDesktopRendererUrl } from "./rendererUrl";

describe("resolveDesktopRendererUrl", () => {
  it("builds the packaged renderer URL from the desktop protocol", () => {
    expect(
      resolveDesktopRendererUrl({
        isDevelopment: false,
        scheme: "okcode",
      }),
    ).toBe("okcode://app/index.html");
  });

  it("adds query parameters for packaged pop-out windows", () => {
    expect(
      resolveDesktopRendererUrl({
        isDevelopment: false,
        scheme: "okcode",
        query: {
          popout: true,
        },
      }),
    ).toBe("okcode://app/index.html?popout=true");
  });

  it("preserves the current packaged renderer hash route when a base URL is provided", () => {
    expect(
      resolveDesktopRendererUrl({
        baseUrl: "okcode://app/index.html#/thread-123",
        isDevelopment: false,
        scheme: "okcode",
        query: {
          popout: true,
        },
      }),
    ).toBe("okcode://app/index.html?popout=true#/thread-123");
  });

  it("adds query parameters to the dev server URL", () => {
    expect(
      resolveDesktopRendererUrl({
        isDevelopment: true,
        devServerUrl: "http://127.0.0.1:5173/",
        scheme: "okcode",
        query: {
          popout: true,
        },
      }),
    ).toBe("http://127.0.0.1:5173/?popout=true");
  });

  it("preserves existing dev server search params", () => {
    expect(
      resolveDesktopRendererUrl({
        isDevelopment: true,
        devServerUrl: "http://127.0.0.1:5173/?client=desktop",
        scheme: "okcode",
        query: {
          popout: true,
        },
      }),
    ).toBe("http://127.0.0.1:5173/?client=desktop&popout=true");
  });

  it("preserves the current dev renderer hash route when a base URL is provided", () => {
    expect(
      resolveDesktopRendererUrl({
        baseUrl: "http://127.0.0.1:5173/?client=desktop#/thread-123",
        isDevelopment: true,
        devServerUrl: "http://127.0.0.1:5173/",
        scheme: "okcode",
        query: {
          popout: true,
        },
      }),
    ).toBe("http://127.0.0.1:5173/?client=desktop&popout=true#/thread-123");
  });

  it("requires a dev server URL in development mode", () => {
    expect(() =>
      resolveDesktopRendererUrl({
        isDevelopment: true,
        scheme: "okcode",
      }),
    ).toThrow("VITE_DEV_SERVER_URL is required when resolving a development renderer URL.");
  });
});
