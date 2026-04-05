# Release Runbook

Canonical release process documentation for OK Code.

**Last updated:** 2026-04-05

## Overview

The next stable train ships one semver across all blocking surfaces:

- macOS arm64 desktop DMG plus updater metadata
- Windows x64 signed NSIS installer
- Linux x64 AppImage
- iOS TestFlight build from the same tag
- `okcodes` npm package from the same tag

`docs/release.md` is the source of truth for release policy, release gates, and the platform matrix. Treat `docs/releases/README.md` and README release references as pointers only.

## Defaults

- iOS is TestFlight-only for this release train.
- Intel mac is non-blocking and runs in the separate `Desktop Intel Compatibility` workflow.
- Android is non-blocking.
- Windows stable support requires signing. Do not ship unsigned Windows artifacts as stable.

## Versioning and promotion

- Always cut `vX.Y.Z-rc.1` first.
- Soak the exact RC commit for 48 hours before promotion.
- Promote the same commit to `vX.Y.Z`. Do not retag a new commit as stable without another RC.
- Publish prereleases to npm with the `next` dist-tag.
- Publish stable releases to npm with the `latest` dist-tag.

## Coordinated release workflow

Official releases are cut through [`release.yml`](../.github/workflows/release.yml).

Job order:

1. `preflight`
2. `desktop_build`
3. `ios_testflight`
4. `publish_cli`
5. `release`
6. `finalize`

The GitHub release must not publish until every blocking surface succeeds.

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

## Platform matrix

Blocking stable matrix:

| Surface     | Runner         | Artifact                                | Blocking |
| ----------- | -------------- | --------------------------------------- | -------- |
| macOS arm64 | `macos-14`     | signed/notarized DMG + updater metadata | yes      |
| Windows x64 | `windows-2022` | signed NSIS installer                   | yes      |
| Linux x64   | `ubuntu-24.04` | AppImage                                | yes      |
| iOS         | `macos-14`     | TestFlight upload                       | yes      |
| CLI         | `ubuntu-24.04` | npm publish                             | yes      |

Non-blocking compatibility lane:

| Surface   | Workflow                                                                    | Artifact  |
| --------- | --------------------------------------------------------------------------- | --------- |
| macOS x64 | [`release-intel-compat.yml`](../.github/workflows/release-intel-compat.yml) | Intel DMG |

## Desktop release requirements

- Build artifacts with `bun run dist:desktop:artifact`.
- Refuse macOS stable release builds unless signing and notarization secrets are present.
- Refuse Windows stable release builds unless Azure Trusted Signing secrets are present.
- Validate packaged outputs before upload:
  - macOS: DMG exists and updater manifest exists
  - Windows: installer exists
  - Linux: AppImage exists
- Keep `bun run test:desktop-smoke` and `bun run release:smoke` green before tagging.

## iOS TestFlight requirements

- Reuse the same release version as desktop and CLI.
- Build the mobile web bundle and sync Capacitor before archiving.
- Run a simulator build in CI before archive/upload.
- Upload the archive to TestFlight from the coordinated release workflow.
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
- Publish only after desktop and iOS blockers pass.
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
4. Confirm Apple signing/notarization secrets.
5. Confirm Windows signing secrets.
6. Confirm `NODE_AUTH_TOKEN`, `RELEASE_APP_ID`, and `RELEASE_APP_PRIVATE_KEY`.

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
- iOS is distributed through TestFlight, not attached to the GitHub release.
- `finalize` updates version strings and pushes the post-release bump to `main`.

## Troubleshooting

- If `preflight` fails, reproduce locally with the exact failing command before retriggering the workflow.
- If `desktop_build` fails, inspect the target-specific signing secrets first.
- If `ios_testflight` fails, re-check provisioning, App Store Connect API key setup, and archive export logs.
- If `publish_cli` fails, do not continue the train. Fix the publish issue so the app and CLI do not drift.
