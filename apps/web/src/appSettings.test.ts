import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { AppSettingsSchema } from "./appSettings";

describe("AppSettingsSchema", () => {
  it("defaults codeViewerAutosave to false", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({});

    expect(settings.codeViewerAutosave).toBe(false);
  });

  it("preserves an explicit codeViewerAutosave setting", () => {
    const settings = Schema.decodeUnknownSync(AppSettingsSchema)({
      codeViewerAutosave: true,
    });

    expect(settings.codeViewerAutosave).toBe(true);
  });
});
