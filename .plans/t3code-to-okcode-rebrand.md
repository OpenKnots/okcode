# T3Code → OKCode Rebrand Checklist

This document tracked conversions from T3Code to OKCode. **Status: completed** (March 2026). Items below are checked off; legacy migration hooks are listed at the end.

## 1. Package Names (@t3tools → @okcode)

### Root package.json

- [x] `@t3tools/monorepo` → `@okcode/monorepo`

### apps/server/package.json

- [x] `@t3tools/contracts` → `@okcode/contracts`
- [x] `@t3tools/shared` → `@okcode/shared`
- [x] `@t3tools/web` → `@okcode/web`

### apps/web/package.json

- [x] `@t3tools/contracts` → `@okcode/contracts`
- [x] `@t3tools/shared` → `@okcode/shared`

### packages/contracts/package.json

- [x] `@t3tools/contracts` (name only)

### packages/shared/package.json

- [x] `@t3tools/shared` (name only)
- [x] `@t3tools/contracts` → `@okcode/contracts`

### scripts/package.json

- [x] `@t3tools/scripts` (name only)
- [x] `@t3tools/contracts` → `@okcode/contracts`
- [x] `@t3tools/shared` → `@okcode/shared`

### Import statements (all .ts/.tsx files)

- [x] `from "@t3tools/contracts"` → `from "@okcode/contracts"`
- [x] `from "@t3tools/shared/..."` → `from "@okcode/shared/..."`

### vitest.config.ts

- [x] `/^@t3tools\/contracts$/` → `/^@okcode\/contracts$/`

### turbo.json

- [x] `"@t3tools/contracts#build"` → `"@okcode/contracts#build"`
- [x] `"--filter=@t3tools/..."` → `"--filter=@okcode/..."`
- [x] `"--filter=t3"` → `"--filter=okcode"` (CLI package filter)

## 2. Package Bin Name

### apps/server/package.json

- [x] `"t3"` bin → `"okcode"`

## 3. Environment Variables (T3CODE_* → OKCODE_*)

### turbo.json globalEnv

- [x] `T3CODE_LOG_WS_EVENTS` → `OKCODE_LOG_WS_EVENTS`
- [x] `T3CODE_MODE` → `OKCODE_MODE`
- [x] `T3CODE_PORT` → `OKCODE_PORT`
- [x] `T3CODE_NO_BROWSER` → `OKCODE_NO_BROWSER`
- [x] `T3CODE_HOME` → `OKCODE_HOME`
- [x] `T3CODE_AUTH_TOKEN` → `OKCODE_AUTH_TOKEN`
- [x] `T3CODE_DESKTOP_WS_URL` → `OKCODE_DESKTOP_WS_URL`

### scripts/dev-runner.ts

- [x] All `T3CODE_*` env vars → `OKCODE_*`
- [x] All config names (T3CODE_PORT_OFFSET, T3CODE_DEV_INSTANCE, etc.)
- [x] `DEFAULT_T3_HOME` constant → `DEFAULT_OKCODE_HOME`
- [x] `homedir(), ".t3"` → `homedir(), ".okcode"`

### scripts/dev-runner.test.ts

- [x] All test references to `T3CODE_*` env vars → `OKCODE_*`
- [x] `"~/.t3"` → `"~/.okcode"`

## 4. Documentation Files

### README.md

- [x] "T3 Code" → "OK Code"
- [x] `npx t3` → `npx okcode`
- [x] `github.com/pingdotgg/t3code` → `github.com/OpenKnots/okcode`

### REMOTE.md

- [x] "T3 Code" → "OK Code"
- [x] `T3CODE_*` env vars → `OKCODE_*`
- [x] CLI flag descriptions updated

### KEYBINDINGS.md

- [x] `~/.t3/keybindings.json` → `~/.okcode/keybindings.json`

### CONTRIBUTING.md

- [x] No references (verify none)

### AGENTS.md

- [x] "T3 Code" → "OK Code"
- [x] `@t3tools/shared/...` → `@okcode/shared/...`

### docs/release.md

- [x] `t3` package references → `okcode`
- [x] `T3CODE_DESKTOP_UPDATE_REPOSITORY` → `OKCODE_DESKTOP_UPDATE_REPOSITORY`
- [x] `T3CODE_DESKTOP_UPDATE_GITHUB_TOKEN` → `OKCODE_DESKTOP_UPDATE_GITHUB_TOKEN`

### .docs/*.md files

- [x] .docs/architecture.md: "T3 Code" → "OK Code"
- [x] .docs/quick-start.md: "npx t3" → "npx okcode", `T3CODE_*` → `OKCODE_*`
- [x] .docs/provider-architecture.md: `@t3tools/contracts` → `@okcode/contracts`
- [x] .docs/workspace-layout.md: `@t3tools/shared/...` → `@okcode/shared/...`
- [x] .docs/scripts.md: `T3CODE_*` → `OKCODE_*`; backend name `t3` → `okcode`
- [x] .docs/encyclopedia.md: "T3 Code" → "OK Code"

### .github/workflows/*.yml

- [x] release.yml: `--filter=t3` → `--filter=okcode`, `T3 Code` → `OK Code`

## 5. Storage Keys (t3code:* → okcode:*)

### apps/web/src/store.ts

- [x] `"t3code:renderer-state:..."` → `"okcode:renderer-state:..."`

### apps/web/src/terminalStateStore.ts

- [x] `"t3code:terminal-state:..."` → `"okcode:terminal-state:..."`

### apps/web/src/hooks/useTheme.ts

- [x] `"t3code:theme"` → `"okcode:theme"`

### apps/web/src/hooks/useLocalStorage.ts

- [x] `"t3code:local_storage_change"` → `"okcode:local_storage_change"`

### apps/web/src/editorPreferences.ts

- [x] `"t3code:last-editor"` → `"okcode:last-editor"`

### apps/web/src/composerDraftStore.ts

- [x] `"t3code:composer-drafts:..."` → `"okcode:composer-drafts:..."`

### apps/web/src/appSettings.ts

- [x] `"t3code:app-settings:..."` → `"okcode:app-settings:..."`

### apps/web/src/components/ChatView.logic.ts

- [x] `"t3code:last-invoked-script-by-project"` → `"okcode:last-invoked-script-by-project"`

## 6. Config Files (.t3code* → .okcode*)

### apps/web/src/components/KeybindingsToast.browser.tsx

- [x] `"/repo/project/.t3code-keybindings.json"` → `"/repo/project/.okcode-keybindings.json"`

### apps/web/src/components/ChatView.browser.tsx

- [x] `"/repo/project/.t3code-keybindings.json"` → `"/repo/project/.okcode-keybindings.json"`

## 7. Git Branch Prefixes (t3code/ → okcode/)

### apps/server/src/orchestration/Layers/ProviderCommandReactor.ts

- [x] `WORKTREE_BRANCH_PREFIX = "t3code"` → `"okcode"`

### apps/web/src/components/ChatView.logic.ts

- [x] `WORKTREE_BRANCH_PREFIX = "t3code"` → `"okcode"`

## 8. Test Fixtures

### apps/server/src/git/Layers/GitCore.test.ts

- [x] Branch names `t3code/feat/session`, `t3code/tmp-working` → `okcode/...`
- [x] Git remote URLs `git@github.com:pingdotgg/t3code.git` → `git@github.com:OpenKnots/okcode.git`
- [x] Branch prefix references

### apps/server/src/git/Layers/GitManager.test.ts

- [x] Temp dir prefixes `t3code-git-remote-` → `okcode-git-remote-`
- [x] Branch names `t3code/pr-488/...` → `okcode/pr-488/...`

### apps/server/src/wsServer.test.ts

- [x] Temp dir prefixes `t3code-ws-*` → `okcode-ws-*`

### apps/server/src/workspaceEntries.test.ts

- [x] Temp dir prefixes `t3code-workspace-*` → `okcode-workspace-*`

### apps/server/src/terminal/Layers/Manager.test.ts

- [x] Temp dir prefixes `t3code-terminal-*` → `okcode-terminal-*`

### apps/server/src/projectFaviconRoute.test.ts

- [x] Temp dir prefixes `t3code-favicon-route-*` → `okcode-favicon-route-*`

### apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts

- [x] Temp dir prefixes `t3code-reactor-*` → `okcode-reactor-*`

### apps/server/src/keybindings.test.ts

- [x] Temp dir prefixes `t3code-keybindings-*` → `okcode-keybindings-*`

### apps/server/src/git/Layers/GitCore.ts

- [x] Trace prefix `t3code-git-trace2-*` → `okcode-git-trace2-*`

### apps/server/src/open.test.ts

- [x] Command name `t3code-no-such-command-*` → `okcode-no-such-command-*`

### apps/web/src/worktreeCleanup.test.ts

- [x] Test paths `t3code-mvp/t3code-*` → `okcode-mvp/okcode-*`

### apps/web/src/pullRequestReference.test.ts

- [x] GitHub URL `github.com/pingdotgg/t3code/pull/42` → `github.com/OpenKnots/okcode/pull/42`

## 9. Desktop App

### scripts/build-desktop-artifact.ts

- [x] `t3codeCommitHash` → `okcodeCommitHash` (written; legacy key still read for migration)
- [x] `"t3code-icon-build-*"` → `"okcode-icon-build-*"`
- [x] `appId: "com.t3tools.t3code"` → `"com.okcode.okcode"`
- [x] `"t3code-desktop-*"` → `"okcode-desktop-*"`

### .docs/scripts.md

- [x] `t3://app/index.html` → `okcode://app/index.html`

## 10. Telemetry

### apps/server/src/telemetry/Layers/AnalyticsService.ts

- [x] `t3CodeVersion: version` → `okCodeVersion: version`

### apps/server/src/telemetry/Identify.ts

- [x] `~/.t3/telemetry/` → `~/.okcode/telemetry/`

## 11. Domain/URL References

### scripts/build-desktop-artifact.ts

- [x] Update any GitHub URL references

## 12. Misc code aligned with this plan

- [x] `apps/server/src/os-jank.ts`: default base dir when empty → `~/.okcode` (was `.t3`)
- [x] `apps/server/src/terminal/Layers/BunPTY.ts`: Windows help text `npx t3` → `npx okcode`

## 13. Verification Checklist

- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run fmt:check` passes
- [x] `bun run test` passes
- [x] All imports resolve correctly
- [x] No remaining `@t3tools/` imports or `t3code:` storage keys in source

## Legacy & follow-ups (intentional)

- **Desktop migration:** `apps/desktop/src/main.ts` still recognizes legacy Electron userData folder names (`T3 Code (Dev)` / `T3 Code (Alpha)`) via `LEGACY_USER_DATA_DIR_NAME`, legacy `t3code` app data path, and `t3codeCommitHash` in `package.json` alongside `okcodeCommitHash`.
- **Third-party test URLs:** Some server tests still use `github.com/pingdotgg/codething-mvp/...` as generic PR URL fixtures (not the old product repo).
- **Short `t3-` temp prefixes:** A few tests/scripts still use `t3-` as a `mkdtemp` prefix (e.g. orchestration, provider tests). Renaming to `okcode-` is optional noise reduction, not required for the rebrand.

**Previously applied in-repo:** `OKCODE_*` env vars, `okcode` CLI, desktop bundle IDs / `okcode://` scheme, shell capture markers `__OKCODE_*`, Effect `ServiceMap` keys `okcode/...`, `scripts/build-desktop-artifact` `OKCODE_DESKTOP_*`, dev-runner `okcodeHome`, root `start` script `--filter=okcode`.
