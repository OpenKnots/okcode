# v0.24.0 Rollout Checklist

Step-by-step playbook for the v0.24.0 release. Each phase must complete before advancing.

## Phase 0: Pre-flight

- [ ] Verify all release package versions are `0.24.0`:
  - `apps/server/package.json`
  - `apps/desktop/package.json`
  - `apps/web/package.json`
  - `apps/mobile/package.json`
  - `packages/contracts/package.json`
- [ ] Verify Android `versionName` and iOS `MARKETING_VERSION` both match `0.24.0`.
- [ ] Confirm `CHANGELOG.md` has `## [0.24.0] - 2026-04-14`.
- [ ] Confirm `docs/releases/v0.24.0.md` exists with Summary, Highlights, Upgrade and install, and Release operations sections.
- [ ] Confirm `docs/releases/v0.24.0/assets.md` exists and lists every expected attachment class.
- [ ] Confirm `docs/releases/v0.24.0/rollout-checklist.md` and `docs/releases/v0.24.0/soak-test-plan.md` exist.
- [ ] Confirm `docs/releases/README.md` includes the v0.24.0 row.
- [ ] Run `bun run release:validate 0.24.0`.
- [ ] Confirm the working tree is clean.
- [ ] Confirm you are on `main`.

### Quality gates

- [ ] `bun run fmt:check`
- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run --cwd apps/web test:browser`
- [ ] `bun run test:desktop-smoke`
- [ ] `bun run release:smoke`

## Phase 1: Publish

- [ ] Push the release-prep commit to `main`.
- [ ] Create and push tag `v0.24.0`.
- [ ] Verify the coordinated `release.yml` workflow starts.
- [ ] Monitor the pipeline through Preflight, Desktop builds, iOS signing preflight, optional iOS TestFlight, Publish GitHub Release, Finalize release, and optional CLI publish if started through manual dispatch.

### Asset verification

- [ ] GitHub Release body matches `docs/releases/v0.24.0.md`.
- [ ] `okcode-CHANGELOG.md` is attached.
- [ ] `okcode-RELEASE-NOTES.md` is attached.
- [ ] `okcode-ASSETS-MANIFEST.md` is attached.
- [ ] macOS release artifacts are attached: DMG, ZIP, updater manifest, and blockmaps.
- [ ] Linux release artifacts are attached: AppImage and updater manifest if generated.
- [ ] Windows release artifacts are attached: installer, updater manifest, and blockmaps.
- [ ] If the Intel compatibility workflow is run, confirm the x64 macOS DMG is attached separately.

## Phase 2: Post-release verification

- [ ] `npx --yes okcodes@0.24.0 --version` returns `0.24.0`.
- [ ] macOS installer launches and passes Gatekeeper.
- [ ] Linux AppImage launches.
- [ ] Windows installer installs and launches.
- [ ] Desktop auto-update metadata is present for supported platforms.
- [ ] If iOS signing was enabled, confirm the new TestFlight build appears.
- [ ] Confirm the finalize job did not need to push another version-alignment commit, or review its no-op output if versions were already aligned before tagging.

## Phase 3: Follow-through

- [ ] Trigger the Intel compatibility workflow if macOS x64 artifacts are required for this train.
- [ ] Update external release references or announcements.
- [ ] Monitor reports for regressions in provider onboarding, auth flows, release packaging, and cross-platform install/update behavior.
