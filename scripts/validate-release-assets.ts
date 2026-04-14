#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface RequiredAssetRule {
  readonly label: string;
  readonly matches: (assetName: string) => boolean;
}

const REQUIRED_ASSET_RULES: readonly RequiredAssetRule[] = [
  {
    label: "macOS DMG",
    matches: (assetName) => assetName.endsWith(".dmg"),
  },
  {
    label: "macOS ZIP payload",
    matches: (assetName) => assetName.endsWith(".zip"),
  },
  {
    label: "macOS ZIP blockmap",
    matches: (assetName) => assetName.endsWith(".zip.blockmap"),
  },
  {
    label: "macOS updater manifest",
    matches: (assetName) => assetName === "latest-mac.yml",
  },
  {
    label: "Linux AppImage",
    matches: (assetName) => assetName.endsWith(".AppImage"),
  },
  {
    label: "linux updater manifest",
    matches: (assetName) => assetName === "latest-linux.yml",
  },
  {
    label: "Windows installer",
    matches: (assetName) => assetName.endsWith(".exe"),
  },
  {
    label: "Windows blockmap",
    matches: (assetName) => assetName.endsWith(".exe.blockmap"),
  },
  {
    label: "Windows updater manifest",
    matches: (assetName) => assetName === "latest.yml",
  },
  {
    label: "CHANGELOG attachment",
    matches: (assetName) => assetName === "okcode-CHANGELOG.md",
  },
  {
    label: "release notes attachment",
    matches: (assetName) => assetName === "okcode-RELEASE-NOTES.md",
  },
  {
    label: "asset manifest attachment",
    matches: (assetName) => assetName === "okcode-ASSETS-MANIFEST.md",
  },
] as const;

export function validateReleaseAssets(assetNames: readonly string[]): void {
  const missing = REQUIRED_ASSET_RULES.filter(
    (rule) => !assetNames.some((assetName) => rule.matches(assetName)),
  ).map((rule) => rule.label);

  if (missing.length > 0) {
    throw new Error(`Missing required release assets: ${missing.join(", ")}`);
  }
}

function printUsage(): void {
  console.error("Usage: node scripts/validate-release-assets.ts <release-assets-directory>");
}

function main(argv: readonly string[]): void {
  const assetDirectory = argv[2];
  if (!assetDirectory) {
    printUsage();
    process.exit(1);
  }

  const absoluteAssetDirectory = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    assetDirectory,
  );
  const assetNames = readdirSync(absoluteAssetDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .toSorted();

  validateReleaseAssets(assetNames);
  console.log(`Validated ${assetNames.length} release assets in ${assetDirectory}.`);
}

if (import.meta.main) {
  main(process.argv);
}
