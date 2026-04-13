# v0.23.0 Soak Test Plan

Structured validation plan for the highest-risk surfaces in v0.23.0.

## 1. Provider onboarding and auth recovery

| Step                                                      | Expected                                                                    | Pass |
| --------------------------------------------------------- | --------------------------------------------------------------------------- | ---- |
| Configure Codex, Claude, and Copilot from Settings        | Provider setup screens save cleanly and the active provider choices persist | [ ]  |
| Exercise OpenClaw auth with a valid gateway configuration | Shared secret and device-token flows complete without stale state           | [ ]  |
| Reload the app and reopen provider settings               | Saved credentials and availability toggles restore correctly                | [ ]  |
| Intentionally trigger a provider auth failure             | Error messaging stays actionable and secrets remain redacted                | [ ]  |

## 2. Settings and configuration surfaces

| Step                                                            | Expected                                                         | Pass |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | ---- |
| Change provider availability and picker filtering               | Available providers update immediately without stale selections  | [ ]  |
| Set a default browser preview start page and reopen the preview | The new default is applied consistently across sessions          | [ ]  |
| Edit hotkeys and run the reset action                           | Shortcut changes persist and reset returns the expected defaults | [ ]  |
| Open the Tweakcn helper from Settings                           | The helper flow opens without breaking app navigation or focus   | [ ]  |

## 3. Runtime and review workflows

| Step                                                                   | Expected                                                                | Pass |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---- |
| Run a provider turn that emits runtime events and reconnect mid-stream | Event feeds remain coherent after reconnect and resume                  | [ ]  |
| Open the PR review dashboard on a repo with activity                   | Recent reviews load quickly and the dashboard reflects current activity | [ ]  |
| Switch between project threads during active work                      | Cached project and PR lookups keep navigation responsive                | [ ]  |
| Review a thread with browser preview and workspace updates             | The UI avoids flicker, blocked input, or stale panes                    | [ ]  |

## 4. Desktop, CLI, and release packaging

| Step                                                                    | Expected                                               | Pass |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | ---- |
| Run `bun run test:desktop-smoke` on the release branch                  | Desktop packaging smoke remains green                  | [ ]  |
| Run `bun run release:smoke` before and after tagging                    | Release-specific checks stay green                     | [ ]  |
| Verify a packaged desktop artifact launches and reports the new version | Installed app opens cleanly and reports v0.23.0        | [ ]  |
| Verify the CLI package after publish or from a packed tarball           | `okcode --version` and help commands resolve correctly | [ ]  |
