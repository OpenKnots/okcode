# v0.23.1 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.23.1`](https://github.com/OpenKnots/okcode/releases/tag/v0.23.1) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** (same content as in-repo, stable filenames for download):

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.23.1.md](../v0.23.1.md)           |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

After the workflow completes, expect **installer and updater** artifacts similar to the following (exact names may include the product name `OK Code` and version `0.23.1`).

## Desktop installers and payloads

| Platform            | Kind           | Typical pattern |
| ------------------- | -------------- | --------------- |
| macOS Apple Silicon | DMG (signed)   | `*.dmg` (arm64) |
| macOS Intel         | DMG (signed)   | `*.dmg` (x64)   |
| macOS               | ZIP (updater)  | `*.zip`         |
| Linux x64           | AppImage       | `*.AppImage`    |
| Windows x64         | NSIS installer | `*.exe`         |

### macOS code signing and notarization

All macOS DMG and ZIP payloads are **code-signed** with an Apple Developer ID certificate and **notarized** via the Apple notarization service. Gatekeeper will verify the signature on first launch. The hardened runtime is enabled with entitlements defined in `apps/desktop/resources/entitlements.mac.plist`.

## Electron updater metadata

| File               | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `latest-mac.yml`   | macOS update manifest (merged from per-arch builds in CI) |
| `latest-linux.yml` | Linux update manifest                                     |
| `latest.yml`       | Windows update manifest                                   |
| `*.blockmap`       | Differential download block maps                          |

## iOS (TestFlight)

The iOS build is uploaded directly to App Store Connect / TestFlight by the [Release iOS workflow](../../.github/workflows/release-ios.yml). No IPA artifact is attached to the GitHub Release.

| Detail            | Value                                      |
| ----------------- | ------------------------------------------ |
| Bundle ID         | `com.openknots.okcode.mobile`              |
| Marketing version | `0.23.1`                                   |
| Build number      | Set from `GITHUB_RUN_NUMBER` at build time |

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub's release UI or `gh release download` if you use the GitHub CLI.

## Operational references

| File                                         | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [rollout-checklist.md](rollout-checklist.md) | Step-by-step release playbook from preflight through post-release |
| [soak-test-plan.md](soak-test-plan.md)       | Structured release validation for the highest-risk surfaces       |
