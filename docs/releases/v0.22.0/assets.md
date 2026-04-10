# v0.22.0 — Release assets (manifest)

Binaries are **not** stored in this git repository; they are attached to the [GitHub Release for `v0.22.0`](https://github.com/OpenKnots/okcode/releases/tag/v0.22.0) by the [coordinated release workflow](../../.github/workflows/release.yml).

The GitHub Release also includes **documentation attachments** with stable filenames:

| File                        | Source in repo                        |
| --------------------------- | ------------------------------------- |
| `okcode-CHANGELOG.md`       | [CHANGELOG.md](../../../CHANGELOG.md) |
| `okcode-RELEASE-NOTES.md`   | [v0.22.0.md](../v0.22.0.md)           |
| `okcode-ASSETS-MANIFEST.md` | This file                             |

After the workflow completes, the release should contain the coordinated desktop outputs below. Filenames may include the product name `OK Code` and the version string `0.22.0`.

## Desktop installers and payloads

| Platform            | Kind           | Expected attachment pattern |
| ------------------- | -------------- | --------------------------- |
| macOS Apple Silicon | DMG (signed)   | `*.dmg` (arm64)             |
| macOS               | ZIP (updater)  | `*.zip`                     |
| Linux x64           | AppImage       | `*.AppImage`                |
| Windows x64         | NSIS installer | `*.exe`                     |

The release workflow also uploads updater manifests and differential payload metadata:

- `latest-mac*.yml`
- `latest-linux.yml`
- `latest.yml`
- `*.blockmap`

### Intel compatibility artifact

The separate [`release-intel-compat.yml`](../../.github/workflows/release-intel-compat.yml) workflow produces the non-blocking macOS x64 compatibility build. It is **not** part of the coordinated stable release attachment set unless it is uploaded separately after that workflow runs.

### macOS code signing and notarization

All coordinated macOS DMG and ZIP payloads are expected to be code-signed with the Apple Developer ID certificate and notarized before release publication. Gatekeeper verifies the signature on first launch.

## Electron updater metadata

| File               | Purpose                                                   |
| ------------------ | --------------------------------------------------------- |
| `latest-mac*.yml`  | macOS update manifest                                     |
| `latest-linux.yml` | Linux update manifest                                     |
| `latest.yml`       | Windows update manifest                                   |
| `*.blockmap`       | Differential download block maps for Electron auto-update |

## iOS (TestFlight)

The iOS build is uploaded directly to App Store Connect / TestFlight by the coordinated release workflow. No IPA is attached to the GitHub Release.

| Detail            | Value                         |
| ----------------- | ----------------------------- |
| Bundle ID         | `com.openknots.okcode.mobile` |
| Marketing version | `0.22.0`                      |
| Build number      | Set from `GITHUB_RUN_NUMBER`  |

## Rollout documentation

| Document                                     | Purpose                                                           |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [rollout-checklist.md](rollout-checklist.md) | Step-by-step release playbook from preflight through post-release |
| [soak-test-plan.md](soak-test-plan.md)       | Structured release validation for the highest-risk surfaces       |

## Checksums

SHA-256 checksums are not committed in-repo. Verify downloads through the GitHub release UI or with `gh release download` followed by local checksum generation if needed.
