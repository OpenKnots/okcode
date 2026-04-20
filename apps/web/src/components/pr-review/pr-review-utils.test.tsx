import { describe, expect, it } from "vitest";

import {
  resolveRequestChangesButtonVariant,
  withInferredFileDiffLanguage,
} from "./pr-review-utils";

describe("resolveRequestChangesButtonVariant", () => {
  it("uses the calmer warning style by default", () => {
    expect(resolveRequestChangesButtonVariant("warning")).toBe("destructive-outline");
  });

  it("supports restoring the branded emphasis", () => {
    expect(resolveRequestChangesButtonVariant("brand")).toBe("default");
  });

  it("supports a neutral outline treatment", () => {
    expect(resolveRequestChangesButtonVariant("neutral")).toBe("outline");
  });
});

describe("withInferredFileDiffLanguage", () => {
  it("attaches a language override derived from the file path", () => {
    const fileDiff = {
      name: "src/index.tsx",
      type: "change",
      hunks: [],
      splitLineCount: 0,
      unifiedLineCount: 0,
      isPartial: true,
    } as never;

    expect(withInferredFileDiffLanguage(fileDiff).lang).toBe("tsx");
  });
});
