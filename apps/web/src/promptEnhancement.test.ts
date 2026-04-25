import { describe, expect, it } from "vitest";

import {
  enhancePrompt,
  getPromptEnhancementById,
  PROMPT_ENHANCEMENT_IDS,
} from "./promptEnhancement";

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

  it("rewrites the prompt around goal, approach, and definition of done", () => {
    const result = enhancePrompt("fix the selected button state", "rewrite");
    expect(result).toContain("Goal:");
    expect(result).toContain("- fix the selected button state.");
    expect(result).toContain("Approach:");
    expect(result).toContain("Definition of done:");
  });

  it("returns an empty string when rewriting empty input", () => {
    expect(enhancePrompt("   ", "rewrite")).toBe("");
  });
});

describe("PROMPT_ENHANCEMENTS metadata", () => {
  it("exposes a Full rewrite enhancement at the top of the list", () => {
    expect(PROMPT_ENHANCEMENT_IDS[0]).toBe("rewrite");
    expect(getPromptEnhancementById("rewrite")?.label).toBe("Full rewrite");
  });
});
