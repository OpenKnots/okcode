# v0.25.0 Soak Test Plan

Structured validation plan for the highest-risk surfaces in v0.25.0.

## 1. Provider onboarding and auth flows

| Step                                                              | Expected                                                                     | Pass |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| Configure each primary provider from Settings                     | Provider setup screens save cleanly and validation messages stay actionable  | [ ]  |
| Exercise Claude and OpenClaw auth flows after reload              | Saved credentials and provider state restore without stale or conflicting UI | [ ]  |
| Start a Codex or Copilot-backed conversation after provider setup | Turn creation, streaming, and provider selection remain consistent           | [ ]  |
| Trigger an auth failure intentionally                             | Errors surface clearly without leaking secrets or breaking follow-up retries | [ ]  |

## 2. Settings and configuration surfaces

| Step                                                       | Expected                                                              | Pass |
| ---------------------------------------------------------- | --------------------------------------------------------------------- | ---- |
| Open the settings route on desktop and narrow layouts      | Navigation stays stable and each section is reachable                 | [ ]  |
| Change provider availability and default options           | Picker filtering and availability controls update without stale state | [ ]  |
| Use hotkey configuration controls and reset actions        | Shortcuts persist, restore, and do not regress the editor UI          | [ ]  |
| Open the browser-preview-related settings and helper links | The helper flow launches correctly and does not break the app shell   | [ ]  |

## 3. Runtime and review workflows

| Step                                                            | Expected                                                           | Pass |
| --------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| Run a thread that emits runtime events and reconnect mid-stream | Session state and event feeds remain consistent after reconnect    | [ ]  |
| Open the PR review dashboard with recent review history         | Dashboard loads quickly and shows the expected recent activity     | [ ]  |
| Navigate between threads, projects, and restored sessions       | Cached lookups, projections, and route transitions stay responsive | [ ]  |
| Trigger browser preview and workspace activity during a turn    | The app avoids flicker, stale panes, and blocked input             | [ ]  |

## 4. Desktop, CLI, and release packaging

| Step                                                                    | Expected                                               | Pass |
| ----------------------------------------------------------------------- | ------------------------------------------------------ | ---- |
| Run `bun run test:desktop-smoke` on the release branch                  | Desktop packaging smoke remains green                  | [ ]  |
| Run `bun run release:smoke` before and after tagging                    | Release-specific workflow checks remain green          | [ ]  |
| Verify a packaged desktop artifact launches and reports the new version | Installed app opens cleanly and reports v0.25.0        | [ ]  |
| Verify the CLI package after publish or from a packed tarball           | `okcode --version` and help commands resolve correctly | [ ]  |
