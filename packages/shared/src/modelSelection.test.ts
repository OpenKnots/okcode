import { describe, expect, it } from "vitest";

import {
  toCanonicalModelSelection,
  normalizeModelSelectionWithCapabilities,
} from "./modelSelection";

describe("toCanonicalModelSelection", () => {
  it("normalizes provider aliases into a canonical selection", () => {
    expect(toCanonicalModelSelection("gemini", "Gemini 2.5 Pro", undefined)).toEqual({
      provider: "gemini",
      model: "gemini-2.5-pro",
    });
  });

  it("falls back to the provider default when the model is missing", () => {
    expect(toCanonicalModelSelection("gemini", null, undefined)).toEqual({
      provider: "gemini",
      model: "auto-gemini-3",
    });
  });
});

describe("normalizeModelSelectionWithCapabilities", () => {
  it("prunes unsupported codex options from the canonical selection", () => {
    expect(
      normalizeModelSelectionWithCapabilities(
        {
          provider: "codex",
          model: "gpt-5.4",
          options: { reasoningEffort: "xhigh", fastMode: true },
        },
        [
          {
            slug: "gpt-5.4",
            capabilities: {
              reasoningEffortLevels: [
                { value: "medium", label: "Medium" },
                { value: "high", label: "High", isDefault: true },
              ],
              supportsFastMode: false,
              supportsThinkingToggle: false,
              contextWindowOptions: [],
              promptInjectedEffortLevels: [],
            },
          },
        ],
      ),
    ).toEqual({
      provider: "codex",
      model: "gpt-5.4",
      options: {},
    });
  });
});
