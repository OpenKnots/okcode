import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import {
  AppSettingsSchema,
  clampSidebarProjectRowHeight,
  DEFAULT_BROWSER_PREVIEW_START_PAGE_URL,
  DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE,
  DEFAULT_SIDEBAR_FONT_SIZE,
  DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT,
  DEFAULT_SIDEBAR_SPACING,
  DEFAULT_SIDEBAR_THREAD_ROW_HEIGHT,
  getProviderStartOptions,
  resolveBrowserPreviewStartPageUrl,
  SIDEBAR_PROJECT_ROW_HEIGHT_MAX,
  SIDEBAR_PROJECT_ROW_HEIGHT_MIN,
} from "./appSettings";

describe("AppSettingsSchema", () => {
  it("defaults codeViewerAutosave to false", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.codeViewerAutosave).toBe(false);
  });

  it("defaults notification detail toggles to false", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.showNotificationDetails).toBe(false);
    expect(settings.includeDiagnosticsTipsInCopy).toBe(false);
    expect(settings.browserPreviewStartPageUrl).toBe("");
  });

  it("defaults sidebar appearance controls", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.sidebarProjectRowHeight).toBe(DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT);
    expect(settings.sidebarThreadRowHeight).toBe(DEFAULT_SIDEBAR_THREAD_ROW_HEIGHT);
    expect(settings.sidebarFontSize).toBe(DEFAULT_SIDEBAR_FONT_SIZE);
    expect(settings.sidebarSpacing).toBe(DEFAULT_SIDEBAR_SPACING);
  });

  it("preserves an explicit codeViewerAutosave setting", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({
      codeViewerAutosave: true,
    });

    expect(settings.codeViewerAutosave).toBe(true);
  });

  it("preserves explicit notification detail settings", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({
      showNotificationDetails: true,
      includeDiagnosticsTipsInCopy: true,
    });

    expect(settings.showNotificationDetails).toBe(true);
    expect(settings.includeDiagnosticsTipsInCopy).toBe(true);
  });

  it("defaults the PR request changes button tone to warning", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.prReviewRequestChangesTone).toBe(DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE);
  });
});

describe("clampSidebarProjectRowHeight", () => {
  it("exposes the expected accessibility-minded bounds", () => {
    expect(SIDEBAR_PROJECT_ROW_HEIGHT_MIN).toBe(32);
    expect(SIDEBAR_PROJECT_ROW_HEIGHT_MAX).toBe(72);
    expect(DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT).toBe(32);
  });

  it("clamps below-floor values up to the new floor of 32", () => {
    expect(clampSidebarProjectRowHeight(0)).toBe(32);
    expect(clampSidebarProjectRowHeight(24)).toBe(32); // legacy floor
    expect(clampSidebarProjectRowHeight(28)).toBe(32); // legacy default
    expect(clampSidebarProjectRowHeight(31)).toBe(32);
  });

  it("accepts in-range values and rounds fractional input", () => {
    expect(clampSidebarProjectRowHeight(32)).toBe(32);
    expect(clampSidebarProjectRowHeight(48)).toBe(48);
    expect(clampSidebarProjectRowHeight(71.4)).toBe(71);
    expect(clampSidebarProjectRowHeight(72)).toBe(72);
  });

  it("clamps above-ceiling values down to the new max of 72", () => {
    expect(clampSidebarProjectRowHeight(73)).toBe(72);
    expect(clampSidebarProjectRowHeight(120)).toBe(72);
    expect(clampSidebarProjectRowHeight(Number.POSITIVE_INFINITY)).toBe(72);
  });
});

describe("getProviderStartOptions", () => {
  it("includes the Claude binary path when configured", () => {
    expect(
      getProviderStartOptions({
        claudeBinaryPath: "/usr/local/bin/claude",
        codexBinaryPath: "",
        codexHomePath: "",
        copilotBinaryPath: "",
        copilotConfigDir: "",
        openclawGatewayUrl: "",
        openclawPassword: "",
      }),
    ).toEqual({
      claudeAgent: {
        binaryPath: "/usr/local/bin/claude",
      },
    });
  });

  it("does not emit Claude start options without a Claude binary path", () => {
    expect(
      getProviderStartOptions({
        claudeBinaryPath: "",
        codexBinaryPath: "",
        codexHomePath: "",
        copilotBinaryPath: "",
        copilotConfigDir: "",
        openclawGatewayUrl: "",
        openclawPassword: "",
      }),
    ).toBeUndefined();
  });
});

describe("resolveBrowserPreviewStartPageUrl", () => {
  it("falls back to the default start page for blank or invalid values", () => {
    expect(resolveBrowserPreviewStartPageUrl("")).toBe(DEFAULT_BROWSER_PREVIEW_START_PAGE_URL);
    expect(resolveBrowserPreviewStartPageUrl("not-a-url")).toBe(
      DEFAULT_BROWSER_PREVIEW_START_PAGE_URL,
    );
  });

  it("normalizes valid http and https URLs", () => {
    expect(resolveBrowserPreviewStartPageUrl(" https://example.com ")).toBe("https://example.com/");
    expect(resolveBrowserPreviewStartPageUrl("http://localhost:3000/path")).toBe(
      "http://localhost:3000/path",
    );
  });
});
