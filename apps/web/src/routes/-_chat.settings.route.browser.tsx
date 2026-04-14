import "../index.css";

import type { NativeApi, ServerConfig } from "@okcode/contracts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import { getRouter } from "../router";

const BASE_SERVER_CONFIG: ServerConfig = {
  cwd: "/repo/project",
  keybindingsConfigPath: "/repo/project/.okcode-keybindings.json",
  keybindings: [],
  issues: [],
  providers: [
    {
      provider: "codex",
      status: "ready",
      available: true,
      authStatus: "authenticated",
      checkedAt: "2026-04-14T12:00:00.000Z",
    },
  ],
  codexConfig: {
    selectedModelProviderId: null,
    entries: [],
    parseError: null,
  },
  availableEditors: [],
};

function makeNativeApi(serverConfig: ServerConfig): NativeApi {
  return {
    server: {
      getConfig: async () => serverConfig,
      getGlobalEnvironmentVariables: async () => ({ entries: [] }),
    },
  } as unknown as NativeApi;
}

async function renderSettings(pathname: "/settings" | "/settings/") {
  (window as Window & { nativeApi?: NativeApi }).nativeApi = makeNativeApi(BASE_SERVER_CONFIG);
  const history = createMemoryHistory({ initialEntries: [pathname] });
  const router = getRouter(history);
  const screen = await render(<RouterProvider router={router} />);

  await expect.element(page.getByText("Time format")).toBeInTheDocument();

  return screen;
}

afterEach(() => {
  delete (window as Window & { nativeApi?: NativeApi }).nativeApi;
  window.localStorage.clear();
});

describe("settings route canonical rendering", () => {
  it("renders the canonical settings page for /settings and /settings/", async () => {
    const withoutTrailingSlash = await renderSettings("/settings");
    try {
      await expect.element(page.getByText("Time format")).toBeInTheDocument();
    } finally {
      await withoutTrailingSlash.unmount();
    }

    const withTrailingSlash = await renderSettings("/settings/");
    try {
      await expect.element(page.getByText("Time format")).toBeInTheDocument();
    } finally {
      await withTrailingSlash.unmount();
    }
  });
});
