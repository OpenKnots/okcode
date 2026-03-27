# T3Code → OKCode Rebrand Checklist

This document tracks all conversions needed to rebrand from T3Code to OKCode.

## 1. Package Names (@t3tools → @okcode)

### Root package.json
- [ ] `@t3tools/monorepo` → `@okcode/monorepo`

### apps/server/package.json
- [ ] `@t3tools/contracts` → `@okcode/contracts`
- [ ] `@t3tools/shared` → `@okcode/shared`
- [ ] `@t3tools/web` → `@okcode/web`

### apps/web/package.json
- [ ] `@t3tools/contracts` → `@okcode/contracts`
- [ ] `@t3tools/shared` → `@okcode/shared`

### packages/contracts/package.json
- [ ] `@t3tools/contracts` (name only)

### packages/shared/package.json
- [ ] `@t3tools/shared` (name only)
- [ ] `@t3tools/contracts` → `@okcode/contracts`

### scripts/package.json
- [ ] `@t3tools/scripts` (name only)
- [ ] `@t3tools/contracts` → `@okcode/contracts`
- [ ] `@t3tools/shared` → `@okcode/shared`

### Import statements (all .ts/.tsx files)
- [ ] `from "@t3tools/contracts"` → `from "@okcode/contracts"`
- [ ] `from "@t3tools/shared/..."` → `from "@okcode/shared/..."`

### vitest.config.ts
- [ ] `/^@t3tools\/contracts$/` → `/^@okcode\/contracts$/`

### turbo.json
- [ ] `"@t3tools/contracts#build"` → `"@okcode/contracts#build"`
- [ ] `"--filter=@t3tools/..."` → `"--filter=@okcode/..."`
- [ ] `"--filter=t3"` → `"--filter=okcode"` (CLI package filter)

## 2. Package Bin Name

### apps/server/package.json
- [ ] `"t3"` bin → `"okcode"`

## 3. Environment Variables (T3CODE_* → OKCODE_*)

### turbo.json globalEnv
- [ ] `T3CODE_LOG_WS_EVENTS` → `OKCODE_LOG_WS_EVENTS`
- [ ] `T3CODE_MODE` → `OKCODE_MODE`
- [ ] `T3CODE_PORT` → `OKCODE_PORT`
- [ ] `T3CODE_NO_BROWSER` → `OKCODE_NO_BROWSER`
- [ ] `T3CODE_HOME` → `OKCODE_HOME`
- [ ] `T3CODE_AUTH_TOKEN` → `OKCODE_AUTH_TOKEN`
- [ ] `T3CODE_DESKTOP_WS_URL` → `OKCODE_DESKTOP_WS_URL`

### scripts/dev-runner.ts
- [ ] All `T3CODE_*` env vars → `OKCODE_*`
- [ ] All config names (T3CODE_PORT_OFFSET, T3CODE_DEV_INSTANCE, etc.)
- [ ] `DEFAULT_T3_HOME` constant
- [ ] `homedir(), ".t3"` → `homedir(), ".okcode"`

### scripts/dev-runner.test.ts
- [ ] All test references to `T3CODE_*` env vars → `OKCODE_*`
- [ ] `"~/.t3"` → `"~/.okcode"`

## 4. Documentation Files

### README.md
- [ ] "T3 Code" → "OK Code"
- [ ] `npx t3` → `npx okcode`
- [ ] `github.com/pingdotgg/t3code` → `github.com/OpenKnots/okcode`

### REMOTE.md
- [ ] "T3 Code" → "OK Code"
- [ ] `T3CODE_*` env vars → `OKCODE_*`
- [ ] CLI flag descriptions updated

### KEYBINDINGS.md
- [ ] `~/.t3/keybindings.json` → `~/.okcode/keybindings.json`

### CONTRIBUTING.md
- [ ] No references (verify none)

### AGENTS.md
- [ ] "T3 Code" → "OK Code"
- [ ] `@t3tools/shared/...` → `@okcode/shared/...`

### docs/release.md
- [ ] `t3` package references → `okcode`
- [ ] `T3CODE_DESKTOP_UPDATE_REPOSITORY` → `OKCODE_DESKTOP_UPDATE_REPOSITORY`
- [ ] `T3CODE_DESKTOP_UPDATE_GITHUB_TOKEN` → `OKCODE_DESKTOP_UPDATE_GITHUB_TOKEN`

### .docs/*.md files
- [ ] .docs/architecture.md: "T3 Code" → "OK Code"
- [ ] .docs/quick-start.md: "npx t3" → "npx okcode", `T3CODE_*` → `OKCODE_*`
- [ ] .docs/provider-architecture.md: `@t3tools/contracts` → `@okcode/contracts`
- [ ] .docs/workspace-layout.md: `@t3tools/shared/...` → `@okcode/shared/...`
- [ ] .docs/scripts.md: `T3CODE_*` → `OKCODE_*`
- [ ] .docs/encyclopedia.md: "T3 Code" → "OK Code"

### .github/workflows/*.yml
- [ ] release.yml: `--filter=t3` → `--filter=okcode`, `T3 Code` → `OK Code`

## 5. Storage Keys (t3code:* → okcode:*)

### apps/web/src/store.ts
- [ ] `"t3code:renderer-state:..."` → `"okcode:renderer-state:..."`

### apps/web/src/terminalStateStore.ts
- [ ] `"t3code:terminal-state:..."` → `"okcode:terminal-state:..."`

### apps/web/src/hooks/useTheme.ts
- [ ] `"t3code:theme"` → `"okcode:theme"`

### apps/web/src/hooks/useLocalStorage.ts
- [ ] `"t3code:local_storage_change"` → `"okcode:local_storage_change"`

### apps/web/src/editorPreferences.ts
- [ ] `"t3code:last-editor"` → `"okcode:last-editor"`

### apps/web/src/composerDraftStore.ts
- [ ] `"t3code:composer-drafts:..."` → `"okcode:composer-drafts:..."`

### apps/web/src/appSettings.ts
- [ ] `"t3code:app-settings:..."` → `"okcode:app-settings:..."`

### apps/web/src/components/ChatView.logic.ts
- [ ] `"t3code:last-invoked-script-by-project"` → `"okcode:last-invoked-script-by-project"`

## 6. Config Files (.t3code* → .okcode*)

### apps/web/src/components/KeybindingsToast.browser.tsx
- [ ] `"/repo/project/.t3code-keybindings.json"` → `"/repo/project/.okcode-keybindings.json"`

### apps/web/src/components/ChatView.browser.tsx
- [ ] `"/repo/project/.t3code-keybindings.json"` → `"/repo/project/.okcode-keybindings.json"`

## 7. Git Branch Prefixes (t3code/ → okcode/)

### apps/server/src/orchestration/Layers/ProviderCommandReactor.ts
- [ ] `WORKTREE_BRANCH_PREFIX = "t3code"` → `"okcode"`

### apps/web/src/components/ChatView.logic.ts
- [ ] `WORKTREE_BRANCH_PREFIX = "t3code"` → `"okcode"`

## 8. Test Fixtures

### apps/server/src/git/Layers/GitCore.test.ts
- [ ] Branch names `t3code/feat/session`, `t3code/tmp-working` → `okcode/...`
- [ ] Git remote URLs `git@github.com:pingdotgg/t3code.git` → `git@github.com:OpenKnots/okcode.git`
- [ ] Branch prefix references

### apps/server/src/git/Layers/GitManager.test.ts
- [ ] Temp dir prefixes `t3code-git-remote-` → `okcode-git-remote-`
- [ ] Branch names `t3code/pr-488/...` → `okcode/pr-488/...`

### apps/server/src/wsServer.test.ts
- [ ] Temp dir prefixes `t3code-ws-*` → `okcode-ws-*`

### apps/server/src/workspaceEntries.test.ts
- [ ] Temp dir prefixes `t3code-workspace-*` → `okcode-workspace-*`

### apps/server/src/terminal/Layers/Manager.test.ts
- [ ] Temp dir prefixes `t3code-terminal-*` → `okcode-terminal-*`

### apps/server/src/projectFaviconRoute.test.ts
- [ ] Temp dir prefixes `t3code-favicon-route-*` → `okcode-favicon-route-*`

### apps/server/src/orchestration/Layers/ProviderCommandReactor.test.ts
- [ ] Temp dir prefixes `t3code-reactor-*` → `okcode-reactor-*`

### apps/server/src/keybindings.test.ts
- [ ] Temp dir prefixes `t3code-keybindings-*` → `okcode-keybindings-*`

### apps/server/src/git/Layers/GitCore.ts
- [ ] Trace prefix `t3code-git-trace2-*` → `okcode-git-trace2-*`

### apps/server/src/open.test.ts
- [ ] Command name `t3code-no-such-command-*` → `okcode-no-such-command-*`

### apps/web/src/worktreeCleanup.test.ts
- [ ] Test paths `t3code-mvp/t3code-*` → `okcode-mvp/okcode-*`

### apps/web/src/pullRequestReference.test.ts
- [ ] GitHub URL `github.com/pingdotgg/t3code/pull/42` → `github.com/OpenKnots/okcode/pull/42`

## 9. Desktop App

### scripts/build-desktop-artifact.ts
- [ ] `t3codeCommitHash` → `okcodeCommitHash`
- [ ] `"t3code-icon-build-*"` → `"okcode-icon-build-*"`
- [ ] `appId: "com.t3tools.t3code"` → `"com.okcode.okcode"`
- [ ] `"t3code-desktop-*"` → `"okcode-desktop-*"`

### .docs/scripts.md
- [ ] `t3://app/index.html` → `okcode://app/index.html`

## 10. Telemetry

### apps/server/src/telemetry/Layers/AnalyticsService.ts
- [ ] `t3CodeVersion: version` → `okCodeVersion: version`

### apps/server/src/telemetry/Identify.ts
- [ ] `~/.t3/telemetry/` → `~/.okcode/telemetry/`

## 11. Domain/URL References

### scripts/build-desktop-artifact.ts
- [ ] Update any GitHub URL references

## 12. Verification Checklist

After conversion, verify:
- [x] `bun run typecheck` passes
- [x] `bun run lint` passes
- [x] `bun run fmt:check` passes
- [x] `bun run test` passes
- [x] All imports resolve correctly
- [x] No remaining `@t3tools/` or `t3code` references (except in .git history and this plan’s historical checklist text)

**Follow-up applied in-repo:** `OKCODE_*` env vars, `okcode` CLI (`okcodeCli`), desktop bundle IDs / `okcode://` scheme, shell capture markers `__OKCODE_*`, Effect `ServiceMap` keys `okcode/...` (replacing `t3/...`), `scripts/build-desktop-artifact` `OKCODE_DESKTOP_*`, dev-runner `okcodeHome`, root `start` script `--filter=okcode`. Legacy `t3code` userData dir and `t3codeCommitHash` in `package.json` are still recognized where migration matters.
