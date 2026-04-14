import { describe, expect, it } from "vitest";

import {
  CODEX_BUILT_IN_MODEL_PROVIDER_IDS,
  CODEX_MODEL_PROVIDER_PRESETS,
  getCodexModelProviderPreset,
  isCodexBuiltInModelProvider,
  requiresOpenAiLoginForCodexModelProvider,
} from "./codexModelProviders";

describe("CODEX_MODEL_PROVIDER_PRESETS", () => {
  it("ships the curated catalog in the expected order", () => {
    expect(CODEX_MODEL_PROVIDER_PRESETS.map((preset) => preset.id)).toEqual([
      "openai",
      "ollama",
      "lmstudio",
      "azure",
      "cerebras",
      "deepseek",
      "fireworks",
      "groq",
      "mistral",
      "openrouter",
      "perplexity",
      "portkey",
      "together",
      "xai",
    ]);
  });

  it("marks built-ins separately from curated presets", () => {
    expect(CODEX_BUILT_IN_MODEL_PROVIDER_IDS).toEqual(["openai", "ollama", "lmstudio"]);
    expect(isCodexBuiltInModelProvider("openai")).toBe(true);
    expect(isCodexBuiltInModelProvider("openrouter")).toBe(false);
  });

  it("requires OpenAI login only for openai", () => {
    expect(requiresOpenAiLoginForCodexModelProvider("openai")).toBe(true);
    expect(requiresOpenAiLoginForCodexModelProvider("ollama")).toBe(false);
    expect(requiresOpenAiLoginForCodexModelProvider("openrouter")).toBe(false);
    expect(requiresOpenAiLoginForCodexModelProvider("my-company-proxy")).toBe(false);
  });

  it("returns preset metadata when available", () => {
    expect(getCodexModelProviderPreset("azure")).toEqual({
      id: "azure",
      title: "Azure OpenAI",
      kind: "curated",
      authMode: "provider-specific",
      description: "Curated preset for Azure-hosted OpenAI-compatible deployments.",
    });
    expect(getCodexModelProviderPreset("unknown-provider")).toBeUndefined();
  });
});
