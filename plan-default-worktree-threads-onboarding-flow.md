# Plan: Default Worktree Threads + Onboarding Flow

## Context

OKCode currently defaults new threads to "local" mode (running in the main project directory). Users must manually opt into worktree isolation per thread. We want to flip this default so every new thread gets its own git worktree automatically — encouraging safe, isolated development.

Additionally, there is **no onboarding experience**. New users land on an empty chat with zero guidance. We need a professional-grade, interactive onboarding flow that introduces all major features in a sleek, step-by-step modal.

---

## Part 1: Default New Threads to Worktree Mode

### Changes (2 files)

**`apps/web/src/appSettings.ts` (line 63)**

```diff
- defaultThreadEnvMode: EnvMode.pipe(withDefaults(() => "local" as const satisfies EnvMode)),
+ defaultThreadEnvMode: EnvMode.pipe(withDefaults(() => "worktree" as const satisfies EnvMode)),
```

**`apps/web/src/hooks/useHandleNewThread.ts` (line 102)**

```diff
- envMode: options?.envMode ?? "local",
+ envMode: options?.envMode ?? "worktree",
```

### Files NOT to change

- `composerDraftStore.ts` — uses "local" as state derivation (if no worktreePath exists)
- `_chat.tsx` line 73 — copies envMode from active thread (context-carrying, not default)
- `ChatView.tsx` / `ChatView.browser.tsx` — derive envMode from existing thread state or test fixtures

---

## Part 2: Interactive Onboarding Flow

### Architecture

- **Detection**: `localStorage.getItem("okcode:onboarding-completed:v1") !== "true"`
- **Mount point**: `<OnboardingDialog />` in `__root.tsx` after `<Outlet />`
- **UI**: Multi-step modal dialog using existing `Dialog` primitives from `@base-ui/react`
- **State**: Simple `useState` step counter + localStorage flag

### New Files

```
apps/web/src/components/onboarding/
  OnboardingDialog.tsx       — Main dialog: step navigation, skip/complete
  OnboardingStep.tsx         — Presentational step layout (icon, title, bullets)
  onboardingSteps.ts         — Pure data: step definitions (no JSX)
  useOnboardingState.ts      — Hook: localStorage read/write, open state
```

### File Details

#### `useOnboardingState.ts`

```ts
const STORAGE_KEY = "okcode:onboarding-completed:v1";

export function useOnboardingState() {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== "true");
  const complete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  }, []);
  return { open, complete, skip: complete };
}
```

#### `onboardingSteps.ts`

8 steps covering all major features:

| #   | ID         | Icon (Lucide)    | Title                       | Accent  |
| --- | ---------- | ---------------- | --------------------------- | ------- |
| 1   | welcome    | `Sparkles`       | Welcome to OK Code          | primary |
| 2   | chat       | `MessageSquare`  | AI-Powered Conversations    | sky     |
| 3   | git        | `GitBranch`      | Built-in Git Workflows      | emerald |
| 4   | diff       | `FileDiff`       | Review Changes Side-by-Side | amber   |
| 5   | terminal   | `TerminalSquare` | Integrated Terminal         | violet  |
| 6   | plan       | `ListChecks`     | AI-Generated Plans          | rose    |
| 7   | approvals  | `ShieldCheck`    | Stay in Control             | orange  |
| 8   | getStarted | `Rocket`         | You're All Set!             | primary |

Each step: `{ id, title, description, details: string[], accentColor }`

#### `OnboardingStep.tsx`

Presentational component:

- Icon in a rounded circle with accent bg (`bg-{accent}-500/10 text-{accent}-500`)
- `<DialogTitle>` for heading
- `<DialogDescription>` for subtitle
- Bullet list with small dot indicators for detail items
- Re-mount animation via `key={stepIndex}` on wrapper

#### `OnboardingDialog.tsx`

Orchestrator:

- Uses `Dialog` (controlled, `open={open}`)
- `DialogPopup` with `showCloseButton={false}`, `className="max-w-xl"`
- `DialogHeader` contains `<OnboardingStep />`
- `DialogFooter` contains:
  - Left: step dots (filled = current, outlined = other)
  - Right: Skip (ghost) | Back (outline, hidden on step 0) | Next/Get Started (primary)
- Last step's primary button calls `complete()`
- Skip button calls `skip()` from any step
- Step dots: `transition-colors duration-200`
- Step content: transitions via `data-starting-style` / `data-ending-style` or key-based remount

### Modified File

**`apps/web/src/routes/__root.tsx`**

```diff
  <Outlet />
+ <OnboardingDialog />
```

Import `OnboardingDialog` from `~/components/onboarding/OnboardingDialog`.

---

## Verification

1. **Worktree default**: Clear localStorage → create new thread → verify branch toolbar shows "worktree" mode
2. **Worktree setting override**: Settings → change to "local" → new thread → verify local mode
3. **Onboarding first run**: Clear localStorage → reload app → onboarding dialog appears
4. **Onboarding navigation**: Click through all 8 steps, verify smooth transitions
5. **Onboarding skip**: Reload → click Skip → verify dialog closes and doesn't reappear
6. **Onboarding completion**: Click through to "Get Started" → verify localStorage flag set, dialog gone on reload
7. **Existing users**: With `okcode:onboarding-completed:v1` = "true" in localStorage → no dialog
8. **Theme**: Test in both light and dark mode
9. **Mobile**: Verify dialog adapts to bottom-sheet on narrow viewport
10. **Run tests**: `bun run test` in `apps/web`
