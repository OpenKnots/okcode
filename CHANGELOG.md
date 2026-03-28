# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- CLI npm package name is `okcodes`. Install with `npm install -g okcodes`; the `okcode` binary name is unchanged.

## [0.0.4] - 2026-03-27

See [docs/releases/v0.0.4.md](docs/releases/v0.0.4.md) for full notes and [docs/releases/v0.0.4/assets.md](docs/releases/v0.0.4/assets.md) for release asset inventory.

### Added

- Add PR review views and pull request listing.
- Add release preparation workflow script.
- Add Ctrl+` terminal toggle shortcut.
- Add opacity controls for window and sidebar.
- Add draft voice mode implementation plan.
- Add minimized Spotify player with persistent volume controls.
- Add collapse toggle for project file tree.
- Add skills system plan document.
- Add signed DMG build scripts for macOS in package.json.
- Add okcodes package and update package.json with new scripts and dependencies.
- Add actionable home empty state.

### Changed

- Enhance preview bounds handling in DesktopPreviewController and PreviewPanel.
- Default to macOS arm64 artifacts.
- Update release notes with signed DMG build commands for macOS.
- Update package versions and configurations across the monorepo.
- Rename CLI package from `okcode` to `okcodes` and update related documentation.

### Removed

- Remove CLI publishing from release workflow and update documentation.

## [0.0.4] - 2026-03-27

See [docs/releases/v0.0.4.md](docs/releases/v0.0.4.md) for full notes and [docs/releases/v0.0.4/assets.md](docs/releases/v0.0.4/assets.md) for release asset inventory.

### Added

- Add PR review views and pull request listing.
- Add release preparation workflow script.
- Add Ctrl+` terminal toggle shortcut.
- Add opacity controls for window and sidebar.
- Add draft voice mode implementation plan.
- Add minimized Spotify player with persistent volume controls.
- Add collapse toggle for project file tree.
- Add skills system plan document.
- Add signed DMG build scripts for macOS in package.json.
- Add okcodes package and update package.json with new scripts and dependencies.
- Add actionable home empty state.

### Changed

- Enhance preview bounds handling in DesktopPreviewController and PreviewPanel.
- Default to macOS arm64 artifacts.
- Update release notes with signed DMG build commands for macOS.
- Update package versions and configurations across the monorepo.
- Rename CLI package from `okcode` to `okcodes` and update related documentation.

### Removed

- Remove CLI publishing from release workflow and update documentation.

## [0.0.3] - 2026-03-27

See [docs/releases/v0.0.3.md](docs/releases/v0.0.3.md) for full notes and [docs/releases/v0.0.3/assets.md](docs/releases/v0.0.3/assets.md) for release asset inventory.

### Added

- Onboarding tour with default worktree mode for new threads; provider onboarding and doctor diagnostics.
- Full-page code viewer with context mentions for workspace files.
- Chat PR review route and component.
- Terminal URLs can open in the preview panel or external browser.
- Spotify player drawer integration in the web UI.
- User message queuing while an agent turn is running.
- Resizable plan sidebar.
- Theme concepts documentation and branding/design-system reference.

### Changed

- Sidebar navigation refactored for cleaner routing logic.
- Project sidebar spacing tightened; message IDs improved.
- Release runbook expanded with workflow details.
- Pre-commit setup enhanced; branding documentation refactored.
- Discord link updated in README.

### Fixed

- Stop forwarding menu coordinates to the desktop bridge, fixing context-menu placement issues.

## [0.0.2] - 2026-03-27

See [docs/releases/v0.0.2.md](docs/releases/v0.0.2.md) for full notes and [docs/releases/v0.0.2/assets.md](docs/releases/v0.0.2/assets.md) for release asset inventory.

### Added

- OpenClaw provider; built-in workspace file code viewer; image attachments in chat composer.
- Git merge-conflict handling in Git actions, conflict submenu, and diff panel improvements.
- Per-turn and per-file diff collapse (new diff files default collapsed); full-width chat layout.
- CI: dependency audit workflow; PR validation for release docs when `CHANGELOG.md` or `docs/releases/**` change.

### Changed

- Marketing page and chat UI polish; CodeMirror viewer styling; chat models grouped by provider; single-thread project open behavior.
- Release runbook and workflow documentation updates.

## [0.0.1] - 2026-03-27

First public version tag. See [docs/releases/v0.0.1.md](docs/releases/v0.0.1.md) for full notes and [docs/releases/v0.0.1/assets.md](docs/releases/v0.0.1/assets.md) for release asset inventory.

### Added

- Initial tagged release of the OK Code monorepo (web UI, WebSocket server, desktop app, shared contracts).
- Published CLI npm package `okcode` aligned with this version (see `apps/server`).
- Desktop installers and update metadata published via GitHub Releases when CI runs for tag `v0.0.1`.

[0.0.3]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.3
[0.0.2]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.2
[0.0.1]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.1
[0.0.4]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.4
[0.0.4]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.4
