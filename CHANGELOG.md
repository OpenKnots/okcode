# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.23.0] - 2026-04-13

See [docs/releases/v0.23.0.md](docs/releases/v0.23.0.md) for full notes and [docs/releases/v0.23.0/assets.md](docs/releases/v0.23.0/assets.md) for release asset inventory.

### Added

- Add GitHub Copilot provider support.
- Add language switcher and Openclaw auth proxy.
- Add API auth seamline and minimal Claude proxy.
- Split SME chat list and add auto-scroll handling.
- Add configurable browser preview start page.
- Add provider availability settings and picker filtering.
- Add in-app browser helper for Tweakcn settings.
- Add hotkey settings editor and keybinding reset support.

### Changed

- Extract OpenClaw gateway settings flow.
- Trim PR review history fetch and clean typecheck blockers.
- Stabilize runtime event and config refresh handling.
- Switch SME Chat to direct Anthropic messaging.
- Show recent PR review activity in the dashboard.
- Cache PR lookups and tighten project matching.
- Support Claude auth tokens and OAuth failure handling.
- Split settings into subroutes with shared shell.
- Okcode/auth settings providers.
- Update gateway connect handshake payload.
- Restore default permission mode for chat turns.

### Fixed

- Fix main branch lint and typecheck regressions.
- Resolve PR 432 merge conflicts against current main.
- Resolve PR #395 merge conflicts against main.
- Resolve PR #395 conflicts and integrate pr-365-merge fixes.

## [0.22.1] - 2026-04-10

See [docs/releases/v0.22.1.md](docs/releases/v0.22.1.md) for full notes and [docs/releases/v0.22.1/assets.md](docs/releases/v0.22.1/assets.md) for release asset inventory.

### Added

- Add decision workspace contracts, projections, persistence tables, and WebSocket wiring groundwork.
- Add pending user input projections plus thread overview and detail queries.
- Add sidebar density controls, connection test controls, and expandable notification diagnostics with copy support.
- Add companion pairing contracts and mobile pairing stubs.
- Add stop support for pending git actions and external GitHub link opening from the preview popout.
- Add OpenClaw maintainer workflow skills.

### Changed

- Switch SME Claude flows to Claude Code CLI.
- Extract the OpenClaw gateway client with auth fallback and modernize the gateway handshake flow.
- Refresh theme tokens, default typography, and VS Code icon manifests.
- Preserve thread routes in desktop pop-out windows and widen preview viewport inputs.
- Render SME replies as markdown and replace the draft upload icon with a close action.

### Fixed

- Ignore expected redacted auth shutdown noise in Codex logs.
- Normalize React language ids for syntax highlighting.
- Defer the empty diff guard until after hook setup.
- Restore orchestration snapshot and thread-detail compatibility across shared contracts and WebSocket wiring.
- Backfill the pending user input projection table for already-upgraded state directories.
- Improve OpenClaw gateway handshake diagnostics and connection-stage reporting.
- Isolate CLI test state directories to avoid SQLite lock contention during release validation.
- Tune long user-message timeline height estimation so browser layout stays aligned with validated rendering.

## [0.22.0] - 2026-04-09

See [docs/releases/v0.22.0.md](docs/releases/v0.22.0.md) for full notes and [docs/releases/v0.22.0/assets.md](docs/releases/v0.22.0/assets.md) for release asset inventory.

### Added

- Add provider-aware SME conversation auth with persisted provider and auth method settings.
- Add navigable settings sections and a dedicated SME conversation settings editor.

### Changed

- Refresh SME chat with a modern sidebar, composer, and message layout.
- Restructure settings into section-specific panels with a mobile section picker.
- Route SME conversation sends through provider-specific auth validation and runtime backends.

### Fixed

- Redact secrets from websocket errors across the server, transport, and UI paths.

## [0.21.0] - 2026-04-09

See [docs/releases/v0.21.0.md](docs/releases/v0.21.0.md) for full notes and [docs/releases/v0.21.0/assets.md](docs/releases/v0.21.0/assets.md) for release asset inventory.

### Added

- Add regression coverage for cleanup, connection health, terminal readiness, and native folder picker flows.
- Add terminal runtime environment resolution so thread terminals can start with less startup work.

### Changed

- Centralize desktop renderer URL resolution for packaged and development shells.
- Simplify thread mode controls to code and plan.
- Archive older project threads when project limits are enforced.
- Preserve local draft threads across project switches.
- Reduce terminal session startup latency across the server and web terminal controller flow.
- Collapse the workspace tree vertically when the panel is hidden.
- Polish sidebar project name accent handling.
- Update iOS team metadata, display name wiring, and Info.plist release settings.

### Fixed

- Resolve SME chat Anthropic authentication from persisted environment state.
- Avoid stale SME store closures in the chat shell.

## [0.20.0] - 2026-04-09

See [docs/releases/v0.20.0.md](docs/releases/v0.20.0.md) for full notes and [docs/releases/v0.20.0/assets.md](docs/releases/v0.20.0/assets.md) for release asset inventory.

### Added

- Turn the sidebar footer brand block into a clickable home/status affordance.
- Add OpenClaw gateway auth timeout diagnostics.

### Changed

- Use default tree for new chats and show stash badges.
- Reuse stable empty message array in SME chat.
- Refresh sidebar branding and align package versions.
- Refresh sidebar app footer branding.

## [0.19.0] - 2026-04-08

See [docs/releases/v0.19.0.md](docs/releases/v0.19.0.md) for full notes and [docs/releases/v0.19.0/assets.md](docs/releases/v0.19.0/assets.md) for release asset inventory.

### Changed

- Harden release workflow staging and optional CLI publishing.
- Fix branch-handling issues that could confuse release-related push and PR flows.
- Clear release-preflight blockers around server snapshot decoding and strict type checks.

### Fixed

- Fix formatting drift and release-preflight cleanup issues discovered during rollout.

## [0.18.0] - 2026-04-07

See [docs/releases/v0.18.0.md](docs/releases/v0.18.0.md) for full notes and [docs/releases/v0.18.0/assets.md](docs/releases/v0.18.0/assets.md) for release asset inventory.

### Added

- Add a unified workspace panel to the right sidebar.
- Add bulk delete-all worktree cleanup action.
- Add preview layout modes and pop-out controls.
- Add project sidebar expand-all toggle.
- Add tab snapshot capture for the browser preview.
- Add support for binary project writes.

### Changed

- Make CLI publishing optional in the coordinated release workflow.
- Open diff files in the integrated viewer by default.
- Cache sidebar thread and project lookups for faster navigation.
- Lock the browser preview to the top dock.
- Collapse the workspace tree when binary project writes are shown.
- Move sidebar branding to the footer and drop the chat project badge.
- Clean up chat header panel toggles.

### Fixed

- Reduce preview and diff flicker during active workspace updates.
- Resolve web release warnings before shipping v0.18.0.

## [0.17.0] - 2026-04-07

See [docs/releases/v0.17.0.md](docs/releases/v0.17.0.md) for full notes and [docs/releases/v0.17.0/assets.md](docs/releases/v0.17.0/assets.md) for release asset inventory.

### Added

- Add stale worktree pruning controls in the sidebar.
- Add merged worktree cleanup flow and cleanup dialog.
- Add floating chat widget shell for the mobile layout.
- Add cached syntax highlighting for chat diffs.
- Add copy buttons to assistant responses.
- Add collapsible diff file headers.
- Add PR review workspace helper scripts.
- Add persistent saved layout preferences.

### Changed

- Unify the right panel into tabbed Files, Editor, and Diffs views.
- Open terminal file links directly in the code viewer.
- Show an open-diff action when file summaries are unavailable.
- Import package scripts when creating projects.
- Improve sidebar thread shortcuts, header spacing, controls, and project-header contrast.
- Remove sidebar blur and side-panel hint text from code viewers.
- Tighten preview blocking so empty toast overlays do not hide the browser preview.
- Shorten chat shortcut guide titles.
- Add PR request-changes tone setting support.
- Prevent the review pane from scrolling independently.
- Streamline thread UI and desktop build packaging.

### Fixed

- Fix theme hydration and terminal and file navigation stability.
- Fix desktop release packaging regressions before ship.

## [0.16.1] - 2026-04-06

See [docs/releases/v0.16.1.md](docs/releases/v0.16.1.md) for full notes and [docs/releases/v0.16.1/assets.md](docs/releases/v0.16.1/assets.md) for release asset inventory.

### Added

- Add sidebar thread shortcuts and refresh toolchain deps.
- Add pull request shortcut and header action.
- Add per-file diff acceptance controls.
- Add GitHub issue thread integration.
- Add screenshot selection overlay and shortcut.
- Add pinned preview tabs.
- Add configurable code font size override.
- Add architecture diagram generation skill.

### Changed

- Format workflow files.
- Prepare release notes for v0.16.1.
- Build web bundle before CLI publish.
- Format release workflow.
- Skip TestFlight when iOS signing secrets are missing.
- Align header content in Electron window.
- Orchestration: include github ref in thread snapshots.
- Orchestration: include github ref in thread snapshots.
- Polish save button state styling.
- Show saved confirmation on manual file saves.
- Filter diffs by file change type.
- Clamp persisted custom preview viewports.
- Simplify the sidebar workspace list.
- Tighten outline button contrast.
- Make prompt enhancements visible and reversible.
- Merge pull request #296 from OpenKnots/copilot/fix-status-details-platform-error.
- Merge pull request #294 from OpenKnots/copilot/remove-signing-requirement.
- Make Windows signing optional in release workflow.
- Merge pull request #293 from OpenKnots/fix/optional-ios-testflight.

### Fixed

- Release: fix prep formatting and trim ci.
- Web: fix formatting drift on main.
- Handle missing workspace path in GitCore.statusDetails() without throwing PlatformError.

### Removed

- Drop: gates, fix: stale PRs, add: pr-review.

## [0.16.0] - 2026-04-05

See [docs/releases/v0.16.0.md](docs/releases/v0.16.0.md) for full notes and [docs/releases/v0.16.0/assets.md](docs/releases/v0.16.0/assets.md) for release asset inventory.

### Added

- Add right-panel turn diff viewer.
- Add editable code preview state and autosave support.
- Add hidden provider input for prompt enhancements.
- Add viewport presets and orientation controls.
- Add optional rebase before commit flow.
- Add GitHub repo cloning entry points.
- Add build metadata across server and web.

### Changed

- Refine diff viewer panel defaults and opening behavior.
- Standardize modal button styling.
- Restart provider sessions when worktree cwd changes.
- Stabilize release train and split Intel compatibility build.
- Preserve prompt enhancement when sending messages.
- Stabilize browser test runner and related types.
- Refresh tracked worktree bases before creation.
- Expose reasoning content in the work log.
- Refactor home empty state into focused components.

### Fixed

- Fix branch sync to use explicit upstream refs.
- Fix post-merge lint warnings.
- Sanitize shell env before launching agent sessions.

### Removed

- Remove diff preview panel.

## [0.15.0] - 2026-04-05

See [docs/releases/v0.15.0.md](docs/releases/v0.15.0.md) for full notes and [docs/releases/v0.15.0/assets.md](docs/releases/v0.15.0/assets.md) for release asset inventory.

### Added

- Redesign the chat home empty state with recent activity.
- Add animated marketing background and deepen dark theme.
- Add rebase-aware branch sync handling.

### Changed

- Centralize brand constants in @okcode/shared/brand and unify OK Code brand identity across the codebase.
- Scope preview tabs and preview state by project thread.
- Scope background image into app settings.
- Always use wide thread names in the sidebar.
- Refine stitch border with subtle 3D depth.
- Wrap menu sections and PR dropdown actions in MenuGroup.
- Measure composer footer content before compacting.
- Skip CI jobs when unrelated files change.

### Removed

- Remove window opacity setting.

## [0.14.0] - 2026-04-04

See [docs/releases/v0.14.0.md](docs/releases/v0.14.0.md) for full notes and [docs/releases/v0.14.0/assets.md](docs/releases/v0.14.0/assets.md) for release asset inventory.

### Added

- Render inline diffs in chat work entries.
- Add prompt enhancement menu to chat composer.
- Auto-refresh file tree on filesystem changes.
- Show PR status for threads with linked branches.
- Propagate project runtime env to git and provider actions.
- Always show recommended next action label on git button.
- Use distinct git icons for PR states in sidebar threads.

### Changed

- CLI npm package name is `okcodes`. Install with `npm install -g okcodes`; the `okcode` binary name is unchanged.
- Switch mobile pairing to link-based flow, replacing QR code pairing.
- Prompt to pull behind branches before starting threads.
- Make stitch border more discrete and add toggle to settings.
- Constrain skills page overflow.

### Fixed

- Render diff content directly to fix empty diffs panel.
- Update Cotton Candy theme to pure pink and blue, remove purple tones.

### Removed

- Remove telemetry plumbing from server and marketing.
- Remove QR-based mobile pairing settings.
- Remove favorites sidebar feature.

## [0.13.0] - 2026-04-04

See [docs/releases/v0.13.0.md](docs/releases/v0.13.0.md) for full notes and [docs/releases/v0.13.0/assets.md](docs/releases/v0.13.0/assets.md) for release asset inventory.

### Fixed

- Blur `.env` file contents in code viewer.

## [0.10.0] - 2026-04-04

See [docs/releases/v0.10.0.md](docs/releases/v0.10.0.md) for full notes and [docs/releases/v0.10.0/assets.md](docs/releases/v0.10.0/assets.md) for release asset inventory.

### Added

- Add iOS TestFlight release workflow.
- Add iOS TestFlight release workflow.
- Add project rename editing and name disambiguation.
- Add custom background image settings.
- Add animated stitch border overlay.
- Add reviewed-file tracking to PR review UI.
- Add local notifications to iOS package dependencies.
- Add squircle branding assets for desktop and web.

### Changed

- Merge pull request #224 from OpenKnots/fix/release-readme-table.
- Merge pull request #223 from OpenKnots/feature/release-ios-testflight.
- Support bare theme names in custom theme import.
- Remount file tree when project thread changes.
- Show sidebar trigger when sidebar is collapsed.
- Handle missing bundled skills catalog more gracefully.
- Prune completed plan documents.
- Use direct message lookup for streaming projections.

### Fixed

- Handle missing release index table gracefully.

## [0.0.13] - 2026-04-01

See [docs/releases/v0.0.13.md](docs/releases/v0.0.13.md) for full notes.

### Added

- Push notifications for approval requests, user-input requests, turn completions, and session errors on mobile.
- QR code pairing flow: desktop shows scannable QR, mobile supports clipboard paste and auto-pair.
- Token rotation and revocation model with short-lived pairing tokens.
- Connection state banner for mobile companion (connecting, reconnecting, disconnected).
- Android `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM` permissions.
- iOS `UIBackgroundModes` for background processing.
- Capacitor `LocalNotifications` plugin configuration.
- `GET /api/pairing` HTTP endpoint for short-lived pairing link generation.
- WebSocket methods: `server.generatePairingLink`, `server.rotateToken`, `server.revokeToken`, `server.listTokens`.

## [0.0.12] - 2026-04-01

See [docs/releases/v0.0.12.md](docs/releases/v0.0.12.md) for full notes and [docs/releases/v0.0.12/assets.md](docs/releases/v0.0.12/assets.md) for release asset inventory.

### Fixed

- Resolve Footer import casing for typecheck.

## [0.0.12] - 2026-04-01

See [docs/releases/v0.0.12.md](docs/releases/v0.0.12.md) for full notes and [docs/releases/v0.0.12/assets.md](docs/releases/v0.0.12/assets.md) for release asset inventory.

### Fixed

- Resolve Footer import casing for typecheck.

## [0.0.11] - 2026-04-01

See [docs/releases/v0.0.11.md](docs/releases/v0.0.11.md) for full notes and [docs/releases/v0.0.11/assets.md](docs/releases/v0.0.11/assets.md) for release asset inventory.

### Changed

- Keep format enforcement out of release preflight.
- Format web git action components.

## [0.0.11] - 2026-04-01

See [docs/releases/v0.0.11.md](docs/releases/v0.0.11.md) for full notes and [docs/releases/v0.0.11/assets.md](docs/releases/v0.0.11/assets.md) for release asset inventory.

### Changed

- Keep format enforcement out of release preflight.
- Format web git action components.

## [0.0.11] - 2026-04-01

See [docs/releases/v0.0.11.md](docs/releases/v0.0.11.md) for full notes and [docs/releases/v0.0.11/assets.md](docs/releases/v0.0.11/assets.md) for release asset inventory.

### Changed

- Keep format enforcement out of release preflight.
- Format web git action components.

## [0.0.10] - 2026-04-01

See [docs/releases/v0.0.10.md](docs/releases/v0.0.10.md) for full notes and [docs/releases/v0.0.10/assets.md](docs/releases/v0.0.10/assets.md) for release asset inventory.

### Added

- [codex] Add file tree context actions.
- [codex] Add accept-all diff review action.

### Changed

- Replace File View sidebar link with Skills page.
- Redesign marketing site with product-aligned landing page.
- Unify git action flows and reduce sticky thread errors.
- [codex] Use Carbon as default theme.
- Redesign marketing site.
- Replace marketing site with Next starter and refresh home placeholders.
- Polish skill detail dialog layout.
- Polish skill detail dialog and update Discord link.

### Fixed

- Fix marketing Vercel build script resolution.
- Fix marketing Vercel output config.
- Fix diff panel scrolling and polish skill dialogs.

### Removed

- Remove YouTube player.
- [codex] remove midnight clarity theme.

## [0.0.9] - 2026-04-01

See [docs/releases/v0.0.9.md](docs/releases/v0.0.9.md) for full notes and [docs/releases/v0.0.9/assets.md](docs/releases/v0.0.9/assets.md) for release asset inventory.

### Added

- Add accent background override for project headers.

### Changed

- Refresh the marketing hero with layered glow effects.
- Polish the skill detail dialog layout.
- Update Turbo schema URLs to v2.9.3.

### Fixed

- Fix YouTube player volume and custom URL handling.
- Restore patch-only diff review state.
- Raise toast notifications above the app chrome.
- Hide visible merge conflict markers in PR review.

### Removed

- Remove the project quick-new thread sidebar button.

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
- Add private local maintainer profiles for PR Review so OK Code can load external maintainer workflows without committing `.okcode/` files to the target repo.

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
[0.0.9]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.9
[0.0.10]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.10
[0.0.11]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.11
[0.0.11]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.11
[0.0.11]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.11
[0.0.12]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.12
[0.0.12]: https://github.com/OpenKnots/okcode/releases/tag/v0.0.12
[0.10.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.10.0
[0.14.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.14.0
[0.13.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.13.0
[0.16.1]: https://github.com/OpenKnots/okcode/releases/tag/v0.16.1
[0.17.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.17.0
[0.18.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.18.0
[0.20.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.20.0
[0.21.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.21.0
[0.22.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.22.0
[0.22.1]: https://github.com/OpenKnots/okcode/releases/tag/v0.22.1
[0.23.0]: https://github.com/OpenKnots/okcode/releases/tag/v0.23.0
