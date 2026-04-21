import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        "~": srcPath,
      },
    },
    test: {
      include: ["src/components/**/*.browser.tsx"],
      browser: {
        enabled: true,
        api: {
          port: 0,
        },
        provider: playwright(),
        instances: [{ browser: "chromium" }],
        headless: true,
      },
      teardownTimeout: 30_000,
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  }),
);
