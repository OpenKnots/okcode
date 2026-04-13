import { describe, expect, it } from "vitest";

import { createServerProviderModels } from "./providerCatalog";

describe("createServerProviderModels", () => {
  it("includes Gemini built-ins in the server snapshot inventory", () => {
    expect(createServerProviderModels("gemini").map((model) => model.slug)).toEqual([
      "auto-gemini-3",
      "auto-gemini-2.5",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-3-pro-preview",
      "gemini-3-flash-preview",
    ]);
  });

  it("merges custom models without dropping built-in capabilities", () => {
    const models = createServerProviderModels("codex", [
      { slug: "gpt-5.4", name: "Duplicate built-in" },
      { slug: "custom-codex-preview", name: "Custom Codex Preview" },
    ]);

    expect(models.find((model) => model.slug === "gpt-5.4")).toMatchObject({
      isCustom: false,
      capabilities: expect.any(Object),
    });
    expect(models.find((model) => model.slug === "custom-codex-preview")).toEqual({
      slug: "custom-codex-preview",
      name: "Custom Codex Preview",
      isCustom: true,
      capabilities: null,
    });
  });
});
