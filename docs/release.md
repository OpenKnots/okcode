# Release Runbook

This is the canonical guide for releasing OK Code. It covers the full lifecycle — from pre-release quality gates through cutting a tag to post-release verification — as well as signing setup and troubleshooting.

## Overview

A release produces:

- **Desktop installers** for macOS (arm64 + x64), Linux (x64), and Windows (x64)
- **CLI npm package** (`okcode`) published to the npm registry
- **GitHub Release** with all assets, updater metadata, and release documentation
- **Version bump commit** pushed back to `main`

Releases follow [Semantic Versioning 2.0](https://semver.org/). Versions with a pre-release suffix (e.g. `1.0.0-beta.1`) are published as GitHub prereleases. Plain `X.Y.Z` versions are marked as the latest release.

## Pre-release checklist

Complete every item before tagging.

### Quality gates

```bash
bun run fmt:check            # Formatting (oxfmt)
bun run lint                 # Linting (oxlint)
bun run typecheck            # TypeScript strict mode
bun run test                 # Unit + integration tests (Vitest, all workspaces)
bun run test:browser         # Browser tests (Playwright + Chromium)
bun run test:desktop-smoke   # Desktop smoke tests (Electron)
bun run release:smoke        # Release pipeline smoke test
```

All of the above must pass. The release workflow preflight runs `fmt:check`, `lint`, `typecheck`, `test`, and `release:smoke` automatically — but browser and desktop smoke tests should be confirmed in CI on `main` before tagging.

### Documentation

For version `X.Y.Z`, prepare these files **before** tagging:

| File                             | Purpose                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `CHANGELOG.md`                   | Add a `## [X.Y.Z] - YYYY-MM-DD` section following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) |
| `docs/releases/vX.Y.Z.md`        | Human-readable release notes (see template below)                                                          |
| `docs/releases/vX.Y.Z/assets.md` | Asset manifest for the release                                                                             |

The release workflow **will fail** if `docs/releases/vX.Y.Z.md` or `docs/releases/vX.Y.Z/assets.md` is missing.

### Release notes template

```markdown
# OK Code vX.Y.Z

**Date:** YYYY-MM-DD
**Tag:** [`vX.Y.Z`](https://github.com/OpenKnots/okcode/releases/tag/vX.Y.Z)

## Summary

One-sentence description of what this release delivers.

## Highlights

- **Change 1** — Brief description.
- **Change 2** — Brief description.

## Breaking changes

- None.

## Upgrade and install

- **CLI:** `npm install -g okcode@X.Y.Z`
- **Desktop:** Download from [GitHub Releases](https://github.com/OpenKnots/okcode/releases/tag/vX.Y.Z).

## Known limitations

- List anything users should be aware of.
```

## Cutting a release

### Tag-based (standard)

```bash
git checkout main
git pull origin main

# Final local sanity check
bun run fmt:check && bun run lint && bun run typecheck && bun run test

# Tag and push
git tag vX.Y.Z
git push origin vX.Y.Z
```

### Manual dispatch (re-run or hotfix)

```bash
gh workflow run release.yml -f version=X.Y.Z -f mac_arm64_only=false
```

## What the workflow does

- Trigger: push tag matching `v*.*.*`.
- Runs quality gates first: lint, typecheck, test.
- Builds four artifacts in parallel:
  - macOS `arm64` DMG
  - macOS `x64` DMG
  - Linux `x64` AppImage
  - Windows `x64` NSIS installer
- Publishes one GitHub Release with all produced files (desktop installers, updater metadata, and copies of `CHANGELOG.md` plus `docs/releases/vX.Y.Z.md` and `docs/releases/vX.Y.Z/assets.md` as `okcode-*.md` attachments).
  - Versions with a suffix after `X.Y.Z` (for example `1.2.3-alpha.1`) are published as GitHub prereleases.
  - Only plain `X.Y.Z` releases are marked as the repository's latest release.
- Includes Electron auto-update metadata (for example `latest*.yml` and `*.blockmap`) in release assets.
- Publishes the CLI package (`apps/server`, npm package `okcode`) with OIDC trusted publishing.
- Signing is optional and auto-detected per platform from secrets.

## Desktop auto-update notes

- Runtime updater: `electron-updater` in `apps/desktop/src/main.ts`.
- Update UX:
  - Background checks run on startup delay + interval.
  - No automatic download or install.
  - The desktop UI shows a rocket update button when an update is available; click once to download, click again after download to restart/install.
- Provider: GitHub Releases (`provider: github`) configured at build time.
- Repository slug source:
  - `OKCODE_DESKTOP_UPDATE_REPOSITORY` (format `owner/repo`), if set.
  - otherwise `GITHUB_REPOSITORY` from GitHub Actions.
- Temporary private-repo auth workaround:
  - set `OKCODE_DESKTOP_UPDATE_GITHUB_TOKEN` (or `GH_TOKEN`) in the desktop app runtime environment.
  - the app forwards it as an `Authorization: Bearer <token>` request header for updater HTTP calls.
- Required release assets for updater:
  - platform installers (`.exe`, `.dmg`, `.AppImage`, plus macOS `.zip` for Squirrel.Mac update payloads)
  - `latest*.yml` metadata
  - `*.blockmap` files (used for differential downloads)
- macOS metadata note:
  - `electron-updater` reads `latest-mac.yml` for both Intel and Apple Silicon.
  - The workflow merges the per-arch mac manifests into one `latest-mac.yml` before publishing the GitHub Release.

## 0) npm OIDC trusted publishing setup (CLI)

The workflow publishes the CLI with `bun publish` from `apps/server` after bumping
the package version to the release tag version.

Checklist:

1. Confirm npm org/user owns package `okcode` (or rename package first if needed).
2. In npm package settings, configure Trusted Publisher:
   - Provider: GitHub Actions
   - Repository: this repo
   - Workflow file: `.github/workflows/release.yml`
   - Environment (if used): match your npm trusted publishing config
3. Ensure npm account and org policies allow trusted publishing for the package.
4. Create release tag `vX.Y.Z` and push; workflow will:
   - set `apps/server/package.json` version to `X.Y.Z`
   - build web + server
   - run `bun publish --access public`

## 1) Dry-run release without signing

Use this first to validate the release pipeline.

1. Confirm no signing secrets are required for this test.
2. Create a test tag:
   - `git tag v0.0.0-test.1`
   - `git push origin v0.0.0-test.1`
3. Wait for `.github/workflows/release.yml` to finish.
4. Verify the GitHub Release contains all platform artifacts.
5. Download each artifact and sanity-check installation on each OS.

## 2) Apple signing + notarization setup (macOS)

Required secrets used by the workflow:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Checklist:

1. Apple Developer account access:
   - Team has rights to create Developer ID certificates.
2. Create `Developer ID Application` certificate.
3. Export certificate + private key as `.p12` from Keychain.
4. Base64-encode the `.p12` and store as `CSC_LINK`.
5. Store the `.p12` export password as `CSC_KEY_PASSWORD`.
6. In App Store Connect, create an API key (Team key).
7. Add API key values:
   - `APPLE_API_KEY`: contents of the downloaded `.p8`
   - `APPLE_API_KEY_ID`: Key ID
   - `APPLE_API_ISSUER`: Issuer ID
8. Re-run a tag release and confirm macOS artifacts are signed/notarized.

Notes:

- `APPLE_API_KEY` is stored as raw key text in secrets.
- The workflow writes it to a temporary `AuthKey_<id>.p8` file at runtime.
- **Hardened Runtime entitlements** for the packaged app live in the repo at `apps/desktop/resources/entitlements.mac.plist`. The desktop artifact script passes this path to electron-builder as an **absolute** path (so `codesign` can read it when signing unpacked native modules under deep paths). The build enables `hardenedRuntime` and passes Apple notarization env vars when `--signed` is used (all five macOS secrets must be set in GitHub Actions).

## 3) Azure Trusted Signing setup (Windows)

Required secrets used by the workflow:

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TRUSTED_SIGNING_ENDPOINT`
- `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
- `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`
- `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`

Checklist:

1. Create Azure Trusted Signing account and certificate profile.
2. Record ATS values:
   - Endpoint
   - Account name
   - Certificate profile name
   - Publisher name
3. Create/choose an Entra app registration (service principal).
4. Grant service principal permissions required by Trusted Signing.
5. Create a client secret for the service principal.
6. Add Azure secrets listed above in GitHub Actions secrets.
7. Re-run a tag release and confirm Windows installer is signed.

## 4) Apple Silicon (M-series) Mac–only release (manual dispatch)

To ship **only** the macOS **arm64** DMG (M-series / Apple Silicon) and skip Intel Mac, Linux, and Windows builds:

1. Open **Actions → Release Desktop → Run workflow**.
2. Set **version** to the SemVer you are releasing (for example `0.0.2` or `v0.0.2`).
3. Enable **mac_arm64_only** (workflow input).
4. Run the workflow.

Tag pushes always build the **full** matrix (all platforms); the M-series-only option applies only to **workflow_dispatch**.

To build the same arm64 DMG locally on an Apple Silicon Mac:

`bun run dist:desktop:dmg:arm64`

## 5) Release assets inventory

Every successful release attaches these to the GitHub Release:

| Asset                   | Source   | Format                      |
| ----------------------- | -------- | --------------------------- |
| macOS arm64 installer   | CI build | `.dmg`                      |
| macOS x64 installer     | CI build | `.dmg`                      |
| macOS updater payloads  | CI build | `.zip`                      |
| Linux installer         | CI build | `.AppImage`                 |
| Windows installer       | CI build | `.exe`                      |
| Differential blockmaps  | CI build | `.blockmap`                 |
| macOS update manifest   | CI merge | `latest-mac.yml`            |
| Linux update manifest   | CI build | `latest-linux.yml`          |
| Windows update manifest | CI build | `latest.yml`                |
| Changelog               | Repo     | `okcode-CHANGELOG.md`       |
| Release notes           | Repo     | `okcode-RELEASE-NOTES.md`   |
| Asset manifest          | Repo     | `okcode-ASSETS-MANIFEST.md` |

Additionally, the CLI is published to npm as `okcode@X.Y.Z`.

## 6) Post-release verification

After the workflow completes, verify:

- [ ] GitHub Release page shows correct version name and tag
- [ ] All platform installers are attached (DMG arm64, DMG x64, AppImage, .exe)
- [ ] Updater manifests attached (`latest-mac.yml`, `latest-linux.yml`, `latest.yml`)
- [ ] Documentation attachments present (`okcode-CHANGELOG.md`, `okcode-RELEASE-NOTES.md`, `okcode-ASSETS-MANIFEST.md`)
- [ ] `npm info okcode` shows the new version
- [ ] `npx okcode` launches successfully
- [ ] Desktop auto-updater detects the new version (test from a previous version install)
- [ ] Version bump commit landed on `main` (check `git log origin/main`)
- [ ] Prerelease flag is correct (prereleases for suffixed versions, latest for plain `X.Y.Z`)

## 7) Hotfix releases

For urgent patches:

1. Create a fix on `main` (or cherry-pick to a release branch if needed).
2. Prepare abbreviated release notes and changelog entry.
3. Tag with the next patch version: `vX.Y.(Z+1)`.
4. Push the tag — the full release pipeline runs identically.
5. For an M-series-only emergency fix, use manual dispatch with `mac_arm64_only=true`.

## 8) Troubleshooting

| Symptom                            | Likely cause                                | Fix                                                                                                              |
| ---------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| macOS build unsigned               | Missing Apple signing secrets               | Verify `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` are all populated |
| Windows build unsigned             | Missing Azure ATS secrets                   | Verify all `AZURE_*` secrets are populated                                                                       |
| Signing error                      | Expired certificate or bad credentials      | Retry without signing (`--signed` flag is auto-detected); re-check certs                                         |
| npm publish fails                  | OIDC misconfigured or package name conflict | Confirm trusted publisher config in npm settings matches workflow file                                           |
| Missing release notes              | `docs/releases/vX.Y.Z.md` not committed     | Create the file and re-tag or use manual dispatch                                                                |
| Preflight fails                    | Code quality issue                          | Fix on `main`, delete the tag, re-tag after fix                                                                  |
| Version bump commit missing        | GitHub App token issue                      | Check `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` secrets                                                     |
| Updater doesn't detect new version | `latest-mac.yml` malformed or missing       | Check merge step logs; verify `latest*.yml` files in release assets                                              |

## 9) CI/CD workflow inventory

| Workflow            | Trigger                                          | Purpose                                                                                      |
| ------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `ci.yml`            | PR, push to `main`                               | Full quality gate: format, lint, typecheck, test, browser test, desktop build, release smoke |
| `release.yml`       | Tag `v*.*.*`, manual dispatch                    | Multi-platform build, sign, publish CLI, create GitHub Release, version bump                 |
| `release-ready.yml` | PR touching `CHANGELOG.md` or `docs/releases/**` | Validates release documentation completeness                                                 |
| `audit.yml`         | Weekly (Monday 9am UTC), manual                  | Dependency audit, creates issue if outdated packages found                                   |
| `pr-size.yml`       | PR events                                        | Auto-labels PRs by diff size (`size:XS` through `size:XXL`)                                  |
| `pr-vouch.yml`      | PR events                                        | Labels PRs by contributor trust level                                                        |
| `issue-labels.yml`  | Push to `main` (issue template changes), manual  | Syncs managed issue label definitions                                                        |
