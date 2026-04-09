# v0.19.0 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.19.0`](https://github.com/OpenKnots/okcode/releases/tag/v0.19.0) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** with stable filenames:

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.19.0.md](../v0.19.0.md)           |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

## Desktop installers and updater payloads

| Platform            | Kind           | Expected attachment class |
| ------------------- | -------------- | ------------------------- |
| macOS Apple Silicon | DMG (signed)   | `*.dmg` (arm64)           |
| macOS Intel         | DMG (signed)   | `*.dmg` (x64, compat run) |
| macOS               | ZIP (updater)  | `*.zip`                   |
| Linux x64           | AppImage       | `*.AppImage`              |
| Windows x64         | NSIS installer | `*.exe`                   |

### macOS code signing and notarization

All macOS DMG and ZIP payloads are expected to be code-signed with an Apple Developer ID certificate and notarized before publication. Gatekeeper should verify the signature on first launch. The hardened runtime is enabled with entitlements defined in `apps/desktop/resources/entitlements.mac.plist`.

## Electron updater metadata

| File pattern       | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `latest-mac.yml`   | macOS update manifest merged from release CI outputs |
| `latest-linux.yml` | Linux update manifest                                |
| `latest.yml`       | Windows update manifest                              |
| `*.blockmap`       | Differential download block maps                     |

## iOS (TestFlight)

The iOS build is uploaded directly to App Store Connect / TestFlight by the [Release iOS workflow](../../.github/workflows/release-ios.yml) when signing secrets are configured. No IPA artifact is attached to the GitHub Release.

| Detail            | Value                              |
| ----------------- | ---------------------------------- |
| Bundle ID         | `com.openknots.okcode.mobile`      |
| Marketing version | `0.19.0`                           |
| Build number      | Set from `GITHUB_RUN_NUMBER` in CI |

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub's release UI or `gh release download` if you use the GitHub CLI.
