# v0.0.4 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.0.4`](https://github.com/OpenKnots/okcode/releases/tag/v0.0.4) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** (same content as in-repo, stable filenames for download):

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.0.4.md](../v0.0.4.md)             |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

## Published on GitHub (`v0.0.4`)

These files are attached to the [v0.0.4 release](https://github.com/OpenKnots/okcode/releases/tag/v0.0.4) (macOS Apple Silicon only for this tag):

| File                               | Role                           |
| ---------------------------------- | ------------------------------ |
| `OK-Code-0.0.4-arm64.dmg`          | macOS Apple Silicon installer  |
| `OK-Code-0.0.4-arm64.dmg.blockmap` | DMG differential updates       |
| `OK-Code-0.0.4-arm64.zip`          | macOS updater payload (zip)    |
| `OK-Code-0.0.4-arm64.zip.blockmap` | Zip differential updates       |
| `latest-mac.yml`                   | Electron macOS update manifest |
| `okcode-CHANGELOG.md`              | Root changelog (copy)          |
| `okcode-RELEASE-NOTES.md`          | [v0.0.4.md](../v0.0.4.md) copy |
| `okcode-ASSETS-MANIFEST.md`        | This manifest (copy)           |

Other platforms (Intel macOS, Linux, Windows) may ship on future tags when CI attaches those artifacts.

## Typical patterns (future / multi-platform builds)

| Platform            | Kind           | Typical pattern                      |
| ------------------- | -------------- | ------------------------------------ |
| macOS Apple Silicon | DMG            | `OK-Code-*-arm64.dmg`                |
| macOS Intel         | DMG            | `OK-Code-*-x64.dmg` or `*.dmg` (x64) |
| macOS               | ZIP (updater)  | `OK-Code-*-arm64.zip`, etc.          |
| Linux x64           | AppImage       | `*.AppImage`                         |
| Windows x64         | NSIS installer | `*.exe`                              |

## Electron updater metadata

| File               | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `latest-mac.yml`   | macOS update manifest (merged from per-arch builds in CI) |
| `latest-linux.yml` | Linux update manifest (when published)                    |
| `latest.yml`       | Windows update manifest (when published)                  |
| `*.blockmap`       | Differential download block maps                          |

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub's release UI or `gh release download` if you use the GitHub CLI.
