# OK Code Design System

This document is the authoritative reference for OK Code's visual design philosophy,
component patterns, and UI rules. Every contributor and AI agent should consult this
before making interface changes.

---

## 1. Design Philosophy

OK Code is a **desktop-first orchestration platform for interactive coding agents**.
The interface exists to get out of the way and let the developer focus on the
conversation with the agent. Every pixel must earn its place.

### Core Principles

1. **Clarity over decoration.** Remove anything that doesn't help the user make a
   decision or understand state. No gratuitous gradients, no ornamental dividers,
   no filler icons.

2. **Information density over whitespace.** Developers tolerate — and prefer — dense
   interfaces. Pack useful information in, but keep it scannable. Two lines of
   meaningful metadata per thread row is better than one line with padding.

3. **Keyboard-first, pointer-friendly.** Every primary action must be reachable via
   keyboard. Pointer interactions are a convenience layer, never the only path.
   Command palette (`Cmd+K`) is the universal escape hatch.

4. **State visibility at a glance.** The user should never have to click into something
   to learn its status. Branch name, diff stats, PR state, sync status — surface
   them where the user already is (sidebar, toolbar), not behind a hover or modal.

5. **Progressive disclosure.** Show the 80% case by default; let the 20% reveal on
   interaction. Tooltips, expandable sections, and context menus are the right homes
   for secondary actions.

6. **Performance is a feature.** Virtual scrolling for long lists. Deferred values for
   search. Memoized components with explicit equality checks. Never block the main
   thread for a pretty animation.

7. **Theme parity.** Every theme (light and dark) must receive equal visual care.
   Never design for dark-only and bolt on a light variant. All 6 premium themes are
   first-class citizens.

8. **Composability.** Small, focused components with clear props boundaries.
   Composite patterns (`Select > SelectTrigger > SelectValue > SelectPopup`) over
   monolithic components with flag props.

---

## 2. Visual Identity

### Typography

| Role                       | Size                 | Weight          | Tracking  | Font Stack                   |
| -------------------------- | -------------------- | --------------- | --------- | ---------------------------- |
| Thread title (sidebar)     | `text-xs` (0.75rem)  | `font-normal`   | default   | Inter, system-ui, sans-serif |
| Thread subtitle / metadata | `text-[10px]`        | `font-normal`   | default   | Inter, system-ui, sans-serif |
| Badge text                 | `text-[10px]`        | `font-medium`   | default   | Inter, system-ui, sans-serif |
| Button text                | `text-sm` (0.875rem) | `font-medium`   | default   | Inter, system-ui, sans-serif |
| Heading / dialog title     | `text-lg` (1.125rem) | `font-semibold` | `-0.01em` | Inter, system-ui, sans-serif |
| Code / terminal            | `text-sm`            | `font-normal`   | default   | SF Mono, Consolas, monospace |
| Project name               | `text-xs`            | `font-semibold` | default   | Inter, system-ui, sans-serif |

### Color Semantics

Colors are referenced through CSS custom properties, never hardcoded hex values.

| Token                      | Usage                                             |
| -------------------------- | ------------------------------------------------- |
| `text-foreground`          | Primary text                                      |
| `text-muted-foreground`    | Secondary/deemphasized text                       |
| `text-muted-foreground/50` | Tertiary/metadata text (branch names, timestamps) |
| `bg-background`            | Page background                                   |
| `bg-accent`                | Hover state, active row highlight                 |
| `bg-accent/60`             | Active sidebar item                               |
| `bg-accent/40`             | Selected sidebar item                             |
| `text-emerald-600`         | Additions / success (green)                       |
| `text-rose-500`            | Deletions / error (red)                           |
| `text-warning`             | Warning states, behind-upstream                   |
| `text-destructive`         | Destructive actions (delete)                      |
| `border-border/60`         | Subtle badge borders                              |

### Spacing Rules

- **Sidebar item height:** `min-h-7` (28px) minimum, `h-auto` for multi-line
- **Sidebar item padding:** `px-2 py-1` (8px horizontal, 4px vertical)
- **Icon size in sidebar:** `size-3.5` (14px)
- **Badge size in sidebar:** `text-[10px]`, `px-1.5 py-0.5`
- **Gap between icon and content:** `gap-2` (8px)
- **Gap between metadata items:** `gap-1` (4px) or `gap-1.5` (6px)
- **Border radius:** Use `rounded-md` (6px) for sidebar items, `rounded-full` for badges

### Themes

Three premium themes, each with light and dark variants:

| Theme               | Vibe                                  |
| ------------------- | ------------------------------------- |
| **Iridescent Void** | Futuristic, expensive, slightly alien |
| **Carbon**          | Stark, modern, performance-focused    |
| **Deep Purple**     | Minimal cool, elegant, grape-violet   |

All themes define the same set of CSS custom properties. Components must use semantic
tokens (`bg-accent`, `text-muted-foreground`) — never theme-specific values.

---

## 3. Component Patterns

### API Conventions

Every UI primitive follows these rules:

```tsx
// 1. data-slot for DOM identification
<div data-slot="badge" ... />

// 2. CVA for variant management
const buttonVariants = cva("base classes", {
  variants: { variant: { ... }, size: { ... } },
  defaultVariants: { variant: "default", size: "default" },
});

// 3. cn() for conditional class merging
<div className={cn("base", isActive && "active-class")} />

// 4. Composite pattern for complex components
<Select>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectPopup>
    <SelectItem value="a">A</SelectItem>
  </SelectPopup>
</Select>
```

### Focus States

All interactive elements use the same focus ring:

```
focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

### Disabled States

```
disabled:pointer-events-none disabled:opacity-50
```

### Animation Rules

- **Transitions:** `transition-colors` or `transition-shadow` — never `transition-all`
  unless specifically needed for layout shifts.
- **Durations:** 150ms for hover, 200ms for modals/drawers.
- **Reduced motion:** Always respect `prefers-reduced-motion`. Use Tailwind's
  `motion-reduce:` prefix or the existing `.no-transitions` guard.
- **No decorative animation.** Animations must communicate state change (opening,
  closing, loading). Pulse is reserved for "Working" status indicators.

---

## 4. Sidebar Rules

The sidebar is the primary navigation surface. These rules are non-negotiable:

### Thread Row Layout

```
[StatusIcon]  [Title]                              [DiffStats]
              [branch-name]                        [PR badge]
```

- **Line 1:** Status icon (3.5px) + editable title + right-aligned diff stats
- **Line 2:** Branch name in muted text + right-aligned PR badge (if applicable)
- Single-line fallback when no branch is set (title-only row)
- Active row: `bg-accent/60 text-foreground`
- Selected row: `bg-accent/40 text-foreground`
- Default row: `text-muted-foreground hover:bg-accent/40`

### Project Header Layout

```
[ProjectName] (threadCount)                 [+ New Thread]
```

- Thread count shown as `(N)` in muted text next to the project name
- Color-coded background per project via `getProjectColor()`
- Collapsible with "Show more" / "Show less" for 10+ threads

### Data Freshness

- Thread metadata (branch, PR, diff stats) rendered from existing store data
- No additional network requests from the sidebar — use data already fetched
- PR status polled per-cwd at 60s intervals (existing `threadGitStatusQueries`)

---

## 5. Branch Picker Rules

The branch picker is a `Combobox` dropdown. These rules apply:

### Structure

```
[Search input]                    [Fetch button]
─────────────────────────────────────────────────
Recent Branches
  main                            [current] [default]
  feature/foo                     [worktree]
─────────────────────────────────────────────────
All Branches
  bugfix/bar
  feature/baz                     [remote]
─────────────────────────────────────────────────
Create new branch "typed-query"   (when search has no exact match)
Checkout Pull Request #123        (when search matches PR ref pattern)
```

- **Recent branches** at top (3-5 most recently switched-to, tracked in localStorage)
- **All branches** below, with local branches first, then remote-only branches
  separated by a subtle divider
- **Remote branches** shown only when they have no local counterpart
  (via existing `dedupeRemoteBranchesWithLocalMatches`)
- **Badges** per branch: `current`, `default`, `worktree`, `remote`, `stash N`
- **Create branch** allows specifying a base: when a branch is highlighted,
  creating a new branch uses the highlighted branch as the starting point
- **Fetch button** in the picker header refreshes remote refs

### Data Rules

- Branch list virtualized at 40+ items (existing behavior)
- No per-branch ahead/behind counts (too expensive to compute for all branches)
- Ahead/behind shown only for the current branch in the toolbar (existing behavior)

---

## 6. Git Actions Rules

Git operations follow the "stacked action" pattern. The user always works with
a single flow:

```
[Quick action button]  [Dropdown menu with all actions]
```

Quick action resolves automatically based on git state:

- Has changes + no PR → "Commit, push & PR"
- Has changes + existing PR → "Commit & push"
- No changes + ahead → "Push & create PR"
- Behind upstream → "Pull" or "Sync branch"
- Conflicts → "Resolve conflicts"

**Never fragment git actions** into multiple surfaces. The branch picker handles
navigation (switching, creating, fetching). The git actions control handles
mutations (commit, push, PR).

---

## 7. Right Panel Rules

The right panel (`useRightPanelStore`) hosts context-dependent content:

- **Code viewer** — file browsing and editing
- **Diff panel** — unified diff for file changes
- **Workspace panel** — file tree

New panels should use the same toggle mechanism and respect the existing
split/stacked responsive layout (split at 600px+, stacked below).

---

## 8. Don'ts

1. **Don't add new modals** for information that could be inline or in a tooltip.
2. **Don't hide status behind clicks.** If the user needs to know it, show it.
3. **Don't add loading spinners** for operations under 200ms. Use optimistic updates.
4. **Don't add new Zustand stores** without justification. Prefer extending existing
   stores or using React Query for server state.
5. **Don't add new polling intervals.** Reuse existing git status queries (5s stale,
   15s refetch) or branch queries (15s stale, 60s refetch).
6. **Don't hardcode colors.** Use semantic tokens from the theme system.
7. **Don't break the memo contract.** When adding props to `MemoizedThreadRow`, add
   corresponding equality checks to the memo comparator.
8. **Don't add destructive actions to compact pickers.** Delete belongs in context
   menus with confirmation, not in branch dropdowns.
9. **Don't duplicate git actions.** Push belongs in GitActionsControl, not in the
   branch picker. Commit belongs in GitActionsControl, not in a right panel.
10. **Don't add features that require new server APIs** when the data already exists
    on the client. Compute derived values from existing queries.
