import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readCodexConfigSummaryFromFile } from "./codexConfig";

const tempHomes: string[] = [];

async function makeCodexHome(configContent?: string): Promise<string> {
  const homePath = await mkdtemp(join(tmpdir(), "okcode-codex-config-"));
  tempHomes.push(homePath);
  if (configContent !== undefined) {
    await writeFile(join(homePath, "config.toml"), configContent, "utf-8");
  }
  return homePath;
}

afterEach(async () => {
  await Promise.all(
    tempHomes.splice(0).map((homePath) => rm(homePath, { recursive: true, force: true })),
  );
});

describe("readCodexConfigSummaryFromFile", () => {
  it("returns an empty summary when the config file does not exist", async () => {
    const homePath = await makeCodexHome();

    await expect(readCodexConfigSummaryFromFile({ homePath })).resolves.toEqual({
      selectedModelProviderId: null,
      entries: [],
      parseError: null,
    });
  });

  it("reads a top-level openai model_provider", async () => {
    const homePath = await makeCodexHome('model_provider = "openai"\n');

    await expect(readCodexConfigSummaryFromFile({ homePath })).resolves.toEqual({
      selectedModelProviderId: "openai",
      entries: [
        {
          id: "openai",
          selected: true,
          definedInConfig: true,
          isBuiltIn: true,
          isKnownPreset: true,
          requiresOpenAiLogin: true,
        },
      ],
      parseError: null,
    });
  });

  it("reads a top-level ollama model_provider", async () => {
    const homePath = await makeCodexHome('model_provider = "ollama"\n');

    await expect(readCodexConfigSummaryFromFile({ homePath })).resolves.toEqual({
      selectedModelProviderId: "ollama",
      entries: [
        {
          id: "ollama",
          selected: true,
          definedInConfig: true,
          isBuiltIn: true,
          isKnownPreset: true,
          requiresOpenAiLogin: false,
        },
      ],
      parseError: null,
    });
  });

  it("reads a curated backend selected at top level with a matching model_providers entry", async () => {
    const homePath = await makeCodexHome(
      [
        'model_provider = "openrouter"',
        "",
        "[model_providers.openrouter]",
        'name = "OpenRouter"',
      ].join("\n"),
    );

    await expect(readCodexConfigSummaryFromFile({ homePath })).resolves.toEqual({
      selectedModelProviderId: "openrouter",
      entries: [
        {
          id: "openrouter",
          selected: true,
          definedInConfig: true,
          isBuiltIn: false,
          isKnownPreset: true,
          requiresOpenAiLogin: false,
        },
      ],
      parseError: null,
    });
  });

  it("preserves unknown custom provider ids exactly as configured", async () => {
    const homePath = await makeCodexHome(
      [
        'model_provider = "my-company-proxy"',
        "",
        '[model_providers."my-company-proxy"]',
        'name = "Internal proxy"',
      ].join("\n"),
    );

    await expect(readCodexConfigSummaryFromFile({ homePath })).resolves.toEqual({
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
      ],
      parseError: null,
    });
  });

  it("does not mistake section-local model_provider keys for the active top-level backend", async () => {
    const homePath = await makeCodexHome(
      ["[profiles.deep-review]", 'model_provider = "openrouter"'].join("\n"),
    );

    await expect(readCodexConfigSummaryFromFile({ homePath })).resolves.toEqual({
      selectedModelProviderId: null,
      entries: [],
      parseError: null,
    });
  });

  it("falls back to the scanned top-level provider when TOML is malformed", async () => {
    const homePath = await makeCodexHome(
      ['model_provider = "azure"', "", "[model_providers.azure", 'name = "Azure OpenAI"'].join(
        "\n",
      ),
    );

    const summary = await readCodexConfigSummaryFromFile({ homePath });

    expect(summary.selectedModelProviderId).toBe("azure");
    expect(summary.entries).toEqual([
      {
        id: "azure",
        selected: true,
        definedInConfig: true,
        isBuiltIn: false,
        isKnownPreset: true,
        requiresOpenAiLogin: false,
      },
    ]);
    expect(summary.parseError).toEqual(expect.any(String));
  });
});
