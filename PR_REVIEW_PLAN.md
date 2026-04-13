# PR Review Completion Plan

Goal: make `okcode` PR Review feel comprehensive, reliable, and maintainer-grade on the existing `/_chat/pr-review` surface.

## Phase 1 — Finish the current review cockpit

### 1. Action rail polish

- [ ] Tighten the action rail layout so decision, blockers, file impact, and recent maintainer reviews read cleanly at a glance.
- [ ] Make approval blockers explicit: conflicts, failing checks, pending checks, blocked workflow steps.
- [ ] Ensure copy is compact and maintainer-oriented.

### 2. Review state clarity

- [ ] Show the current PR review decision clearly and consistently.
- [ ] Confirm the latest submitted review state refreshes correctly after comment / approve / request changes.
- [ ] Verify draft review body reset and query invalidation behavior after submit.

### 3. Review history quality

- [ ] Improve recent maintainer reviews presentation for scanability.
- [ ] Distinguish maintainer review state from plain discussion/comment noise.
- [ ] Decide whether the compact summary is enough or needs a deeper expandable history view.

## Phase 2 — Deepen review context

### 4. File-level review signal

- [ ] Surface clearer per-file review context: commented files, unresolved-thread files, reviewed files.
- [ ] Make it easier to see where maintainer attention is still needed.
- [ ] Verify selected-file behavior stays stable when data refreshes.

### 5. Blockers and workflow visibility

- [ ] Make mergeability, required checks, conflicts, and workflow blockers easier to understand from the page.
- [ ] Improve “why can’t I approve yet?” guidance.
- [ ] Ensure blocker state is visible without needing to hunt through inspector panels.

### 6. Maintainer workflow integration

- [ ] Confirm PR Review is fully discoverable through navigation and command palette.
- [ ] Identify any remaining maintainer entry points that should route into `/_chat/pr-review`.
- [ ] Avoid creating duplicate surfaces or split workflows.

## Phase 3 — End-to-end reliability

### 7. Validation and cleanup

- [ ] Run full validation for the changed slice, including typecheck if possible.
- [ ] Fix any lint/type/test issues introduced by the PR Review work.
- [ ] Keep scope tight and avoid unrelated file churn.

### 8. Real PR walkthrough

- [ ] Test the full maintainer flow against a real PR.
- [ ] Verify open review, inspect files, inspect threads, view recent maintainer reviews, submit review, and refresh behavior.
- [ ] Capture any UX or state-sync gaps found in real usage.

### 9. Final completeness pass

- [ ] Review the page as a whole for maintainer usability.
- [ ] Confirm the implementation feels like the canonical PR Review workflow, not a partial bolt-on.
- [ ] Produce a final summary of what is complete vs what is intentionally deferred.

## Execution order

1. Action rail polish
2. Review state clarity
3. Review history quality
4. File-level review signal
5. Blockers and workflow visibility
6. Maintainer workflow integration
7. Validation and cleanup
8. Real PR walkthrough
9. Final completeness pass

## Definition of done

- A maintainer can open `/_chat/pr-review`, understand PR state quickly, inspect review context, see recent maintainer activity, submit a review confidently, and trust the page to stay in sync afterward.
- The page is clearly the main PR review workflow in `okcode`.
- Validation is clean enough that we trust the implementation, not just the visuals.
