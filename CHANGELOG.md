# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.2]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.2
[0.0.1]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.1
