# v0.17.0 Soak Test Plan

Structured validation plan for the highest-risk surfaces in v0.17.0.

## 1. Review and editor workflow

| Step                                         | Expected                                           | Pass |
| -------------------------------------------- | -------------------------------------------------- | ---- |
| Open a thread with file activity             | Right panel opens without stale content            | [ ]  |
| Switch between Files, Editor, and Diffs tabs | Active content changes cleanly                     | [ ]  |
| Expand and collapse diff file headers        | Diff sections retain stable state                  | [ ]  |
| Open a terminal file link                    | Matching file opens in the code viewer             | [ ]  |
| Review a long diff                           | Review pane does not trap a separate scroll region | [ ]  |

## 2. Chat usability

| Step                                       | Expected                                       | Pass |
| ------------------------------------------ | ---------------------------------------------- | ---- |
| Hover an assistant response                | Copy action appears                            | [ ]  |
| Copy an assistant response                 | Clipboard receives the message content         | [ ]  |
| Open a transcript with several diff blocks | Cached highlighting keeps scrolling responsive | [ ]  |
| Use the mobile shell layout                | Floating chat widget opens and closes reliably | [ ]  |

## 3. Layout and navigation persistence

| Step                                                   | Expected                                 | Pass |
| ------------------------------------------------------ | ---------------------------------------- | ---- |
| Change layout preferences                              | New layout persists after reload         | [ ]  |
| Reload with dark and light themes                      | Theme hydrates without flash or mismatch | [ ]  |
| Navigate between terminal, file, and diff entry points | Focus and selected content stay in sync  | [ ]  |

## 4. Worktree lifecycle

| Step                                | Expected                                               | Pass |
| ----------------------------------- | ------------------------------------------------------ | ---- |
| Create or reopen multiple worktrees | Sidebar lists them correctly                           | [ ]  |
| Mark one worktree stale             | Sidebar exposes prune action                           | [ ]  |
| Cleanup a merged thread worktree    | Cleanup dialog completes without leaving stale entries | [ ]  |
| Reopen the app after cleanup        | Pruned worktrees stay removed                          | [ ]  |

## 5. Release regression checks

| Step                                                 | Expected                                     | Pass |
| ---------------------------------------------------- | -------------------------------------------- | ---- |
| Run desktop smoke coverage on the release build path | Desktop packaging remains green              | [ ]  |
| Verify local CLI package after publish               | `okcodes --version` reports `0.17.0`         | [ ]  |
| Inspect GitHub Release attachments                   | Every class listed in `assets.md` is present | [ ]  |
