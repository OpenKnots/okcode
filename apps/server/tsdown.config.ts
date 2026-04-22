import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  checks: {
    legacyCjs: false,
  },
  outDir: "dist",
  sourcemap: true,
  clean: true,
  noExternal: (id) => id.startsWith("@okcode/") || id === "@pierre/diffs",
  inlineOnly: false,
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
