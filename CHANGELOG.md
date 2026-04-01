# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- CLI npm package name is `okcodes`. Install with `npm install -g okcodes`; the `okcode` binary name is unchanged.

## [0.0.8] - 2026-03-31

See [docs/releases/v0.0.8.md](docs/releases/v0.0.8.md) for full notes and [docs/releases/v0.0.8/assets.md](docs/releases/v0.0.8/assets.md) for release asset inventory.

### Added

- Add skills library, install flow, and management UI.
- Add skills UX improvements and session hardening around the skills workflow.
- Add text file attachments to chat turns.
- Add app locale loading and the intl provider.
- Add full-context diff viewing for both file-scoped and per-file comparisons.
- Add inline thread renaming with draft title persistence.
- Add file attachment context handling.
- Add project quick-new thread button.
- Add PR number input support with repository auto-match.
- Add interactive plan feedback in the sidebar.
- Add sidebar accent and thread width settings.

### Changed

- Refresh the OK Code marketing site.
- Improve raw patch rendering.
- Allow toggling the code viewer without clearing open tabs.
- Clear stale worktree paths before starting sessions.

### Fixed

- Fix dev runner entrypoint detection for desktop builds.
- Fix YouTube player embed layout.

## [0.0.7] - 2026-03-31

See [docs/releases/v0.0.7.md](docs/releases/v0.0.7.md) for full notes and [docs/releases/v0.0.7/assets.md](docs/releases/v0.0.7/assets.md) for release asset inventory.

### Added

- Add a command palette for project and thread switching.
- Add GitHub clone flow from repository URLs.
- Add checklist views for proposed plans.
- Add browser viewport presets to the preview panel.
- Add skill CRUD and slash-command support.
- Add `rec` command option mapping for review replies.

### Changed

- Refresh UI fonts and theme presets.
- Improve PR panel accessibility and keyboard shortcuts.
- Reorganize conflict intake UI and expandable summaries.
- Fallback to available git branches when creating new worktrees.
- Collapse consecutive work entries in the timeline.
- Polish sidebar project add-row styling and workspace search filters.

### Fixed

- Harden selection highlight styling for accessibility and contrast compatibility.

### Removed

- None.

## [0.0.6] - 2026-03-28

See [docs/releases/v0.0.6.md](docs/releases/v0.0.6.md) for full notes and [docs/releases/v0.0.6/assets.md](docs/releases/v0.0.6/assets.md) for release asset inventory.

### Added

- Add PR-specific actions to the git menu.
- Add preview navigation, favorites, and encrypted environment persistence.
- Add workspace search filters and CamelCase ranking.
- Add YouTube player drawer with playlist slots.

### Changed

- Rework the OK Code landing page and simplify workspace search.
- Redesign the plan sidebar and follow-up banner.
- Restructure the PR review workspace layout.
- Improve merge conflict guidance and error UX.
- Require mac signing/notarization secrets during release builds.

### Fixed

- Harden git status fallback handling.
- Fix right-panel exclusivity with preview open.
- Resolve the encrypted env var merge-conflict path for current mainline.

### Removed

- Remove alpha branding from production surfaces.
- Remove unsupported Spotify volume slider.

## [0.0.5] - 2026-03-28

See [docs/releases/v0.0.5.md](docs/releases/v0.0.5.md) for full notes and [docs/releases/v0.0.5/assets.md](docs/releases/v0.0.5/assets.md) for release asset inventory.

### Added

- Add mobile companion shell and deep-link pairing.
- Add branch sync action to git controls.
- Add merge conflict workflow and navigation.
- Add structured Git action failures and retry UI.
- Add PR review filters and scoped workspace.
- Add PR review features and conflict resolution.
- Send terminal selections directly from the composer.
- Open chat file links in the viewer or editor.
- Add package script defaults and import flow.
- Add viewport-aware preview bounds projection.
- Add markdown preview rendering.

### Changed

- Update dependencies and enhance UI components.
- Enhance release workflow and update asset documentation for v0.0.4.

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

[0.0.4]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.4
[0.0.3]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.3
[0.0.2]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.2
[0.0.1]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.1
[0.0.7]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.7
[0.0.5]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.5
[0.0.6]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.6
[0.0.8]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.8
