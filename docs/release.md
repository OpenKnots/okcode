# Release Runbook

Canonical release process documentation for OK Code.

**Last updated:** 2026-04-25

## Overview

The next stable train ships one semver across desktop, CLI, and iOS surfaces:

- macOS arm64 and x64 desktop DMGs plus updater metadata
- Windows x64 signed NSIS installer
- Linux x64 AppImage
- iOS TestFlight build from the same release tag, dispatched separately
- `okcodes` npm package from the same tag

`docs/release.md` is the source of truth for release policy, release gates, and the platform matrix. Treat `docs/releases/README.md` and README release references as pointers only.

## Defaults

- iOS is TestFlight-only for this release train.
- Both macOS architectures are blocking for the main desktop release, and the published `latest-mac.yml` manifest must contain arm64 and x64 payloads.
- Android is non-blocking.
- Windows stable support requires signing. Do not ship unsigned Windows artifacts as stable.

## Versioning and promotion

- Prereleases like `vX.Y.Z-rc.1` are optional. Use them when we want soak time or extra validation, not as a mandatory gate.
- Stable releases may ship directly as `vX.Y.Z` when the change set is understood and approved.
- Publish prereleases to npm with the `next` dist-tag.
- Publish stable releases to npm with the `latest` dist-tag.

## Release workflows

Official release tags and follow-up mobile promotion now use two workflows:

- [`release.yml`](../.github/workflows/release.yml) runs automatically on release tags for desktop artifacts, npm publish, GitHub Release publication, and finalize.
- [`release-ios.yml`](../.github/workflows/release-ios.yml) is dispatched manually for the matching version/ref when we want the TestFlight upload.

`release.yml` job order:

1. `preflight`
2. `desktop_build`
3. `publish_cli`
4. `release`
5. `finalize`

`release-ios.yml` job order:

1. `preflight`
2. `ios_signing_preflight`
3. `ios_testflight`

Desktop/CLI publishing must not be blocked by iOS signing availability or TestFlight upload retries.

## Required checks

Every RC and stable release must pass:

```bash
bun run fmt:check
bun run lint
bun run typecheck
bun run test
bun run --cwd apps/web test:browser
bun run test:desktop-smoke
bun run release:smoke
```

`bun run lint` is a zero-warning gate.

### Pre-release validation

Run the comprehensive pre-release validator before cutting any RC or promoting to stable:

```bash
bun run release:validate <version>
```

This checks documentation completeness, version alignment, git state, iOS project version, and optionally runs all quality gates. Use `--skip-quality` for a docs-only pass or `--ci` for CI pipelines.

### One-shot release shipping

Use the end-to-end release command for the normal desktop + CLI train:

```bash
bun run release:ship <version>
```

This command runs local preflight, invokes release preparation, pushes the release tag, waits for `release.yml`, and verifies the published GitHub Release assets plus the merged macOS OTA manifest before returning success.

## Platform matrix

Blocking stable matrix:

| Surface     | Runner         | Artifact                                | Blocking |
| ----------- | -------------- | --------------------------------------- | -------- |
| macOS arm64 | `macos-14`     | signed/notarized DMG + updater metadata | yes      |
| macOS x64   | `macos-13`     | signed/notarized DMG + updater metadata | yes      |
| Windows x64 | `windows-2022` | signed NSIS installer                   | yes      |
| Linux x64   | `ubuntu-24.04` | AppImage                                | yes      |
| iOS         | `macos-14`     | TestFlight upload                       | separate |
| CLI         | `ubuntu-24.04` | npm publish                             | yes      |

Optional manual rebuild lane:

| Surface   | Workflow                                                                    | Artifact          |
| --------- | --------------------------------------------------------------------------- | ----------------- |
| macOS x64 | [`release-intel-compat.yml`](../.github/workflows/release-intel-compat.yml) | Intel DMG rebuild |

## Desktop release requirements

- Build artifacts with `bun run dist:desktop:artifact`.
- Refuse macOS stable release builds unless signing and notarization secrets are present.
- Refuse Windows stable release builds unless Azure Trusted Signing secrets are present.
- Publish both macOS arm64 and x64 DMG/ZIP payloads from the main `release.yml` workflow.
- Merge `latest-mac.yml` and `latest-mac-x64.yml` into one published `latest-mac.yml` before creating the GitHub Release.
- Validate packaged outputs before upload:
  - macOS: both arch-specific DMGs exist and updater manifests are present
  - Windows: installer exists
  - Linux: AppImage exists
- Keep `bun run test:desktop-smoke` and `bun run release:smoke` green before tagging.

## iOS TestFlight requirements

- Reuse the same release version as desktop and CLI.
- Build the mobile web bundle and sync Capacitor before archiving.
- Run a simulator build in CI before archive/upload.
- Upload the archive to TestFlight from the dedicated `release-ios.yml` workflow.
- Dispatch `release-ios.yml` with the release version and matching tag/ref (defaults to `refs/tags/vX.Y.Z`).
- During RC soak, manually verify on:
  - one current supported iPhone/iOS
  - one older supported iPhone/iOS

Manual RC device checks:

1. Pair the mobile companion with a desktop/server.
2. Restore a saved pairing.
3. Open a thread and send a follow-up.
4. Approve an action and answer a user-input request.
5. Background and foreground the app.
6. Return to the thread from a notification tap.

## CLI publish requirements

- Build the CLI package from `apps/server`.
- Verify `npm pack`.
- Verify local `okcode --version`, `okcode --help`, and `okcode doctor --help`.
- Publish after desktop artifacts pass; do not wait on the separate iOS workflow.
- Verify the published package with `npx okcodes@<version> --version`.

## Release preparation

Before tagging:

1. Ensure the main branch is green on the full gate set.
2. Prepare:
   - `CHANGELOG.md`
   - `docs/releases/vX.Y.Z.md`
   - `docs/releases/vX.Y.Z/assets.md`
   - `docs/releases/vX.Y.Z/rollout-checklist.md` (version-specific rollout playbook)
   - `docs/releases/vX.Y.Z/soak-test-plan.md` (version-specific soak test cases)
3. Run `bun run release:validate <version>` and fix any failures.
4. Confirm Apple signing/notarization and iOS distribution secrets:
   - `APPLE_API_KEY`
   - `APPLE_API_KEY_ID`
   - `APPLE_API_ISSUER`
   - `APPLE_TEAM_ID`
   - `IOS_PROVISIONING_PROFILE`
   - `IOS_PROVISIONING_PROFILE_NAME`
5. Confirm Windows signing secrets.
6. Confirm publish and finalize secrets:
   - `NODE_AUTH_TOKEN`
   - `RELEASE_APP_ID`
   - `RELEASE_APP_PRIVATE_KEY`

## RC soak rules

The 48-hour RC soak must finish with:

- no Sev-1 or Sev-2 issues
- no crash-on-launch on blocking desktop platforms
- updater verification from the previous stable desktop build
- successful TestFlight install
- successful `npx okcodes@<rc-version> --version`

If any blocker fails, cut a new RC and repeat the soak.

## Post-release expectations

- The GitHub release includes desktop artifacts plus release notes and asset manifest.
- iOS is distributed through TestFlight by a separate `release-ios.yml` dispatch against the release tag, not attached to the GitHub release.
- `finalize` updates version strings and pushes the post-release bump to `main`.

## Troubleshooting

- If `preflight` fails, reproduce locally with the exact failing command before retriggering the workflow.
- If `desktop_build` fails, inspect the target-specific signing secrets first.
- If `ios_testflight` fails, re-check provisioning, App Store Connect API key setup, the dispatched ref, and archive/export logs in `release-ios.yml`.
- If `publish_cli` fails, do not continue the train. Fix the publish issue so the app and CLI do not drift.
