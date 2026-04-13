import { type ModelSlug, type ProviderKind, type ServerProviderStatus } from "@okcode/contracts";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ProviderModelPicker } from "./ProviderModelPicker";

const PROVIDERS = [
  {
    provider: "codex",
    status: "ready",
    available: true,
    enabled: true,
    installed: true,
    version: "1.0.0",
    authStatus: "authenticated",
    auth: { status: "authenticated" },
    checkedAt: "2026-04-13T00:00:00.000Z",
    models: [
      { slug: "gpt-5-codex", name: "GPT-5 Codex", isCustom: false, capabilities: null },
      { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex", isCustom: false, capabilities: null },
    ],
  },
  {
    provider: "claudeAgent",
    status: "ready",
    available: true,
    enabled: true,
    installed: true,
    version: "1.0.0",
    authStatus: "authenticated",
    auth: { status: "authenticated" },
    checkedAt: "2026-04-13T00:00:00.000Z",
    models: [
      { slug: "claude-opus-4-6", name: "Claude Opus 4.6", isCustom: false, capabilities: null },
      {
        slug: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        isCustom: false,
        capabilities: null,
      },
    ],
  },
  {
    provider: "gemini",
    status: "ready",
    available: true,
    enabled: true,
    installed: true,
    version: "1.0.0",
    authStatus: "authenticated",
    auth: { status: "authenticated" },
    checkedAt: "2026-04-13T00:00:00.000Z",
    models: [
      { slug: "auto-gemini-3", name: "Auto Gemini 3", isCustom: false, capabilities: null },
      {
        slug: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        isCustom: false,
        capabilities: null,
      },
    ],
  },
] as const satisfies ReadonlyArray<ServerProviderStatus>;

async function mountPicker(props: {
  provider: ProviderKind;
  model: ModelSlug;
  lockedProvider: ProviderKind | null;
  providers?: ReadonlyArray<ServerProviderStatus>;
}) {
  const host = document.createElement("div");
  document.body.append(host);
  const onProviderModelChange = vi.fn();
  const screen = await render(
    <ProviderModelPicker
      provider={props.provider}
      model={props.model}
      lockedProvider={props.lockedProvider}
      providers={props.providers ?? PROVIDERS}
      onProviderModelChange={onProviderModelChange}
    />,
    { container: host },
  );

  return {
    onProviderModelChange,
    cleanup: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

describe("ProviderModelPicker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders live provider snapshots including Gemini", async () => {
    const mounted = await mountPicker({
      provider: "claudeAgent",
      model: "claude-opus-4-6",
      lockedProvider: null,
    });

    try {
      await page.getByRole("button").click();

      await vi.waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(text).toContain("Codex");
        expect(text).toContain("Claude Code");
        expect(text).toContain("Gemini");
        expect(text).toContain("Auto Gemini 3");
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("shows only the locked provider group mid-thread", async () => {
    const mounted = await mountPicker({
      provider: "gemini",
      model: "auto-gemini-3",
      lockedProvider: "gemini",
    });

    try {
      await page.getByRole("button").click();

      await vi.waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(text).toContain("Gemini 2.5 Pro");
        expect(text).not.toContain("GPT-5 Codex");
      });
    } finally {
      await mounted.cleanup();
    }
  });

  it("dispatches the selected provider/model pair", async () => {
    const mounted = await mountPicker({
      provider: "gemini",
      model: "auto-gemini-3",
      lockedProvider: "gemini",
    });

    try {
      await page.getByRole("button").click();
      await page.getByRole("menuitemradio", { name: "Gemini 2.5 Pro" }).click();

      expect(mounted.onProviderModelChange).toHaveBeenCalledWith("gemini", "gemini-2.5-pro");
    } finally {
      await mounted.cleanup();
    }
  });
});
