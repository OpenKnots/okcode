# v0.18.0 Soak Test Plan

Structured validation plan for the highest-risk surfaces in v0.18.0.

## 1. Workspace panel and sidebar navigation

| Step                                        | Expected                                                       | Pass |
| ------------------------------------------- | -------------------------------------------------------------- | ---- |
| Open the right sidebar workspace panel      | Workspace content appears without stale or missing state       | [ ]  |
| Expand the project tree with the new toggle | All nodes expand without layout jumps or duplicated rows       | [ ]  |
| Open several threads and switch projects    | Cached lookups keep sidebar selection responsive               | [ ]  |
| Return to the sidebar after longer sessions | Branding footer stays present and header controls stay in sync | [ ]  |

## 2. Preview layouts and pop-out controls

| Step                                         | Expected                                             | Pass |
| -------------------------------------------- | ---------------------------------------------------- | ---- |
| Switch between preview layout modes          | Preview rearranges cleanly without stale sizing      | [ ]  |
| Use the preview pop-out control              | Preview opens in the expected detached surface       | [ ]  |
| Capture a preview tab snapshot               | Snapshot completes and the active tab remains stable | [ ]  |
| Update content rapidly while preview is open | Preview and inline diffs do not flicker excessively  | [ ]  |

## 3. Worktree cleanup and project file handling

| Step                                   | Expected                                                     | Pass |
| -------------------------------------- | ------------------------------------------------------------ | ---- |
| Create several temporary worktrees     | All worktrees are listed accurately                          | [ ]  |
| Trigger the delete-all cleanup action  | Cleanup removes the selected worktrees without partial state | [ ]  |
| Open or save a binary project file     | Binary project writes succeed without corrupting tree state  | [ ]  |
| Reopen the project after binary writes | Workspace tree remains readable and appropriately collapsed  | [ ]  |

## 4. Release regression checks

| Step                                                 | Expected                                     | Pass |
| ---------------------------------------------------- | -------------------------------------------- | ---- |
| Run desktop smoke coverage on the release build path | Desktop packaging remains green              | [ ]  |
| Verify local CLI package after publish               | `okcodes --version` reports `0.18.0`         | [ ]  |
| Inspect GitHub Release attachments                   | Every class listed in `assets.md` is present | [ ]  |
