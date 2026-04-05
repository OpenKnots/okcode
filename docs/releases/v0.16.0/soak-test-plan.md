# v0.16.0 RC Soak Test Plan

Structured test plan for the 48-hour RC soak period. Each test case must be executed on at least the primary platform listed. Cross-platform variants are noted where applicable.

## Test environments

| Role              | Platform             | Version         |
| ----------------- | -------------------- | --------------- |
| Primary desktop   | macOS arm64          | Sonoma or later |
| Secondary desktop | Windows x64          | Windows 11      |
| Tertiary desktop  | Linux x64            | Ubuntu 24.04    |
| Primary mobile    | iPhone (current gen) | iOS 17+         |
| Secondary mobile  | iPhone (older gen)   | iOS 16+         |
| CLI               | Any                  | Node 22.16+     |

## 1. Installation and launch

### 1.1 Fresh install (all desktop platforms)

| Step                                                        | Expected                                | Pass |
| ----------------------------------------------------------- | --------------------------------------- | ---- |
| Download the RC DMG/AppImage/installer from GitHub Releases | Download completes, correct file size   | [ ]  |
| Install the application                                     | Installs without errors                 | [ ]  |
| Launch the application for the first time                   | App window opens, no crash              | [ ]  |
| Verify build metadata in the UI                             | Shows v0.16.0-rc.1, correct commit hash | [ ]  |

### 1.2 Upgrade from v0.15.0 (macOS, Windows)

| Step                                                   | Expected                     | Pass |
| ------------------------------------------------------ | ---------------------------- | ---- |
| Install v0.15.0 from the previous stable release       | Installs and launches        | [ ]  |
| Allow the auto-updater to detect the RC                | Updater notification appears | [ ]  |
| Apply the update                                       | App restarts on v0.16.0-rc.1 | [ ]  |
| Verify existing sessions/settings survived the upgrade | Data is intact               | [ ]  |

### 1.3 CLI install

| Step                                    | Expected                         | Pass |
| --------------------------------------- | -------------------------------- | ---- |
| `npx okcodes@0.16.0-rc.1 --version`     | Prints `0.16.0-rc.1`             | [ ]  |
| `npx okcodes@0.16.0-rc.1 --help`        | Renders help text without errors | [ ]  |
| `npx okcodes@0.16.0-rc.1 doctor --help` | Renders doctor subcommand help   | [ ]  |

## 2. Core session lifecycle

### 2.1 Start a new session

| Step                                            | Expected                                    | Pass |
| ----------------------------------------------- | ------------------------------------------- | ---- |
| Open the app, start a new thread                | Thread initializes, provider session starts | [ ]  |
| Send a message                                  | Response streams in real-time               | [ ]  |
| Send a follow-up message                        | Context carries over, response is coherent  | [ ]  |
| Wait 60 seconds idle, then send another message | Session resumes without reconnect error     | [ ]  |

### 2.2 Long-running session

| Step                                                    | Expected                   | Pass |
| ------------------------------------------------------- | -------------------------- | ---- |
| Run a multi-turn session (10+ messages) over 30 minutes | No memory leaks, no UI lag | [ ]  |
| Switch between threads during the session               | State preserved per-thread | [ ]  |
| Close and reopen the app mid-session                    | Session state recovers     | [ ]  |

## 3. New feature tests (v0.16.0 specific)

### 3.1 Right-panel diff viewer

| Step                                    | Expected                         | Pass |
| --------------------------------------- | -------------------------------- | ---- |
| Trigger a file change in a thread       | Diff entry appears in work log   | [ ]  |
| Click the diff entry                    | Right panel opens with diff view | [ ]  |
| Navigate between multiple changed files | Panel updates, no stale content  | [ ]  |
| Close the diff panel                    | Panel closes cleanly             | [ ]  |
| Reopen the diff panel                   | Previous diff state restored     | [ ]  |

### 3.2 Editable code preview with autosave

| Step                                        | Expected                   | Pass |
| ------------------------------------------- | -------------------------- | ---- |
| Open a code preview                         | Preview renders correctly  | [ ]  |
| Make edits in the preview                   | Changes appear immediately | [ ]  |
| Wait 5 seconds (autosave interval)          | No save indicator or error | [ ]  |
| Navigate away from the preview, then return | Edits are preserved        | [ ]  |
| Close and reopen the app                    | Edits survive the restart  | [ ]  |

### 3.3 Rebase-before-commit flow

| Step                                                                | Expected                                      | Pass |
| ------------------------------------------------------------------- | --------------------------------------------- | ---- |
| Create a branch that has diverged from main (both have new commits) | Branch exists                                 | [ ]  |
| Trigger commit with rebase-before-commit enabled                    | Rebase starts                                 | [ ]  |
| (Clean rebase) Verify the commit lands on rebased history           | Commit appears with linear history            | [ ]  |
| (Conflict rebase) Create a branch with deliberate conflicts         | Branch exists                                 | [ ]  |
| Trigger commit with rebase-before-commit                            | Conflict is detected and surfaced to the user | [ ]  |
| Resolve conflict and retry                                          | Commit succeeds after resolution              | [ ]  |

### 3.4 GitHub repo cloning

| Step                                              | Expected                                        | Pass |
| ------------------------------------------------- | ----------------------------------------------- | ---- |
| Use the clone entry point with a public repo URL  | Repo clones, thread opens in the cloned project | [ ]  |
| Use the clone entry point with a private repo URL | Auth flow triggers, repo clones after auth      | [ ]  |
| Clone a large repo (1GB+)                         | Progress indicator shows, clone completes       | [ ]  |
| Cancel a clone in progress                        | Clone stops cleanly, no partial state left      | [ ]  |

### 3.5 Provider session restart on CWD change

| Step                            | Expected                                   | Pass |
| ------------------------------- | ------------------------------------------ | ---- |
| Start a session in worktree A   | Session runs normally                      | [ ]  |
| Switch active worktree to B     | Provider session restarts automatically    | [ ]  |
| Send a message after the switch | Response uses worktree B context           | [ ]  |
| Switch back to worktree A       | Session restarts again, context is correct | [ ]  |

### 3.6 Shell env sanitization

| Step                                                     | Expected                                                       | Pass |
| -------------------------------------------------------- | -------------------------------------------------------------- | ---- |
| Set `NODE_OPTIONS=--max-old-space-size=100` in shell env | Env is set                                                     | [ ]  |
| Launch an agent session                                  | Session starts without inheriting the restrictive NODE_OPTIONS | [ ]  |
| Set `PATH` to include unusual directories                | Env is set                                                     | [ ]  |
| Launch an agent session                                  | Session uses sanitized PATH                                    | [ ]  |

### 3.7 Build metadata visibility

| Step                                | Expected                            | Pass |
| ----------------------------------- | ----------------------------------- | ---- |
| Check version display in the web UI | Shows 0.16.0-rc.1                   | [ ]  |
| Check commit hash in the web UI     | Matches the tagged commit           | [ ]  |
| Check server metadata endpoint/logs | Reports matching version and commit | [ ]  |

## 4. Viewport presets and orientation

| Step                                    | Expected                             | Pass |
| --------------------------------------- | ------------------------------------ | ---- |
| Open viewport preset selector           | Presets are listed                   | [ ]  |
| Switch to a mobile preset               | Preview resizes to mobile dimensions | [ ]  |
| Toggle orientation (portrait/landscape) | Preview rotates                      | [ ]  |
| Switch to a tablet preset               | Preview resizes correctly            | [ ]  |
| Return to default viewport              | Preview returns to normal            | [ ]  |

## 5. iOS TestFlight testing

### 5.1 Device 1: **\*\***\_\_**\*\*** (iOS **.**)

| Step                              | Expected                            | Pass |
| --------------------------------- | ----------------------------------- | ---- |
| Install from TestFlight           | App installs and launches           | [ ]  |
| Pair with desktop/server          | Pairing completes                   | [ ]  |
| Restore a saved pairing           | Connection re-establishes           | [ ]  |
| Open a thread and send a message  | Message sends, response streams     | [ ]  |
| Approve an action                 | Action executes                     | [ ]  |
| Answer a user-input request       | Input is delivered to the agent     | [ ]  |
| Background the app for 30 seconds | App suspends                        | [ ]  |
| Foreground the app                | App resumes without reconnect error | [ ]  |
| Tap a notification                | App opens to the correct thread     | [ ]  |

### 5.2 Device 2: **\*\***\_\_**\*\*** (iOS **.**)

| Step                              | Expected                            | Pass |
| --------------------------------- | ----------------------------------- | ---- |
| Install from TestFlight           | App installs and launches           | [ ]  |
| Pair with desktop/server          | Pairing completes                   | [ ]  |
| Restore a saved pairing           | Connection re-establishes           | [ ]  |
| Open a thread and send a message  | Message sends, response streams     | [ ]  |
| Approve an action                 | Action executes                     | [ ]  |
| Answer a user-input request       | Input is delivered to the agent     | [ ]  |
| Background the app for 30 seconds | App suspends                        | [ ]  |
| Foreground the app                | App resumes without reconnect error | [ ]  |
| Tap a notification                | App opens to the correct thread     | [ ]  |

## 6. Regression tests

### 6.1 Sidebar and navigation

| Step                                   | Expected                       | Pass |
| -------------------------------------- | ------------------------------ | ---- |
| Open sidebar, verify thread list loads | Threads render with wide names | [ ]  |
| Create a new thread                    | Thread appears in sidebar      | [ ]  |
| Switch between threads                 | Content updates without flash  | [ ]  |

### 6.2 Prompt enhancement

| Step                              | Expected                                     | Pass |
| --------------------------------- | -------------------------------------------- | ---- |
| Open the prompt enhancement menu  | Menu appears                                 | [ ]  |
| Select an enhancement             | Enhancement applies to the composer          | [ ]  |
| Send the message with enhancement | Enhancement is preserved in the sent message | [ ]  |

### 6.3 PR status display

| Step                                       | Expected                               | Pass |
| ------------------------------------------ | -------------------------------------- | ---- |
| Open a thread linked to a branch with a PR | PR status badge appears                | [ ]  |
| Verify PR status matches GitHub            | Status is correct (open/merged/closed) | [ ]  |

## 7. Stability monitoring

Track throughout the 48-hour soak:

| Metric                          | Threshold                      | Status |
| ------------------------------- | ------------------------------ | ------ |
| Crash-on-launch                 | 0 across all desktop platforms | [ ]    |
| Unhandled exceptions in console | 0 critical                     | [ ]    |
| Memory usage after 1 hour       | < 500 MB RSS                   | [ ]    |
| WebSocket reconnect failures    | 0 permanent failures           | [ ]    |
| Sev-1 issues filed              | 0                              | [ ]    |
| Sev-2 issues filed              | 0                              | [ ]    |

## Soak sign-off

| Role         | Name | Date | Approved |
| ------------ | ---- | ---- | -------- |
| Release lead |      |      | [ ]      |
| QA reviewer  |      |      | [ ]      |
| iOS tester   |      |      | [ ]      |

When all checks pass and sign-off is complete, proceed to Phase 3 (Promote to Stable) in the [rollout checklist](rollout-checklist.md).
