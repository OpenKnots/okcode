# v0.0.9 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.0.9`](https://github.com/OpenKnots/okcode/releases/tag/v0.0.9) by the [Release Desktop workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** (same content as in-repo, stable filenames for download):

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.0.9.md](../v0.0.9.md)             |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

## Published on GitHub (`v0.0.9`)

These files are expected on the full-matrix `v0.0.9` release:

| File                               | Purpose                           |
| ---------------------------------- | --------------------------------- |
| `OK-Code-0.0.9-arm64.dmg`          | macOS Apple Silicon installer     |
| `OK-Code-0.0.9-arm64.dmg.blockmap` | macOS arm64 DMG blockmap          |
| `OK-Code-0.0.9-arm64.zip`          | macOS arm64 updater payload       |
| `OK-Code-0.0.9-arm64.zip.blockmap` | macOS arm64 ZIP blockmap          |
| `OK-Code-0.0.9-x64.dmg`            | macOS Intel installer             |
| `OK-Code-0.0.9-x64.dmg.blockmap`   | macOS x64 DMG blockmap            |
| `OK-Code-0.0.9-x64.zip`            | macOS x64 updater payload         |
| `OK-Code-0.0.9-x64.zip.blockmap`   | macOS x64 ZIP blockmap            |
| `OK-Code-0.0.9-x86_64.AppImage`    | Linux x64 AppImage                |
| `OK-Code-0.0.9-x64.exe`            | Windows x64 installer             |
| `OK-Code-0.0.9-x64.exe.blockmap`   | Windows differential update map   |
| `latest-mac.yml`                   | merged macOS update manifest      |
| `latest-linux.yml`                 | Linux update manifest             |
| `latest.yml`                       | Windows update manifest           |
| `okcode-CHANGELOG.md`              | in-repo changelog attachment      |
| `okcode-RELEASE-NOTES.md`          | in-repo release notes attachment  |
| `okcode-ASSETS-MANIFEST.md`        | in-repo asset manifest attachment |

## Checksums

GitHub now exposes SHA-256 digests for uploaded release assets. Verify each asset from the release UI or `gh release view v0.0.9 --json assets`.
