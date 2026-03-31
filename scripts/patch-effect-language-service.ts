import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const isCi = process.env.CI === "true" || process.env.CI === "1";

if (isCi) {
  process.exit(0);
}

const require = createRequire(import.meta.url);

function resolvePackageJson(specifier: string): string | null {
  try {
    return require.resolve(specifier, { paths: [process.cwd()] });
  } catch {
    return null;
  }
}

const typescriptPackageJson = resolvePackageJson("typescript/package.json");
if (!typescriptPackageJson) {
  process.exit(0);
}

const projectRoot = dirname(dirname(dirname(typescriptPackageJson)));
const languageServicePackageJson = resolvePackageJson("@effect/language-service/package.json");

if (!languageServicePackageJson) {
  console.error("[effect-language-service] could not resolve @effect/language-service");
  process.exit(1);
}

const languageServiceCli = join(dirname(languageServicePackageJson), "cli.js");
const result = spawnSync(process.execPath, [languageServiceCli, "patch"], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
