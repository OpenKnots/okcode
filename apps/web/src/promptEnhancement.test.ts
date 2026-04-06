import { describe, expect, it } from "vitest";

import { enhancePrompt } from "./promptEnhancement";

describe("enhancePrompt", () => {
  it("adds visible structure for specificity enhancements", () => {
    expect(enhancePrompt("fix the selected button state", "specificity")).toContain(
      "Acceptance criteria:",
    );
  });

  it("leaves the prompt untouched when no enhancement is selected", () => {
    expect(enhancePrompt("fix the selected button state", null)).toBe(
      "fix the selected button state.",
    );
  });
});
