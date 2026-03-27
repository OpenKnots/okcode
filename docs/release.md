# Release Runbook

Canonical release process documentation for the OK Code project.

**Last updated:** 2026-03-27

---

## Table of contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Version numbering](#version-numbering)
4. [Pre-release checklist](#pre-release-checklist)
5. [Cutting a release](#cutting-a-release)
6. [What the pipeline does](#what-the-pipeline-does)
7. [Release assets inventory](#release-assets-inventory)
8. [Post-release verification checklist](#post-release-verification-checklist)
9. [Hotfix releases](#hotfix-releases)
10. [Desktop auto-update notes](#desktop-auto-update-notes)
11. [Troubleshooting](#troubleshooting)

---

## Overview

A release of OK Code produces:

- **Desktop installers** for macOS (arm64 + x64 DMG), Linux (x64 AppImage), and Windows (x64 NSIS).
- **CLI npm package** (`okcode`) published to the npm registry.
- **GitHub Release** with all installer binaries, Electron updater metadata, and documentation attachments.
- **Post-release version bump** committed to `main` by a GitHub App bot.

Releases follow Semantic Versioning and are triggered either by pushing a version tag (`v*.*.*`) or by manual workflow dispatch. Code signing is automatic when the required secrets are configured and is gracefully skipped otherwise.

---

## Prerequisites

### Required secrets

All secrets are configured in **GitHub Actions repository secrets**.

#### Apple code signing and notarization (macOS)

| Secret             | Description                                                              |
| ------------------ | ------------------------------------------------------------------------ |
| `CSC_LINK`         | Base64-encoded `.p12` Developer ID Application certificate + private key |
| `CSC_KEY_PASSWORD` | Password for the `.p12` export                                           |
| `APPLE_API_KEY`    | Raw contents of the App Store Connect API `.p8` key file                 |
| `APPLE_API_KEY_ID` | App Store Connect API Key ID                                             |
| `APPLE_API_ISSUER` | App Store Connect API Issuer ID                                          |

Setup:

1. Create a `Developer ID Application` certificate in the Apple Developer portal.
2. Export the certificate + private key as `.p12` from Keychain Access.
3. Base64-encode the `.p12` file and store the result as `CSC_LINK`.
4. Store the `.p12` export password as `CSC_KEY_PASSWORD`.
5. In App Store Connect, create a Team API key. Store the `.p8` file contents as `APPLE_API_KEY`, the Key ID as `APPLE_API_KEY_ID`, and the Issuer ID as `APPLE_API_ISSUER`.
6. The workflow writes `APPLE_API_KEY` to a temporary `AuthKey_<id>.p8` file at runtime.

#### Azure Trusted Signing (Windows)

| Secret                                           | Description                                    |
| ------------------------------------------------ | ---------------------------------------------- |
| `AZURE_TENANT_ID`                                | Entra (Azure AD) tenant ID                     |
| `AZURE_CLIENT_ID`                                | Service principal (app registration) client ID |
| `AZURE_CLIENT_SECRET`                            | Service principal client secret                |
| `AZURE_TRUSTED_SIGNING_ENDPOINT`                 | Azure Trusted Signing service endpoint URL     |
| `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`             | Trusted Signing account name                   |
| `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME` | Certificate profile name                       |
| `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`           | Publisher name for the signing certificate     |

Setup:

1. Create an Azure Trusted Signing account and certificate profile in the Azure portal.
2. Create or choose an Entra app registration (service principal) and grant it Trusted Signing permissions.
3. Create a client secret for the service principal.
4. Add all seven secrets to GitHub Actions.

#### npm publishing (CLI)

| Secret      | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `NPM_TOKEN` | npm access token for publishing the `okcode` package (if not using OIDC) |

For OIDC trusted publishing, configure the npm package settings:

1. Provider: GitHub Actions.
2. Repository: `OpenKnots/okcode`.
3. Workflow file: `.github/workflows/release.yml`.

#### Post-release automation

| Secret                    | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `RELEASE_APP_ID`          | GitHub App ID used for the post-release version bump |
| `RELEASE_APP_PRIVATE_KEY` | Private key (PEM) for the GitHub App                 |

The GitHub App must be installed on the repository with write access to contents. It must be allowed to push to `main` (add as a bypass actor if branch protection is enabled).

### Required tools and versions

| Tool    | Version    | Source                        |
| ------- | ---------- | ----------------------------- |
| Bun     | `^1.3.9`   | `package.json` `engines.bun`  |
| Node.js | `^24.13.1` | `package.json` `engines.node` |
| Turbo   | `^2.3.3`   | `devDependencies`             |

These are installed automatically in CI via `oven-sh/setup-bun` and `actions/setup-node` using the version files in `package.json`.

### Permissions needed

- **GitHub:** Write access to the repository (for tagging and releases).
- **npm:** Publish rights on the `okcode` package.
- **Apple Developer:** Team membership with Developer ID Application certificate rights.
- **Azure:** Service principal with Azure Trusted Signing permissions.

---

## Version numbering

OK Code follows [Semantic Versioning 2.0](https://semver.org/spec/v2.0.0.html):

```
MAJOR.MINOR.PATCH
```

- **MAJOR** -- breaking changes to the CLI interface, server API, or desktop app behavior.
- **MINOR** -- new features, backward-compatible additions.
- **PATCH** -- bug fixes, performance improvements, documentation corrections.

### Prerelease conventions

Prerelease versions use a hyphenated suffix after the patch number:

```
X.Y.Z-<label>.<number>
```

Examples:

- `0.1.0-beta.1` -- first beta of 0.1.0
- `1.0.0-rc.1` -- first release candidate of 1.0.0
- `0.2.0-alpha.3` -- third alpha of 0.2.0

Prerelease tags:

- Are published as **GitHub prereleases** (not marked as "latest").
- Use the same pipeline as stable releases.
- Should still pass all quality gates.

---

## Pre-release checklist

Complete every item before tagging.

### Quality gates

Run all checks locally or verify they pass on the latest `main` CI run:

```bash
bun run fmt:check                        # Formatting (oxfmt)
bun run lint                             # Linting (oxlint)
bun run typecheck                        # TypeScript type checking (all workspaces)
bun run test                             # Unit tests (Vitest, all workspaces)
bun run --cwd apps/web test:browser      # Playwright browser tests
bun run test:desktop-smoke               # Desktop smoke tests
bun run release:smoke                    # Release pipeline smoke test
```

- [ ] All checks pass on the `main` branch CI (`.github/workflows/ci.yml`).
- [ ] No unresolved release-blocking issues in the tracker.

### Documentation prep

- [ ] **CHANGELOG.md** -- Add a new section under `## [X.Y.Z] - YYYY-MM-DD` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Include entries under `Added`, `Changed`, `Fixed`, `Removed`, etc. as appropriate. Add the version comparison link at the bottom of the file.
- [ ] **docs/releases/vX.Y.Z.md** -- Create release notes with summary, highlights, upgrade/install instructions, and known limitations. Use `docs/releases/v0.0.1.md` as a template.
- [ ] **docs/releases/vX.Y.Z/assets.md** -- Create the asset manifest listing expected desktop installers, updater metadata, and documentation attachments. Use `docs/releases/v0.0.1/assets.md` as a template.
- [ ] **docs/releases/README.md** -- Add the new version row to the release notes index table.

The release pipeline **will fail** if `docs/releases/vX.Y.Z.md` or `docs/releases/vX.Y.Z/assets.md` is missing for the version being released.

### Release notes template

```markdown
# OK Code vX.Y.Z

**Date:** YYYY-MM-DD
**Tag:** [`vX.Y.Z`](https://github.com/OpenKnots/okcode/releases/tag/vX.Y.Z)

## Summary

One-sentence description of what this release delivers.

## Highlights

- **Feature A** -- Brief description.
- **Fix B** -- Brief description.

## Breaking changes

- None (or describe breaking changes).

## Upgrade and install

- **CLI:** `npm install -g okcode@X.Y.Z`
- **Desktop:** Download from [GitHub Releases](https://github.com/OpenKnots/okcode/releases/tag/vX.Y.Z).

## Known limitations

- List anything users should be aware of.
```

### Final review

- [ ] All documentation changes are committed and pushed to `main`.
- [ ] The `main` branch CI is green.

---

## Cutting a release

### Option A: Tag-based flow (recommended for stable releases)

```bash
# Ensure you are on main and up to date
git checkout main
git pull origin main

# Optional: final local sanity check
bun run fmt:check && bun run lint && bun run typecheck && bun run test

# Create and push the tag
git tag vX.Y.Z
git push origin vX.Y.Z
```

Tag pushes always build the **full platform matrix** (macOS arm64, macOS x64, Linux x64, Windows x64).

### Option B: Manual dispatch flow (workflow_dispatch)

Use this for prereleases, re-runs, or arm64-only builds.

**Via GitHub UI:**

1. Go to **Actions > Release Desktop > Run workflow**.
2. Set **version** to the SemVer string (e.g., `1.2.3` or `v1.2.3`; the `v` prefix is optional).
3. Optionally enable **mac_arm64_only** to build only the macOS Apple Silicon DMG (skips Intel Mac, Linux, and Windows).
4. Click **Run workflow**.

**Via CLI:**

```bash
# Full matrix
gh workflow run release.yml -f version=1.2.3

# Apple Silicon only
gh workflow run release.yml -f version=1.2.3 -f mac_arm64_only=true
```

### Dry-run release (pipeline validation)

To validate the release pipeline without shipping a real version:

1. Create a test prerelease tag: `git tag v0.0.0-test.1`
2. Push it: `git push origin v0.0.0-test.1`
3. Wait for the workflow to complete.
4. Verify the GitHub prerelease contains all platform artifacts.
5. Delete the prerelease and tag when done.

---

## What the pipeline does

The release workflow (`.github/workflows/release.yml`) runs six jobs:

### 1. Configure

- **Runner:** `ubuntu-24.04`
- Reads the `mac_arm64_only` input (only applies to `workflow_dispatch`).
- Outputs the build matrix JSON:
  - **Full matrix (default):** macOS arm64, macOS x64, Linux x64, Windows x64.
  - **arm64-only:** macOS arm64 only.

### 2. Preflight

- **Runner:** `ubuntu-24.04`
- **Depends on:** nothing (runs in parallel with Configure).
- Checks out the code at the triggering ref.
- Resolves the release version from the tag name or manual input.
- Validates the version matches `^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$`.
- Sets output flags: `version`, `tag`, `is_prerelease`, `make_latest`.
- Installs Bun and Node via version files in `package.json`.
- Runs `bun install --frozen-lockfile`.
- Runs **lint**, **typecheck**, and **test** as a final quality gate.

### 3. Build (matrix)

- **Runners:** `macos-14` (arm64), `macos-15-intel` (x64), `ubuntu-24.04` (Linux), `windows-2022` (Windows).
- **Depends on:** Preflight, Configure.
- Runs in parallel across platforms with `fail-fast: false` (one platform failing does not cancel others).
- Aligns all workspace `package.json` versions to the release version via `scripts/update-release-package-versions.ts`.
- Invokes `bun run dist:desktop:artifact` with `--platform`, `--target`, `--arch`, and `--build-version` flags.
- Detects signing secrets per platform and passes `--signed` when all required secrets are present:
  - **macOS:** Writes `APPLE_API_KEY` to a temporary `.p8` file at `$RUNNER_TEMP`.
  - **Windows:** Uses Azure Trusted Signing via environment variables.
  - **Linux:** No code signing.
- Collects release assets (`.dmg`, `.zip`, `.AppImage`, `.exe`, `.blockmap`, `latest*.yml`) into `release-publish/`.
- Renames `latest-mac.yml` to `latest-mac-x64.yml` for the non-arm64 macOS build (prevents collision before merging).
- Uploads artifacts via `actions/upload-artifact` as `desktop-<platform>-<arch>`.

### 4. Publish CLI (`publish_cli`)

- **Runner:** `ubuntu-24.04`
- **Depends on:** Preflight, Build.
- Aligns package versions to the release version.
- Builds `@okcode/web` and `okcode` packages.
- Publishes the `okcode` CLI to npm with `--tag latest` via `apps/server/scripts/cli.ts publish`.

### 5. Release

- **Runner:** `ubuntu-24.04`
- **Depends on:** Preflight, Build, Publish CLI, Configure.
- Downloads all desktop build artifacts and merges them into `release-assets/`.
- Merges per-arch macOS updater manifests into a single `latest-mac.yml` using `scripts/merge-mac-update-manifests.ts` (skipped for arm64-only builds).
- **Validates documentation exists** -- fails the build if `docs/releases/vX.Y.Z.md` or `docs/releases/vX.Y.Z/assets.md` is missing.
- Copies documentation into `release-assets/`:
  - `CHANGELOG.md` -> `okcode-CHANGELOG.md`
  - `docs/releases/vX.Y.Z.md` -> `okcode-RELEASE-NOTES.md`
  - `docs/releases/vX.Y.Z/assets.md` -> `okcode-ASSETS-MANIFEST.md`
- Creates the GitHub Release via `softprops/action-gh-release`:
  - Tag: `vX.Y.Z`
  - Name: `OK Code vX.Y.Z`
  - Auto-generated release notes from commits.
  - Prerelease flag set for non-stable versions.
  - `make_latest` set only for stable `X.Y.Z` versions.
  - All files in `release-assets/` attached. Fails if any file pattern is unmatched.

### 6. Finalize

- **Runner:** `ubuntu-24.04`
- **Depends on:** Preflight, Release.
- Mints a GitHub App token using `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`.
- Checks out `main` with full history using the app token.
- Resolves the GitHub App bot identity (username and noreply email).
- Runs `scripts/update-release-package-versions.ts` with `--github-output` to update `package.json` files in `apps/server`, `apps/desktop`, `apps/web`, and `packages/contracts`.
- Formats the updated files with `oxfmt`.
- Refreshes `bun.lock` with `bun install --lockfile-only --ignore-scripts`.
- Commits as the bot: `chore(release): prepare vX.Y.Z`.
- Pushes to `main`.

---

## Release assets inventory

After a successful full-matrix release, the GitHub Release contains:

### Desktop installers

| Platform | Architecture          | Format         | Typical filename pattern      |
| -------- | --------------------- | -------------- | ----------------------------- |
| macOS    | arm64 (Apple Silicon) | DMG            | `OK Code-X.Y.Z-arm64.dmg`     |
| macOS    | x64 (Intel)           | DMG            | `OK Code-X.Y.Z.dmg`           |
| macOS    | arm64                 | ZIP (updater)  | `OK Code-X.Y.Z-arm64-mac.zip` |
| macOS    | x64                   | ZIP (updater)  | `OK Code-X.Y.Z-mac.zip`       |
| Linux    | x64                   | AppImage       | `OK Code-X.Y.Z.AppImage`      |
| Windows  | x64                   | NSIS installer | `OK Code Setup X.Y.Z.exe`     |

### Electron updater metadata

| File               | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `latest-mac.yml`   | macOS update manifest (merged from per-arch builds) |
| `latest-linux.yml` | Linux update manifest                               |
| `latest.yml`       | Windows update manifest                             |
| `*.blockmap`       | Differential download block maps                    |

### Documentation attachments

| File                        | Source in repo                   |
| --------------------------- | -------------------------------- |
| `okcode-CHANGELOG.md`       | `CHANGELOG.md`                   |
| `okcode-RELEASE-NOTES.md`   | `docs/releases/vX.Y.Z.md`        |
| `okcode-ASSETS-MANIFEST.md` | `docs/releases/vX.Y.Z/assets.md` |

### npm package

| Package  | Registry | Install command               |
| -------- | -------- | ----------------------------- |
| `okcode` | npm      | `npm install -g okcode@X.Y.Z` |

---

## Post-release verification checklist

After the pipeline completes:

- [ ] **GitHub Release exists** at `https://github.com/OpenKnots/okcode/releases/tag/vX.Y.Z`.
- [ ] **All expected assets** are attached (check against the inventory above).
- [ ] **Prerelease flag** is correct (set for `-beta.N`, `-rc.N`, etc.; unset for stable).
- [ ] **"Latest" badge** points to this release (stable releases only).
- [ ] **npm package** is published: run `npm info okcode@X.Y.Z`.
- [ ] **CLI works:** run `npx okcode@X.Y.Z --version` and confirm the expected version.
- [ ] **Version bump commit** landed on `main`: look for `chore(release): prepare vX.Y.Z` in `git log origin/main`.
- [ ] **macOS DMG (arm64):** Download, mount, drag to Applications, launch. Verify the app opens without Gatekeeper warnings (if signed).
- [ ] **macOS DMG (x64):** Same verification on an Intel Mac or under Rosetta.
- [ ] **Linux AppImage:** Download, `chmod +x`, run. Verify the app launches.
- [ ] **Windows installer:** Download, run setup. Verify the app launches. Check digital signature (right-click > Properties > Digital Signatures) if signed.
- [ ] **Auto-update:** If a previous release exists, launch the older desktop version and confirm the update prompt appears.

---

## Hotfix releases

For urgent patches that need to ship quickly.

### Process

1. **Branch from main (or from the release tag if main has diverged significantly):**

   ```bash
   git checkout -b hotfix/v1.2.1 v1.2.0
   ```

2. **Apply the fix.** Keep changes minimal -- only the fix and any directly related test updates.

3. **Run quality gates locally:**

   ```bash
   bun run fmt:check && bun run lint && bun run typecheck && bun run test
   ```

4. **Merge to main** via a fast-tracked pull request.

5. **Prepare documentation** on `main`:
   - Update `CHANGELOG.md` with the patch entry.
   - Create `docs/releases/vX.Y.Z.md` and `docs/releases/vX.Y.Z/assets.md`.
   - Update `docs/releases/README.md`.

6. **Tag and push from main:**

   ```bash
   git checkout main
   git pull origin main
   git tag v1.2.1
   git push origin v1.2.1
   ```

7. **Verify** using the [post-release verification checklist](#post-release-verification-checklist).

### Prerelease hotfix (for validation before going stable)

If you want to test the fix as a prerelease first:

```bash
git tag v1.2.1-hotfix.1
git push origin v1.2.1-hotfix.1
```

This publishes as a GitHub prerelease and does not update the "latest" designation.

### Apple Silicon-only emergency fix

For an M-series-only emergency fix, use manual dispatch:

```bash
gh workflow run release.yml -f version=1.2.1 -f mac_arm64_only=true
```

---

## Desktop auto-update notes

- **Runtime updater:** `electron-updater` in `apps/desktop/src/main.ts`.
- **Update behavior:**
  - Background checks run on a startup delay plus a periodic interval.
  - No automatic download or install.
  - The desktop UI shows an update button when an update is available; click once to download, click again to restart and install.
- **Provider:** GitHub Releases (`provider: github`), configured at build time.
- **Repository source:**
  - `OKCODE_DESKTOP_UPDATE_REPOSITORY` environment variable (format `owner/repo`), if set.
  - Otherwise `GITHUB_REPOSITORY` from the GitHub Actions build environment.
- **Private repo workaround:** Set `OKCODE_DESKTOP_UPDATE_GITHUB_TOKEN` (or `GH_TOKEN`) in the desktop app runtime environment to authenticate updater HTTP calls.
- **Required release assets for the updater to function:**
  - Platform installers (`.exe`, `.dmg`, `.AppImage`, plus macOS `.zip` for Squirrel.Mac update payloads).
  - `latest*.yml` metadata files.
  - `*.blockmap` files (used for differential downloads).
- **macOS metadata:** `electron-updater` reads a single `latest-mac.yml` for both Intel and Apple Silicon. The release workflow merges per-arch manifests into one file before publishing.

---

## Troubleshooting

### macOS signing failures

| Symptom                                                 | Likely cause                                             | Fix                                                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| "macOS signing disabled" in build log                   | One or more Apple secrets are missing or empty           | Verify `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` are all set in GitHub secrets |
| Notarization timeout or rejection                       | Certificate expired, or binary triggers Gatekeeper rules | Renew the Developer ID Application certificate; check Apple notarization logs via `xcrun notarytool log`                     |
| "The specified item could not be found in the keychain" | Corrupted or wrongly encoded `CSC_LINK`                  | Re-export the `.p12`, base64-encode it, and update the secret                                                                |

### Windows signing failures

| Symptom                                 | Likely cause                                           | Fix                                                                                                    |
| --------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| "Windows signing disabled" in build log | One or more Azure secrets are missing or empty         | Verify all seven `AZURE_*` secrets are set                                                             |
| Azure authentication error              | Service principal credentials expired or incorrect     | Rotate the client secret in Entra; update `AZURE_CLIENT_SECRET`                                        |
| "Certificate profile not found"         | Mismatch between secret values and Azure portal config | Double-check `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME` and `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME` |

### npm publish failures

| Symptom                                                     | Likely cause                                    | Fix                                                                  |
| ----------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| 401 or 403 from npm                                         | Token expired, missing, or lacks publish rights | Regenerate `NPM_TOKEN` or reconfigure OIDC trusted publishing        |
| "You cannot publish over the previously published versions" | Version already exists on npm                   | This version was already published; bump the version if re-releasing |
| Package contents missing web assets                         | Build step did not complete                     | Check the `publish_cli` job logs for build errors                    |

### Missing release documentation

| Symptom                                                  | Likely cause                             | Fix                                                         |
| -------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| "Missing release notes: docs/releases/vX.Y.Z.md"         | Documentation not created before tagging | Create the file on `main`, delete the tag, re-tag, and push |
| "Missing asset manifest: docs/releases/vX.Y.Z/assets.md" | Same as above                            | Same fix                                                    |

To delete and re-push a tag:

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
# Fix the issue on main, then re-tag
git tag vX.Y.Z
git push origin vX.Y.Z
```

### Build matrix failures

| Symptom                                   | Likely cause                                            | Fix                                                                                  |
| ----------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| One platform fails, others succeed        | Platform-specific issue (runner, dependencies, signing) | Check the failed job's logs; `fail-fast: false` means other platforms still complete |
| All builds fail at "Install dependencies" | Lockfile drift or registry outage                       | Run `bun install --frozen-lockfile` locally to verify; check Bun/npm registry status |
| Preflight fails (lint/typecheck/test)     | Code quality issue on the tagged commit                 | Fix on `main`, delete the tag, re-tag                                                |

### Finalize job failures

| Symptom                                     | Likely cause                        | Fix                                                                                                  |
| ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Resource not accessible by integration"    | GitHub App token lacks permissions  | Verify `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`; ensure the app is installed with write access |
| Version bump commit not appearing on `main` | Branch protection blocking the push | Ensure the GitHub App bot is added as a bypass actor in branch protection rules                      |

### General tips

- **Re-running a failed release:** Use the GitHub Actions UI to re-run failed jobs. Transient infrastructure issues often resolve on retry.
- **Testing the pipeline without a real release:** Use a prerelease tag like `v0.0.0-test.1`. It creates a GitHub prerelease that can be deleted afterward.
- **Local desktop builds for testing:**

  ```bash
  bun run dist:desktop:dmg:arm64   # macOS Apple Silicon
  bun run dist:desktop:dmg:x64     # macOS Intel
  bun run dist:desktop:linux        # Linux AppImage
  bun run dist:desktop:win          # Windows NSIS
  ```

- **Verifying macOS signing locally:**

  ```bash
  codesign -dv --verbose=4 /path/to/OK\ Code.app
  spctl -a -v /path/to/OK\ Code.app
  ```
