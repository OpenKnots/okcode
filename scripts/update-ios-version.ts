/**
 * update-ios-version.ts — Update MARKETING_VERSION and CURRENT_PROJECT_VERSION
 * in the Xcode project.pbxproj for iOS release builds.
 *
 * Usage:
 *   node scripts/update-ios-version.ts <version> [--build-number <N>]
 *
 * If --build-number is omitted, falls back to $GITHUB_RUN_NUMBER or "1".
 *
 * Examples:
 *   node scripts/update-ios-version.ts 0.10.0
 *   node scripts/update-ios-version.ts 0.10.0 --build-number 42
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PBXPROJ_RELATIVE_PATH = "apps/mobile/ios/App/App.xcodeproj/project.pbxproj";

export interface UpdateIosVersionOptions {
  readonly rootDir?: string;
}

export function updateIosVersion(
  version: string,
  buildNumber: string,
  options: UpdateIosVersionOptions = {},
): { changed: boolean } {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  const pbxprojPath = resolve(rootDir, PBXPROJ_RELATIVE_PATH);

  let content = readFileSync(pbxprojPath, "utf8");
  const original = content;

  // Replace all MARKETING_VERSION = <anything>; with the new version
  content = content.replace(
    /MARKETING_VERSION\s*=\s*[^;]+;/g,
    `MARKETING_VERSION = ${version};`,
  );

  // Replace all CURRENT_PROJECT_VERSION = <anything>; with the new build number
  content = content.replace(
    /CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g,
    `CURRENT_PROJECT_VERSION = ${buildNumber};`,
  );

  if (content === original) {
    return { changed: false };
  }

  writeFileSync(pbxprojPath, content);
  return { changed: true };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: ReadonlyArray<string>): {
  version: string;
  buildNumber: string;
  rootDir: string | undefined;
} {
  let version: string | undefined;
  let buildNumber: string | undefined;
  let rootDir: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) continue;

    if (arg === "--build-number") {
      buildNumber = argv[i + 1];
      if (!buildNumber) throw new Error("Missing value for --build-number.");
      i += 1;
      continue;
    }

    if (arg === "--root") {
      rootDir = argv[i + 1];
      if (!rootDir) throw new Error("Missing value for --root.");
      i += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (version !== undefined) {
      throw new Error("Only one version argument is allowed.");
    }
    version = arg;
  }

  if (!version) {
    throw new Error(
      "Usage: node scripts/update-ios-version.ts <version> [--build-number <N>] [--root <path>]",
    );
  }

  const resolvedBuildNumber = buildNumber ?? process.env.GITHUB_RUN_NUMBER ?? "1";

  return { version, buildNumber: resolvedBuildNumber, rootDir };
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { version, buildNumber, rootDir } = parseArgs(process.argv.slice(2));
  const { changed } = updateIosVersion(version, buildNumber, rootDir === undefined ? {} : { rootDir });

  if (changed) {
    console.log(`Updated iOS version to ${version} (build ${buildNumber}).`);
  } else {
    console.log("iOS project version already matches.");
  }
}
