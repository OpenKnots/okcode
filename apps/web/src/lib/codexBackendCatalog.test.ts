import { describe, expect, it } from "vitest";

import { buildCodexBackendCatalog } from "./codexBackendCatalog";

describe("buildCodexBackendCatalog", () => {
  it("merges shipped presets with detected custom providers", () => {
    const catalog = buildCodexBackendCatalog({
      selectedModelProviderId: "my-company-proxy",
      entries: [
        {
          id: "my-company-proxy",
          selected: true,
          definedInConfig: true,
          isBuiltIn: false,
          isKnownPreset: false,
          requiresOpenAiLogin: false,
        },
        {
          id: "openrouter",
          selected: false,
          definedInConfig: true,
          isBuiltIn: false,
          isKnownPreset: true,
          requiresOpenAiLogin: false,
        },
      ],
      parseError: null,
    });

    expect(catalog.effectiveSelectedModelProviderId).toBe("my-company-proxy");
    expect(catalog.curated.find((row) => row.id === "openrouter")?.statusBadge).toBe(
      "Defined in config",
    );
    expect(catalog.detectedCustom).toEqual([
      {
        id: "my-company-proxy",
        title: "My Company Proxy",
        group: "custom",
        authNote: "Provider-specific credentials",
        statusBadge: "Configured",
        detectionBadge: null,
        selected: true,
        definedInConfig: true,
        isKnownPreset: false,
      },
    ]);
  });

  it("surfaces reachable local-backend detection badges for ollama and lmstudio", () => {
    const catalog = buildCodexBackendCatalog({
      selectedModelProviderId: "ollama",
      entries: [
        {
          id: "ollama",
          selected: true,
          definedInConfig: true,
          isBuiltIn: false,
          isKnownPreset: true,
          requiresOpenAiLogin: false,
        },
      ],
      parseError: null,
      detectedLocalBackends: {
        ollama: { reachable: true, modelCount: 3 },
        lmstudio: { reachable: false },
      },
    });

    const ollamaRow = catalog.builtIn.find((row) => row.id === "ollama");
    const lmstudioRow = catalog.builtIn.find((row) => row.id === "lmstudio");
    expect(ollamaRow?.detectionBadge).toEqual({ reachable: true, modelCount: 3 });
    expect(lmstudioRow?.detectionBadge).toEqual({ reachable: false, modelCount: undefined });
  });

  it("leaves detection badges null when the probe result is absent", () => {
    const catalog = buildCodexBackendCatalog({
      selectedModelProviderId: null,
      entries: [],
      parseError: null,
    });

    const ollamaRow = catalog.builtIn.find((row) => row.id === "ollama");
    expect(ollamaRow?.detectionBadge).toBeNull();
  });

  it("renders openai as the implicit default when no model_provider is configured", () => {
    const catalog = buildCodexBackendCatalog({
      selectedModelProviderId: null,
      entries: [],
      parseError: null,
    });

    expect(catalog.effectiveSelectedModelProviderId).toBe("openai");
    expect(catalog.builtIn.find((row) => row.id === "openai")?.statusBadge).toBe(
      "Implicit default",
    );
  });

  it("shows configured on a detected curated preset", () => {
    const catalog = buildCodexBackendCatalog({
      selectedModelProviderId: "portkey",
      entries: [
        {
          id: "portkey",
          selected: true,
          definedInConfig: true,
          isBuiltIn: false,
          isKnownPreset: true,
          requiresOpenAiLogin: false,
        },
      ],
      parseError: null,
    });

    expect(catalog.curated.find((row) => row.id === "portkey")?.statusBadge).toBe("Configured");
  });
});
