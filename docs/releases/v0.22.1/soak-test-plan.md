# v0.22.1 Soak Test Plan

Structured validation plan for the highest-risk surfaces in v0.22.1.

## 1. Sidebar density and visual refresh

| Step                                              | Expected                                                              | Pass |
| ------------------------------------------------- | --------------------------------------------------------------------- | ---- |
| Open the main chat sidebar with the default theme | Sidebar spacing, typography, and section structure render cleanly     | [ ]  |
| Switch between available sidebar density settings | Density updates immediately without breaking navigation or truncation | [ ]  |
| Navigate projects and threads with each density   | Labels, badges, and controls remain readable and correctly aligned    | [ ]  |
| Reload the app after changing density             | The chosen density persists and restores without layout regressions   | [ ]  |

## 2. Diagnostics and pending actions

| Step                                                  | Expected                                                                    | Pass |
| ----------------------------------------------------- | --------------------------------------------------------------------------- | ---- |
| Trigger a provider or connection error                | Notification expands to show diagnostic details without leaking credentials | [ ]  |
| Use the diagnostics copy action                       | Copied content includes actionable details and preserves redaction          | [ ]  |
| Use connection test controls on a configured provider | The control reports success or failure without blocking the rest of the UI  | [ ]  |
| Start a git action and stop it while pending          | The action stops cleanly and the thread state remains consistent            | [ ]  |

## 3. Decision workspace and user-input projections

| Step                                                    | Expected                                                              | Pass |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ---- |
| Open a thread with orchestration activity               | Thread overview and detail queries return the expected projected data | [ ]  |
| Inspect pending user input state for an active thread   | Pending input projections appear in the thread model without drift    | [ ]  |
| Exercise reconnect or session resume on projected state | Projection-backed thread data survives reload and reconnect correctly | [ ]  |
| Inspect new decision-related persistence after activity | Decision tables and snapshots populate without migration errors       | [ ]  |

## 4. Provider and OpenClaw routing

| Step                                                        | Expected                                                               | Pass |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| Run an SME Claude conversation after upgrading              | The flow routes through Claude Code CLI and completes normally         | [ ]  |
| Exercise OpenClaw gateway auth with a valid configuration   | Auth fallback behavior succeeds without manual recovery                | [ ]  |
| Trigger an OpenClaw connection failure                      | Diagnostics surface cleanly and expected shutdown noise stays filtered | [ ]  |
| Review syntax highlighting on React-related files and diffs | React language ids render with the intended highlighting configuration | [ ]  |

## 5. Desktop pop-out and preview polish

| Step                                                   | Expected                                                          | Pass |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ---- |
| Pop a thread out into a desktop window                 | The active thread route is preserved in the new window            | [ ]  |
| Open a GitHub link from the preview popout             | The link opens externally instead of hijacking the in-app preview | [ ]  |
| Adjust wider preview viewport inputs                   | Values remain usable and layout controls do not clip              | [ ]  |
| Run desktop smoke and release smoke on the release tag | Packaging and release-only workflow steps remain green            | [ ]  |
