import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { findWorkflowRunForTag, runReleaseShip, validatePublishedRelease } from "./release-ship.ts";

const dualArchReleaseAssets = [
  { name: "OK-Code-1.2.3-arm64.dmg" },
  { name: "OK-Code-1.2.3-arm64.zip" },
  { name: "OK-Code-1.2.3-arm64.zip.blockmap" },
  { name: "OK-Code-1.2.3-x64.dmg" },
  { name: "OK-Code-1.2.3-x64.zip" },
  { name: "OK-Code-1.2.3-x64.zip.blockmap" },
  { name: "OK-Code-1.2.3-x86_64.AppImage" },
  { name: "latest-linux.yml" },
  { name: "OK-Code-1.2.3.exe" },
  { name: "OK-Code-1.2.3.exe.blockmap" },
  { name: "latest.yml" },
  { name: "latest-mac.yml" },
  { name: "okcode-CHANGELOG.md" },
  { name: "okcode-RELEASE-NOTES.md" },
  { name: "okcode-ASSETS-MANIFEST.md" },
] as const;

const mergedMacManifest = `version: 1.2.3
files:
  - url: OK-Code-1.2.3-arm64.zip
    sha512: arm64zip
    size: 101
  - url: OK-Code-1.2.3-arm64.dmg
    sha512: arm64dmg
    size: 102
  - url: OK-Code-1.2.3-x64.zip
    sha512: x64zip
    size: 103
  - url: OK-Code-1.2.3-x64.dmg
    sha512: x64dmg
    size: 104
releaseDate: '2026-04-25T12:00:00Z'
`;

describe("findWorkflowRunForTag", () => {
  it("selects the workflow run matching the pushed release tag", () => {
    const run = findWorkflowRunForTag(
      [
        {
          id: 10,
          headBranch: "main",
          status: "completed",
          conclusion: "success",
          createdAt: "2026-04-25T10:00:00Z",
        },
        {
          id: 11,
          headBranch: "v1.2.3",
          status: "in_progress",
          conclusion: null,
          createdAt: "2026-04-25T10:01:00Z",
        },
      ],
      "v1.2.3",
    );

    assert.deepStrictEqual(run, {
      id: 11,
      headBranch: "v1.2.3",
      status: "in_progress",
      conclusion: null,
      createdAt: "2026-04-25T10:01:00Z",
    });
  });
});

describe("validatePublishedRelease", () => {
  it("accepts a published release with dual-arch mac OTA assets and a merged manifest", () => {
    assert.doesNotThrow(() => validatePublishedRelease(dualArchReleaseAssets, mergedMacManifest));
  });

  it("rejects published releases whose merged mac manifest does not include x64 payloads", () => {
    assert.throws(
      () =>
        validatePublishedRelease(
          dualArchReleaseAssets,
          mergedMacManifest.replace("OK-Code-1.2.3-x64.zip", "OK-Code-1.2.3-missing.zip"),
        ),
      /merged macOS updater manifest/i,
    );
  });
});

describe("runReleaseShip", () => {
  it.effect(
    "runs validation, preparation, workflow waiting, and published release verification",
    () =>
      Effect.promise(async () => {
        const calls: string[] = [];

        await runReleaseShip(
          { version: "1.2.3", timeoutMs: 50, pollIntervalMs: 1 },
          {
            log: () => undefined,
            sleep: async () => undefined,
            releaseSteps: {
              ensureGitHubAuth: async () => {
                calls.push("gh-auth");
              },
              runPreReleaseValidate: async (version) => {
                calls.push(`validate:${version}`);
              },
              runPrepareRelease: async (version) => {
                calls.push(`prepare:${version}`);
              },
            },
            github: {
              listReleaseWorkflowRuns: async () => {
                calls.push("list-runs");
                return [
                  {
                    id: 42,
                    headBranch: "v1.2.3",
                    status: "completed",
                    conclusion: "success",
                    createdAt: "2026-04-25T12:00:00Z",
                  },
                ];
              },
              watchWorkflowRun: async (runId) => {
                calls.push(`watch:${runId}`);
              },
              getReleaseAssets: async (tag) => {
                calls.push(`assets:${tag}`);
                return dualArchReleaseAssets.map((asset) => ({ ...asset }));
              },
              downloadReleaseAssetText: async (tag, assetName) => {
                calls.push(`download:${tag}:${assetName}`);
                return mergedMacManifest;
              },
            },
          },
        );

        assert.deepStrictEqual(calls, [
          "gh-auth",
          "validate:1.2.3",
          "prepare:1.2.3",
          "list-runs",
          "watch:42",
          "assets:v1.2.3",
          "download:v1.2.3:latest-mac.yml",
        ]);
      }),
  );
});
