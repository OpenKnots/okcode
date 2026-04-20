# Thread-Scoped Preview Open State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make browser preview visibility follow the active thread instead of the project so switching threads does not auto-open preview unless that thread already had it open.

**Architecture:** Keep preview configuration such as layout, size, and presets scoped to the project because those are workspace-level preferences. Move only the open/closed bit to thread scope and update selectors, mutators, and layout capture/apply paths to use `threadId`.

**Tech Stack:** React, Zustand, TypeScript, Vitest, Bun

---

### Task 1: Lock the Bug Down With Tests

**Files:**

- Modify: `apps/web/src/previewStateStore.test.ts`

- [ ] Add a failing store test proving preview open state is keyed by thread and does not bleed across sibling threads in the same project.
- [ ] Add a failing store test proving persisted thread-open state is written under the new thread-scoped field.
- [ ] Run: `bun run vitest apps/web/src/previewStateStore.test.ts`

### Task 2: Move Preview Open State to Thread Scope

**Files:**

- Modify: `apps/web/src/previewStateStore.ts`

- [ ] Replace project-scoped preview open state with thread-scoped state and update persistence shape.
- [ ] Preserve project-scoped preview layout metadata and migrate older persisted data without carrying forward stale open state.
- [ ] Run: `bun run vitest apps/web/src/previewStateStore.test.ts`

### Task 3: Update Preview Consumers

**Files:**

- Modify: `apps/web/src/components/ChatView.tsx`
- Modify: `apps/web/src/components/PreviewPanel.tsx`
- Modify: `apps/web/src/hooks/useLayoutActions.ts`
- Modify: `apps/web/src/lib/openUrlInAppBrowser.ts`
- Modify: `apps/web/src/lib/openUrlInAppBrowser.test.ts`
- Modify: `apps/web/src/components/GitActionsControl.tsx`

- [ ] Update preview selectors and open/close callbacks to use the active `threadId`.
- [ ] Keep preview layout capture/apply using project-scoped layout settings while using thread-scoped visibility.
- [ ] Run focused tests for affected helpers.

### Task 4: Verify Repo Gates

**Files:**

- Modify: any files from prior tasks only if verification exposes issues

- [ ] Run: `bun fmt`
- [ ] Run: `bun lint`
- [ ] Run: `bun typecheck`
