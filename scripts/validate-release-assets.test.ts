import { assert, describe, it } from "@effect/vitest";

import { validateReleaseAssets } from "./validate-release-assets.ts";

describe("validateReleaseAssets", () => {
  const completeAssetSet = [
    "OK-Code-0.24.0-arm64.dmg",
    "OK-Code-0.24.0-arm64.zip",
    "OK-Code-0.24.0-arm64.zip.blockmap",
    "OK-Code-0.24.0-x64.dmg",
    "OK-Code-0.24.0-x64.zip",
    "OK-Code-0.24.0-x64.zip.blockmap",
    "OK-Code-0.24.0.AppImage",
    "OK-Code-0.24.0.exe",
    "OK-Code-0.24.0.exe.blockmap",
    "latest-mac.yml",
    "latest-linux.yml",
    "latest.yml",
    "okcode-CHANGELOG.md",
    "okcode-RELEASE-NOTES.md",
    "okcode-ASSETS-MANIFEST.md",
  ];

  it("accepts a complete coordinated release asset set", () => {
    assert.doesNotThrow(() => validateReleaseAssets(completeAssetSet));
  });

  it("rejects releases that are missing a required desktop asset class", () => {
    assert.throws(
      () => validateReleaseAssets(completeAssetSet.filter((asset) => asset !== "latest-linux.yml")),
      /Missing required release assets: linux updater manifest/,
    );
  });

  it("rejects releases that are missing macOS x64 OTA assets", () => {
    assert.throws(
      () =>
        validateReleaseAssets(
          completeAssetSet.filter((asset) => asset !== "OK-Code-0.24.0-x64.zip"),
        ),
      /Missing required release assets: macOS x64 ZIP payload/,
    );
  });

  it("rejects releases that are missing required documentation attachments", () => {
    assert.throws(
      () =>
        validateReleaseAssets(
          completeAssetSet.filter((asset) => asset !== "okcode-ASSETS-MANIFEST.md"),
        ),
      /Missing required release assets: asset manifest attachment/,
    );
  });
});
