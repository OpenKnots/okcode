import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { AppSettingsSchema, DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE } from "./appSettings";

describe("AppSettingsSchema", () => {
  it("defaults codeViewerAutosave to false", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.codeViewerAutosave).toBe(false);
  });

  it("defaults notification detail toggles to false", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.showNotificationDetails).toBe(false);
    expect(settings.includeDiagnosticsTipsInCopy).toBe(false);
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
