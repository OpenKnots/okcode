import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.config";

const diffsEntry = fileURLToPath(
  new URL("../../node_modules/@pierre/diffs/dist/index.js", import.meta.url),
);

export default mergeConfig(
  baseConfig,
  defineConfig({
    resolve: {
      alias: {
        "@pierre/diffs": diffsEntry,
      },
    },
    test: {
      testTimeout: 15_000,
      hookTimeout: 15_000,
    },
  }),
);
