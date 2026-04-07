import { describe, expect, it } from "vitest";

import { resolveRequestChangesButtonVariant } from "./pr-review-utils";

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
