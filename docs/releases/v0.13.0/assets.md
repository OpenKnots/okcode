# v0.13.0 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.13.0`](https://github.com/OpenKnots/okcode/releases/tag/v0.13.0) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** (same content as in-repo, stable filenames for download):

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.13.0.md](../v0.13.0.md)           |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

After the workflow completes, expect **installer and updater** artifacts similar to the following (exact names may include the product name `OK Code` and version `0.13.0`).

## Desktop installers and payloads

| Platform            | Kind           | Typical pattern |
| ------------------- | -------------- | --------------- |
| macOS Apple Silicon | DMG            | `*.dmg` (arm64) |
| macOS Intel         | DMG            | `*.dmg` (x64)   |
| macOS               | ZIP (updater)  | `*.zip`         |
| Linux x64           | AppImage       | `*.AppImage`    |
| Windows x64         | NSIS installer | `*.exe`         |

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
| Marketing version | `0.13.0`                                   |
| Build number      | Set from `GITHUB_RUN_NUMBER` at build time |

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub's release UI or `gh release download` if you use the GitHub CLI.
