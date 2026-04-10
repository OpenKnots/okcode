# v0.22.0 Soak Test Plan

Structured validation plan for the highest-risk surfaces in v0.22.0.

## 1. SME provider-aware auth routing

| Step                                                            | Expected                                                                   | Pass |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | ---- |
| Create a new SME conversation and choose a provider/auth method | The selected provider and auth method persist on the conversation          | [ ]  |
| Reload the app and reopen the same conversation                 | The saved provider/auth settings restore without falling back to old state | [ ]  |
| Send a message with valid auth configured                       | Validation succeeds and the message routes through the intended backend    | [ ]  |
| Switch the conversation auth method and send again              | The updated auth choice is honored without needing a new conversation      | [ ]  |

## 2. SME chat workspace refresh

| Step                                                   | Expected                                                            | Pass |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---- |
| Open the SME workspace with multiple conversations     | Sidebar, loading states, and message list render cleanly            | [ ]  |
| Compose a longer message in the refreshed composer     | Composer grows predictably and remains usable on desktop and mobile | [ ]  |
| Review longer threads with several message types       | Bubble hierarchy and spacing stay readable without overlapping UI   | [ ]  |
| Open the knowledge panel while switching conversations | Rail and knowledge panel stay in sync with the active conversation  | [ ]  |

## 3. Settings navigation and section routing

| Step                                                  | Expected                                                              | Pass |
| ----------------------------------------------------- | --------------------------------------------------------------------- | ---- |
| Open settings on desktop                              | Sidebar sections navigate between panels without losing active state  | [ ]  |
| Open settings on a narrow/mobile viewport             | Section picker exposes the same sections and updates the active panel | [ ]  |
| Move between general and SME-specific settings panels | Section headers and descriptions update with the active destination   | [ ]  |
| Return to chat after settings changes                 | Updated settings are reflected without stale navigation state         | [ ]  |

## 4. Websocket error redaction

| Step                                                     | Expected                                                             | Pass |
| -------------------------------------------------------- | -------------------------------------------------------------------- | ---- |
| Trigger a websocket-facing provider or transport error   | Error content reaches the UI without exposing raw secrets            | [ ]  |
| Inspect server-side surfaced error text or logs          | Sensitive token-like values are redacted consistently                | [ ]  |
| Trigger the same failure path through reconnect or retry | Redaction remains stable across transport retries and repeated sends | [ ]  |
| Review affected UI banners and inline thread errors      | Users see actionable errors without leaked credentials               | [ ]  |

## 5. Release regression checks

| Step                                                 | Expected                                     | Pass |
| ---------------------------------------------------- | -------------------------------------------- | ---- |
| Run desktop smoke coverage on the release build path | Desktop packaging remains green              | [ ]  |
| Verify local CLI package after publish               | `okcodes --version` reports `0.22.0`         | [ ]  |
| Inspect GitHub Release attachments                   | Every class listed in `assets.md` is present | [ ]  |
