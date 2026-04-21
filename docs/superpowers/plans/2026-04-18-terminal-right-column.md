# Desktop Terminal Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the approved desktop shell cap interpretation explicit and dock the terminal below the right panel on desktop without rewriting terminal behavior.

**Architecture:** Add a small pure helper for shell counting and terminal dock placement, then portal the existing `ThreadTerminalDrawer` into a route-owned dock host under the right sidebar. Preserve the current inline terminal fallback whenever the dock host is unavailable.

**Tech Stack:** React, TanStack Router, Zustand, Vitest, TypeScript

---

### Task 1: Define The Layout Rules In A Pure Helper

**Files:**

- Create: `apps/web/src/desktopShellLayout.ts`
- Test: `apps/web/src/desktopShellLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { countCountedDesktopShells, resolveTerminalDockPlacement } from "./desktopShellLayout";

describe("desktopShellLayout", () => {
  it("counts only the approved desktop shells and excludes terminal", () => {
    expect(
      countCountedDesktopShells({
        sidebarOpen: true,
        previewOpen: true,
        rightPanelOpen: true,
        planSidebarOpen: true,
        terminalOpen: true,
      }),
    ).toBe(4);
  });

  it("docks the terminal under the right panel only when the desktop dock host exists", () => {
    expect(
      resolveTerminalDockPlacement({
        clientMode: "desktop",
        rightPanelOpen: true,
        hasRightPanelTerminalDock: true,
      }),
    ).toBe("right-panel");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test apps/web/src/desktopShellLayout.test.ts`
Expected: FAIL because `./desktopShellLayout` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a helper that exports:

```ts
export function countCountedDesktopShells(input: {
  sidebarOpen: boolean;
  previewOpen: boolean;
  rightPanelOpen: boolean;
  planSidebarOpen: boolean;
  terminalOpen: boolean;
}): number;

export function resolveTerminalDockPlacement(input: {
  clientMode: "desktop" | "mobile";
  rightPanelOpen: boolean;
  hasRightPanelTerminalDock: boolean;
}): "inline" | "right-panel";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test apps/web/src/desktopShellLayout.test.ts`
Expected: PASS

### Task 2: Add The Right-Panel Terminal Dock Host

**Files:**

- Modify: `apps/web/src/routes/_chat.$threadId.tsx`

- [ ] **Step 1: Add a route-owned dock host below the right panel**

Render a stable container below `rightPanelContent` inside the desktop right sidebar and expose its DOM node to descendants.

- [ ] **Step 2: Keep mobile behavior unchanged**

Do not render or use the dock host in the mobile sheet path.

### Task 3: Portal The Existing Terminal Drawer Into The Dock Host

**Files:**

- Modify: `apps/web/src/components/ChatView.tsx`
- Modify: `apps/web/src/routes/_chat.$threadId.tsx`

- [ ] **Step 1: Resolve terminal placement through the helper**

Use the pure helper to decide whether the terminal drawer should remain inline or render into the right-panel dock host.

- [ ] **Step 2: Preserve the inline fallback**

If the right panel is closed or the dock host is unavailable, keep the existing inline terminal drawer behavior.

- [ ] **Step 3: Keep drawer props and behavior unchanged**

Do not rework terminal state, shortcuts, split/new terminal behavior, or context actions.

### Task 4: Verify And Clean Up

**Files:**

- Modify: `apps/web/src/desktopShellLayout.test.ts` if needed

- [ ] **Step 1: Run the focused test file**

Run: `bun run test apps/web/src/desktopShellLayout.test.ts`
Expected: PASS

- [ ] **Step 2: Run formatting**

Run: `bun fmt`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `bun lint`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: PASS
