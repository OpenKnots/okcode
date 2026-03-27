# v0.0.1 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.0.1`](https://github.com/OpenKnots/okcode/releases/tag/v0.0.1) by the [Release Desktop workflow](../../.github/workflows/release.yml).

After the workflow completes, expect artifacts similar to the following (exact names may include the product name `OK Code` and version `0.0.1`).

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

## Checksums

SHA-256 checksums are not committed here; verify downloads via GitHub’s release UI or `gh release download` if you use the GitHub CLI.
