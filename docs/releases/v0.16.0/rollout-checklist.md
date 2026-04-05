# v0.16.0 Rollout Checklist

Step-by-step playbook for the v0.16.0 release. Each phase must complete before advancing to the next.

## Phase 0: Pre-flight (before tagging)

- [ ] Verify all package versions are `0.16.0`:
  - `apps/server/package.json`
  - `apps/desktop/package.json`
  - `apps/web/package.json`
  - `apps/mobile/package.json`
  - `packages/contracts/package.json`
- [ ] Verify iOS `MARKETING_VERSION` matches in `project.pbxproj`.
- [ ] Confirm `CHANGELOG.md` has `## [0.16.0] - 2026-04-05` entry.
- [ ] Confirm `docs/releases/v0.16.0.md` exists with Summary, Highlights, Upgrade sections.
- [ ] Confirm `docs/releases/v0.16.0/assets.md` exists with all artifact tables.
- [ ] Confirm `docs/releases/README.md` includes v0.16.0 row.
- [ ] Run the pre-release validator:
  ```bash
  node scripts/pre-release-validate.ts 0.16.0
  ```
- [ ] Confirm the working tree is clean (`git status --porcelain` is empty).
- [ ] Confirm you are on the `main` branch.

### Secrets verification

- [ ] Apple signing certificate (`CSC_LINK`, `CSC_KEY_PASSWORD`) is current and not expired.
- [ ] Apple notarization API key (`APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`) is valid.
- [ ] Windows Azure Trusted Signing secrets are configured:
  - `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`
  - `AZURE_TRUSTED_SIGNING_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
  - `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`, `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`
- [ ] iOS signing (`IOS_CERTIFICATE_P12`, `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE`) is valid.
- [ ] `NODE_AUTH_TOKEN` (npm) is active.
- [ ] `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` (GitHub App for finalize) are set.

### Quality gates

All seven gates must pass with zero warnings:

- [ ] `bun run fmt:check`
- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run --cwd apps/web test:browser`
- [ ] `bun run test:desktop-smoke`
- [ ] `bun run release:smoke`

## Phase 1: Cut the RC

- [ ] Run the release preparation script:
  ```bash
  node scripts/prepare-release.ts 0.16.0-rc.1 \
    --full-matrix \
    --summary "Right-panel diff review, editable code previews, stronger branch handling, and a more stable release train"
  ```
- [ ] Verify the `v0.16.0-rc.1` tag was created and pushed.
- [ ] Verify `release.yml` workflow was triggered:
  - Actions URL: https://github.com/OpenKnots/okcode/actions/workflows/release.yml
- [ ] Monitor the six-job pipeline:
  1. `Preflight` — quality gates
  2. `Desktop macOS arm64` — signed/notarized DMG
  3. `Desktop Linux x64` — AppImage
  4. `Desktop Windows x64` — signed NSIS installer
  5. `iOS TestFlight` — archive and upload
  6. `Publish CLI` — npm publish with `next` tag
  7. `Publish GitHub Release` — prerelease with all artifacts
  8. `Finalize` — version bump commit to main

### Artifact verification (RC)

- [ ] macOS arm64: Download DMG, verify Gatekeeper opens it without warning.
- [ ] Linux x64: Download AppImage, verify it launches.
- [ ] Windows x64: Download installer, verify it installs and launches.
- [ ] CLI: `npx okcodes@0.16.0-rc.1 --version` returns `0.16.0-rc.1`.
- [ ] CLI: `npx okcodes@0.16.0-rc.1 --help` renders help text.
- [ ] CLI: `npx okcodes@0.16.0-rc.1 doctor --help` renders doctor help.
- [ ] iOS: TestFlight build appears in App Store Connect within 30 minutes.
- [ ] GitHub Release: Prerelease flag is set, "latest" flag is not set.
- [ ] GitHub Release: All expected artifacts are attached (DMGs, AppImage, EXE, YMLs, blockmaps, docs).

## Phase 2: RC Soak (48 hours)

Start: \_**\_-**-**T**:**Z
End: \_\_**-**-**T**:**Z

### Soak exit criteria

- [ ] No Sev-1 or Sev-2 issues filed during soak period.
- [ ] No crash-on-launch on macOS arm64, Windows x64, or Linux x64.
- [ ] Updater verification: Install v0.15.0 desktop app, verify it detects and applies the v0.16.0-rc.1 update.
- [ ] TestFlight install succeeds on at least one device.
- [ ] `npx okcodes@0.16.0-rc.1 --version` still works at end of soak.

### Feature-specific soak testing (v0.16.0)

These checks validate the high-risk surface area introduced in this release:

- [ ] **Right-panel diff viewer**: Open a thread with file changes, verify diffs render in the right panel. Toggle between files. Verify panel defaults and opening behavior.
- [ ] **Editable code preview**: Open a code preview, make edits, verify autosave persists. Reload the app, verify edits survived.
- [ ] **Rebase-before-commit flow**: Create a branch that has diverged from main. Trigger commit with rebase enabled. Verify conflicts are surfaced if they exist. Verify clean rebase completes.
- [ ] **GitHub repo cloning**: Clone a public repo via the entry point. Clone a private repo (verify auth flow). Verify the cloned repo opens in a thread.
- [ ] **Provider session restart on CWD change**: Start a session, then switch the active worktree. Verify the provider session restarts cleanly without user intervention.
- [ ] **Shell env sanitization**: Set unusual environment variables (e.g., modified `PATH`, `NODE_OPTIONS`). Launch an agent session. Verify the session starts without inheriting unsafe env.
- [ ] **Build metadata**: Verify the web UI displays the correct build version and commit hash. Verify the server reports matching metadata.

### iOS TestFlight device checks

Run on two devices: one current-generation and one older-generation supported device.

Device 1: **\*\***\_\_**\*\*** (iOS **.**)
Device 2: **\*\***\_\_**\*\*** (iOS **.**)

- [ ] Pair the mobile companion with a desktop/server instance.
- [ ] Restore a previously saved pairing.
- [ ] Open a thread and send a follow-up message.
- [ ] Approve an action and answer a user-input request.
- [ ] Background the app, wait 30 seconds, foreground it.
- [ ] Receive a notification and tap it to return to the thread.

### If soak fails

If any blocker is found during the soak period:

1. Fix the issue on `main`.
2. Cut `v0.16.0-rc.2` with the fix included.
3. Restart the 48-hour soak from the beginning.
4. Do NOT promote a failed RC to stable.

## Phase 3: Promote to Stable

Only after the 48-hour soak completes with all exit criteria met.

- [ ] Verify the RC commit is the same commit that will be promoted (no new commits needed).
- [ ] Run the promotion:
  ```bash
  node scripts/prepare-release.ts 0.16.0 \
    --full-matrix \
    --summary "Right-panel diff review, editable code previews, stronger branch handling, and a more stable release train"
  ```
- [ ] Verify the `v0.16.0` tag was created on the same commit as `v0.16.0-rc.1`.
- [ ] Monitor all six workflow jobs to completion.

### Artifact verification (stable)

- [ ] macOS arm64 DMG: Launches, Gatekeeper passes.
- [ ] Linux x64 AppImage: Launches.
- [ ] Windows x64 installer: Installs and launches.
- [ ] CLI: `npm install -g okcodes@0.16.0` succeeds.
- [ ] CLI: `okcodes --version` returns `0.16.0`.
- [ ] iOS: New TestFlight build appears.
- [ ] GitHub Release: "latest" flag is set, prerelease flag is not set.
- [ ] GitHub Release: Release notes body matches `docs/releases/v0.16.0.md`.
- [ ] Updater: v0.15.0 desktop app detects and applies the v0.16.0 stable update.

## Phase 4: Post-release

- [ ] Verify `finalize` job pushed version bump commit to `main`.
- [ ] Verify `main` branch has `chore(release): prepare v0.16.0` commit.
- [ ] Trigger Intel compatibility build (optional, non-blocking):
  ```bash
  gh workflow run release-intel-compat.yml -f version=0.16.0
  ```
- [ ] Update any external documentation or announcements referencing the new version.
- [ ] Close any GitHub issues resolved by this release.
- [ ] Monitor error reporting and community channels for 24 hours post-release.

## Timeline

| Phase                   | Duration | Starts after              |
| ----------------------- | -------- | ------------------------- |
| Pre-flight              | ~30 min  | Decision to release       |
| Cut RC                  | ~45 min  | Pre-flight passes         |
| RC Soak                 | 48 hours | All RC artifacts verified |
| Promote to stable       | ~45 min  | Soak exit criteria met    |
| Post-release monitoring | 24 hours | Stable artifacts verified |

Total time from decision to stable: ~3 days minimum.
