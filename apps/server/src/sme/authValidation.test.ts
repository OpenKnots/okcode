import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { validateCodexSetup } from "./authValidation";

const tempHomes: string[] = [];

async function makeCodexHome(configContent?: string): Promise<string> {
  const homePath = await mkdtemp(join(tmpdir(), "okcode-sme-codex-"));
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

describe("validateCodexSetup", () => {
  it("accepts custom-provider mode when a non-OpenAI backend is configured", async () => {
    const homePath = await makeCodexHome('model_provider = "portkey"\n');

    await expect(
      validateCodexSetup({
        authMethod: "customProvider",
        providerOptions: { codex: { homePath } },
      }),
    ).resolves.toEqual({
      ok: true,
      severity: "ready",
      message: "Codex is configured to use non-OpenAI backend 'portkey'.",
      resolvedAuthMethod: "customProvider",
      resolvedAccountType: "unknown",
    });
  });

  it("rejects custom-provider mode when Codex falls back to the implicit OpenAI backend", async () => {
    const homePath = await makeCodexHome();

    await expect(
      validateCodexSetup({
        authMethod: "customProvider",
        providerOptions: { codex: { homePath } },
      }),
    ).resolves.toEqual({
      ok: false,
      severity: "error",
      message:
        "Codex custom provider mode requires a non-OpenAI backend configured via `model_provider` in the Codex config.",
      resolvedAuthMethod: "customProvider",
    });
  });

  it("uses neutral non-OpenAI backend wording when auto mode resolves away from OpenAI", async () => {
    const homePath = await makeCodexHome('model_provider = "azure"\n');

    await expect(
      validateCodexSetup({
        authMethod: "auto",
        providerOptions: { codex: { homePath } },
      }),
    ).resolves.toEqual({
      ok: true,
      severity: "ready",
      message: "Codex auto mode resolved to non-OpenAI backend 'azure'.",
      resolvedAuthMethod: "customProvider",
      resolvedAccountType: "unknown",
    });
  });
});
