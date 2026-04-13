# Sidebar & Branch Picker Enhancements

## Summary

Enrich the sidebar thread items and branch picker with information-dense metadata
inspired by Superset and VS Code branch management UIs. All 8 features use data
that already exists on the client — no new server APIs required.

**Reference:** `DESIGN.md` (project root) for design rules and constraints.

---

## Features

| # | Feature | Component | Risk | New API? |
|---|---------|-----------|------|----------|
| 1 | Two-line thread items (branch subtitle) | Sidebar.tsx | Low | No |
| 2 | Diff stats per thread (+N -N) | Sidebar.tsx, Sidebar.logic.ts | Low | No |
| 3 | PR number badge inline | Sidebar.tsx | Low | No |
| 4 | Thread count in project header | Sidebar.tsx | Trivial | No |
| 5 | Recent branches at top of picker | BranchToolbarBranchSelector.tsx | Low | No |
| 6 | Fetch button in branch picker | BranchToolbarBranchSelector.tsx | Low | Yes (git.fetch) |
| 7 | Show remote branches grouped | BranchToolbarBranchSelector.tsx, BranchToolbar.logic.ts | Low-Med | No |
| 8 | "New Branch from X" base branch | BranchToolbarBranchSelector.tsx | Low | No |

---

## Feature 1: Two-Line Thread Items (Branch Subtitle)

### Goal

Show the thread's git branch name as a second line below the title, making it
possible to identify which branch a thread operates on without clicking into it.

### Data Source

- `thread.branch` (type: `string | null`) — already on every Thread object
- Already passed to `MemoizedThreadRow` via the `thread` prop

### Changes

**File: `apps/web/src/components/Sidebar.tsx`**

Modify `MemoizedThreadRow` (lines 375-446). Replace the current single-line layout:

```tsx
// BEFORE (line 421-444):
<ThreadIcon className={cn("size-3.5 shrink-0", threadIconColor)} />
<div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
  <EditableThreadTitle ... />
</div>
<CloudUploadIcon className="size-3.5 shrink-0 text-muted-foreground/30" />
```

With a two-line layout:

```tsx
// AFTER:
<ThreadIcon className={cn("size-3.5 shrink-0 mt-0.5", threadIconColor)} />
<div className="flex min-w-0 flex-1 flex-col gap-0 text-left">
  {/* Line 1: title + diff stats */}
  <div className="flex min-w-0 items-center gap-1.5">
    <EditableThreadTitle ... />
    {/* Feature 2: DiffStats go here */}
  </div>
  {/* Line 2: branch + PR badge (only when branch is set) */}
  {thread.branch ? (
    <div className="flex items-center justify-between gap-1">
      <span className="truncate text-[10px] leading-tight text-muted-foreground/50">
        {thread.branch}
      </span>
      {/* Feature 3: PR badge goes here */}
    </div>
  ) : null}
</div>
```

Remove the `CloudUploadIcon` — it serves no function and will be replaced by
diff stats and PR badges.

### Memo Comparator Update

Add `thread.branch` to the memo equality check (line 449-465):

```tsx
if (prev.thread.branch !== next.thread.branch) return false;
```

### Visual Result

**Thread with branch:**
```
[CircleDotIcon]  My thread title            +42 -7
                 feature/add-login         🔗 #123
```

**Thread without branch (draft, no git):**
```
[CircleDotIcon]  My thread title
```

---

## Feature 2: Diff Stats Per Thread (+N -N)

### Goal

Show aggregate lines added/deleted by the thread, right-aligned on the first line.

### Data Source

- `thread.turnDiffSummaries: TurnDiffSummary[]` — already on every Thread object
- Each summary has `files: TurnDiffFileChange[]` with `additions?: number` and
  `deletions?: number`
- Aggregate: sum all `additions` and `deletions` across all turns and files

### Changes

**File: `apps/web/src/components/Sidebar.logic.ts`**

Add a new pure function:

```tsx
export function aggregateThreadDiffStats(
  turnDiffSummaries: ReadonlyArray<TurnDiffSummary>,
): { additions: number; deletions: number } | null {
  let additions = 0;
  let deletions = 0;
  for (const summary of turnDiffSummaries) {
    for (const file of summary.files) {
      additions += file.additions ?? 0;
      deletions += file.deletions ?? 0;
    }
  }
  return additions === 0 && deletions === 0 ? null : { additions, deletions };
}
```

**File: `apps/web/src/components/Sidebar.tsx`**

Inside `MemoizedThreadRow`, compute and render:

```tsx
const diffStats = aggregateThreadDiffStats(thread.turnDiffSummaries);

// In the JSX, after <EditableThreadTitle>:
{diffStats ? (
  <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] leading-none">
    <span className="text-emerald-600">+{diffStats.additions}</span>
    <span className="text-rose-500">-{diffStats.deletions}</span>
  </span>
) : null}
```

### Memo Comparator Update

Add `thread.turnDiffSummaries` to the memo equality check:

```tsx
if (prev.thread.turnDiffSummaries !== next.thread.turnDiffSummaries) return false;
```

### Edge Cases

- Threads with no turns yet: `turnDiffSummaries` is empty → `null` → nothing rendered
- Threads with only additions: show `+42 -0`
- Very large numbers: use compact formatting if > 9999 (e.g., `+12.3k`)

---

## Feature 3: PR Number Badge Inline

### Goal

Show the PR number as a small clickable badge on line 2 of the thread row,
replacing the current icon-only indicator that hides details behind a tooltip.

### Data Source

- `prByThreadId: Map<ThreadId, ThreadPr>` — already computed and passed as prop
- `ThreadPr` includes `number`, `url`, `state`, `title`

### Changes

**File: `apps/web/src/components/Sidebar.tsx`**

Inside `MemoizedThreadRow`, after the branch name on line 2:

```tsx
{prStatus ? (
  <a
    href={prStatus.url}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(event) => event.stopPropagation()}
    className={cn(
      "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5",
      "text-[10px] leading-none transition-colors hover:underline",
      prStatus.label === "PR open" && "text-emerald-600",
      prStatus.label === "PR merged" && "text-violet-600",
      prStatus.label === "PR closed" && "text-muted-foreground/50",
    )}
    title={prStatus.tooltip}
  >
    <prStatus.icon className="size-2.5" />
    #{prByThreadId.get(thread.id)?.number}
  </a>
) : null}
```

### ThreadIcon Simplification

With the PR badge now visible inline, the `ThreadIcon` at the start of the row
should revert to always using the **thread status icon** (Working, Error,
Completed, etc.) regardless of PR state. The PR icon was overloading the status
icon because there was nowhere else to show PR info — that constraint is now gone.

Update the icon resolution (lines 354-367):

```tsx
// BEFORE: PR icon overrides thread status icon
const ThreadIcon = prStatus ? prStatus.icon : ...

// AFTER: Always use thread status icon
const ThreadIcon = threadStatus?.label === "Completed"
  ? CheckCircleIcon
  : threadStatus?.label === "Error"
    ? XCircleIcon
    : ...  // (rest unchanged, remove prStatus override)

const threadIconColor = threadStatus ? threadStatus.colorClass : "text-muted-foreground/50";
```

---

## Feature 4: Thread Count in Project Header

### Goal

Show the number of threads per project next to the project name, like `superset (10)`.

### Data Source

- `projectThreads` (line 1319) — already computed as
  `sortedThreadsByProjectId.get(project.id)`

### Changes

**File: `apps/web/src/components/Sidebar.tsx`**

In `renderProjectItem`, after the project name span (line 1389-1404):

```tsx
// BEFORE:
<span className={cn("block truncate text-xs font-semibold", ...)}>
  {project.name}
</span>

// AFTER:
<span className={cn("block truncate text-xs font-semibold", ...)}>
  {project.name}
  {projectThreads.length > 0 ? (
    <span className="ml-1 font-normal text-muted-foreground/50">
      ({projectThreads.length})
    </span>
  ) : null}
</span>
```

### Notes

- Count includes draft threads (already merged into `sidebarThreads`)
- When collapsed, count gives a quick sense of project activity
- No conditional logic — always shown when threads exist

---

## Feature 5: Recent Branches at Top of Picker

### Goal

Show the 5 most recently used branches at the top of the branch picker dropdown,
separated from the full list by a subtle divider.

### Data Source

- New: `localStorage` key `okcode:recent-branches:v1`
- Format: `Record<string, string[]>` keyed by project cwd, values are branch names
  (most recent first, max 5)

### Changes

**File: `apps/web/src/components/BranchToolbar.logic.ts`**

Add recent branches storage helpers:

```tsx
const RECENT_BRANCHES_KEY = "okcode:recent-branches:v1";
const MAX_RECENT_BRANCHES = 5;

export function getRecentBranches(cwd: string): ReadonlyArray<string> {
  try {
    const stored = localStorage.getItem(RECENT_BRANCHES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Record<string, string[]>;
    return parsed[cwd]?.slice(0, MAX_RECENT_BRANCHES) ?? [];
  } catch {
    return [];
  }
}

export function trackRecentBranch(cwd: string, branchName: string): void {
  try {
    const stored = localStorage.getItem(RECENT_BRANCHES_KEY);
    const parsed: Record<string, string[]> = stored ? JSON.parse(stored) : {};
    const existing = parsed[cwd] ?? [];
    const updated = [branchName, ...existing.filter((name) => name !== branchName)]
      .slice(0, MAX_RECENT_BRANCHES);
    parsed[cwd] = updated;
    localStorage.setItem(RECENT_BRANCHES_KEY, JSON.stringify(parsed));
  } catch {
    // Silent fail — non-critical feature
  }
}
```

**File: `apps/web/src/components/BranchToolbarBranchSelector.tsx`**

1. Call `trackRecentBranch(branchCwd, selectedBranchName)` inside `selectBranch`
   and `createBranch` after successful operations.

2. Partition `filteredBranchPickerItems` into recent and rest:

```tsx
const recentBranchNames = useMemo(
  () => (branchQueryCwd ? getRecentBranches(branchQueryCwd) : []),
  [branchQueryCwd, isBranchMenuOpen], // re-read when picker opens
);

const { recentItems, remainingItems } = useMemo(() => {
  if (normalizedDeferredBranchQuery.length > 0 || recentBranchNames.length === 0) {
    return { recentItems: [], remainingItems: filteredBranchPickerItems };
  }
  const recentSet = new Set(recentBranchNames);
  const recent = filteredBranchPickerItems.filter(
    (item) => recentSet.has(item) && !item.startsWith("__"),
  );
  const rest = filteredBranchPickerItems.filter(
    (item) => !recentSet.has(item) || item.startsWith("__"),
  );
  return { recentItems: recent, remainingItems: rest };
}, [filteredBranchPickerItems, normalizedDeferredBranchQuery, recentBranchNames]);
```

3. Render with divider in the `ComboboxList`:

```tsx
{/* Special items (PR checkout) */}
{/* Recent branches section */}
{recentItems.length > 0 && (
  <>
    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50">
      Recent
    </div>
    {recentItems.map((item, index) => renderPickerItem(item, index))}
    <div className="my-0.5 border-t border-border/30" />
  </>
)}
{/* All branches */}
{remainingItems.map((item, index) =>
  renderPickerItem(item, recentItems.length + index)
)}
```

### Notes

- When searching, recent grouping is suppressed — filter applies to flat list
- Recent branches that no longer exist in the branch list are silently skipped
- Virtual scrolling index math accounts for the section header + divider

---

## Feature 6: Fetch Button in Branch Picker

### Goal

Add a fetch button in the branch picker header that refreshes remote refs,
so users can discover new remote branches without leaving the picker.

### Server API

This is the **only feature requiring a new server API**.

**File: `packages/contracts/src/git.ts`**

Add input/result schemas:

```tsx
export const GitFetchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
});
export type GitFetchInput = typeof GitFetchInput.Type;

export const GitFetchResult = Schema.Struct({
  status: Schema.Literal("fetched", "failed"),
});
export type GitFetchResult = typeof GitFetchResult.Type;
```

**File: `apps/server/src/...` (git service)**

Implement `git.fetch`:

```tsx
async fetch(input: GitFetchInput): Promise<GitFetchResult> {
  // Run: git fetch --prune
  // Return { status: "fetched" } or { status: "failed" }
}
```

**File: `apps/web/src/lib/gitReactQuery.ts`**

Add mutation:

```tsx
export function gitFetchMutationOptions(input: {
  cwd: string | null;
  queryClient: QueryClient;
}) {
  return {
    mutationKey: ["git", "mutation", "fetch", input.cwd],
    mutationFn: async () => {
      const api = readNativeApi();
      if (!api || !input.cwd) throw new Error("No API or CWD");
      return api.git.fetch({ cwd: input.cwd });
    },
    onSettled: () => invalidateGitQueries(input.queryClient),
  };
}
```

### UI Changes

**File: `apps/web/src/components/BranchToolbarBranchSelector.tsx`**

Add a fetch button next to the search input in the picker header:

```tsx
<div className="flex items-center gap-1 border-b p-1">
  <ComboboxInput
    className="[&_input]:font-sans rounded-md flex-1"
    inputClassName="ring-0"
    placeholder="Search branches..."
    showTrigger={false}
    size="sm"
    value={branchQuery}
    onChange={(event) => setBranchQuery(event.target.value)}
  />
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          type="button"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-accent hover:text-foreground"
          onClick={() => fetchMutation.mutate()}
          disabled={fetchMutation.isPending}
        >
          {fetchMutation.isPending ? (
            <LoaderIcon className="size-3.5 animate-spin" />
          ) : (
            <RefreshCwIcon className="size-3.5" />
          )}
        </button>
      }
    />
    <TooltipPopup side="bottom">Fetch remote branches</TooltipPopup>
  </Tooltip>
</div>
```

---

## Feature 7: Show Remote Branches Grouped

### Goal

Show remote-only branches (those without a local counterpart) in a separate
section of the branch picker, making remote branches discoverable.

### Data Source

- `dedupeRemoteBranchesWithLocalMatches()` — **already exists** in
  `BranchToolbar.logic.ts` (line 115-141) but is not wired into the picker
- `filterSelectableBranches()` currently filters out all remote branches (line 74-78)

### Changes

**File: `apps/web/src/components/BranchToolbarBranchSelector.tsx`**

Replace the current filtering logic:

```tsx
// BEFORE (line 98-101):
const branches = useMemo(
  () => filterSelectableBranches(branchesQuery.data?.branches ?? []),
  [branchesQuery.data?.branches],
);

// AFTER:
const allBranches = branchesQuery.data?.branches ?? [];
const localBranches = useMemo(
  () => filterSelectableBranches(allBranches),
  [allBranches],
);
const remoteOnlyBranches = useMemo(
  () => dedupeRemoteBranchesWithLocalMatches(allBranches).filter((b) => b.isRemote),
  [allBranches],
);
```

Build two separate name lists and combine them with a sentinel separator:

```tsx
const REMOTE_DIVIDER = "__remote_divider__";

const branchPickerItems = useMemo(() => {
  const items: string[] = [];
  // Special items (PR checkout)
  if (checkoutPullRequestItemValue) items.push(checkoutPullRequestItemValue);
  // Local branches
  items.push(...localBranchNames);
  // Create branch action
  if (createBranchItemValue && !hasExactBranchMatch) items.push(createBranchItemValue);
  // Remote divider + remote branches
  if (remoteOnlyBranches.length > 0) {
    items.push(REMOTE_DIVIDER);
    items.push(...remoteOnlyBranches.map((b) => b.name));
  }
  return items;
}, [localBranchNames, remoteOnlyBranches, ...]);
```

Render the divider in `renderPickerItem`:

```tsx
if (itemValue === REMOTE_DIVIDER) {
  return (
    <div key="remote-divider" className="px-2 py-1 text-[10px] font-medium text-muted-foreground/50" style={style}>
      Remote
    </div>
  );
}
```

Update the branch lookup map to include remote branches:

```tsx
const branchByName = useMemo(
  () => new Map([...localBranches, ...remoteOnlyBranches].map((b) => [b.name, b] as const)),
  [localBranches, remoteOnlyBranches],
);
```

### Filtering Behavior

When the user types a search query, filter applies across both local and remote
branches. The "Remote" divider is hidden during search (same as "Recent" in
Feature 5).

---

## Feature 8: "New Branch from X" Base Branch

### Goal

When creating a new branch, use the currently highlighted branch in the picker
as the starting point instead of always branching from HEAD.

### Data Source

- Highlighted branch tracked by Combobox via `onItemHighlighted` callback
  (line 419-422)
- `git.createBranch` API — check if it supports a `startPoint` parameter

### Changes

**File: `packages/contracts/src/git.ts`**

Check/extend `GitCreateBranchInput`:

```tsx
export const GitCreateBranchInput = Schema.Struct({
  cwd: TrimmedNonEmptyStringSchema,
  branch: TrimmedNonEmptyStringSchema,
  startPoint: Schema.optional(TrimmedNonEmptyStringSchema), // NEW — base branch or commit
});
```

**File: Server git implementation**

Update `createBranch` to pass `startPoint`:

```bash
# BEFORE: git branch <name>
# AFTER:  git branch <name> [startPoint]
```

**File: `apps/web/src/components/BranchToolbarBranchSelector.tsx`**

1. Track the highlighted branch:

```tsx
const [highlightedBranchName, setHighlightedBranchName] = useState<string | null>(null);

// In Combobox:
onItemHighlighted={(value, eventDetails) => {
  setHighlightedBranchName(value && !value.startsWith("__") ? value : null);
  // ... existing scroll logic
}}
```

2. Pass the highlighted branch as startPoint in `createBranch`:

```tsx
const createBranch = (rawName: string) => {
  // ...existing validation...
  const startPoint = highlightedBranchName ?? undefined;

  runBranchAction(async () => {
    setOptimisticBranch(name);
    try {
      await api.git.createBranch({ cwd: branchCwd, branch: name, startPoint });
      // ...rest unchanged...
    }
  });
};
```

3. Update the "Create new branch" item label to show the base:

```tsx
<ComboboxItem ...>
  <span className="truncate">
    Create "{trimmedBranchQuery}"
    {highlightedBranchName ? (
      <span className="text-muted-foreground/50"> from {highlightedBranchName}</span>
    ) : null}
  </span>
</ComboboxItem>
```

---

## Implementation Order

Recommended sequence to minimize conflicts and enable incremental review:

### Phase 1: Sidebar Thread Enrichment (Features 1-4)

These four changes are all in `Sidebar.tsx` + `Sidebar.logic.ts` and can be done
in a single PR. They are purely additive — no behavior changes, no new APIs.

1. **Feature 4** first (thread count) — trivial, 1-line change, validates the PR workflow
2. **Feature 1** (two-line layout) — structural change to ThreadRow, needed before 2 and 3
3. **Feature 2** (diff stats) — adds `aggregateThreadDiffStats` + renders on line 1
4. **Feature 3** (PR badge) — adds badge on line 2, simplifies ThreadIcon

### Phase 2: Branch Picker Enhancements (Features 5-8)

These four changes are in `BranchToolbarBranchSelector.tsx` + `BranchToolbar.logic.ts`
and can be done in a second PR.

5. **Feature 7** (remote branches grouped) — biggest structural change to the picker,
   do first so 5 and 6 build on top
6. **Feature 5** (recent branches) — adds localStorage tracking + section grouping
7. **Feature 8** (new branch from X) — extends create-branch with startPoint
8. **Feature 6** (fetch button) — only feature needing a new server API, do last

### Phase 3: Tests & Polish

- Add unit tests for `aggregateThreadDiffStats` and `getRecentBranches`/`trackRecentBranch`
- Add test for `dedupeRemoteBranchesWithLocalMatches` integration into picker items
- Verify memo comparator correctness with branch/diff changes
- Verify virtual scrolling still works with section dividers
- Cross-theme visual QA (all 6 themes, light + dark)

---

## Files Modified (Summary)

| File | Features | Type of Change |
|------|----------|---------------|
| `apps/web/src/components/Sidebar.tsx` | 1, 2, 3, 4 | Layout, rendering |
| `apps/web/src/components/Sidebar.logic.ts` | 2 | New pure function |
| `apps/web/src/components/BranchToolbarBranchSelector.tsx` | 5, 6, 7, 8 | Layout, data, state |
| `apps/web/src/components/BranchToolbar.logic.ts` | 5 | New localStorage helpers |
| `packages/contracts/src/git.ts` | 6, 8 | Schema additions |
| `apps/web/src/lib/gitReactQuery.ts` | 6 | New mutation |
| Server git service | 6, 8 | New fetch endpoint, extend createBranch |

---

## Testing Checklist

- [ ] Sidebar thread with branch shows two-line layout
- [ ] Sidebar thread without branch shows single-line layout (no empty second line)
- [ ] Diff stats show correct aggregate across all turns
- [ ] Diff stats handle zero additions or zero deletions gracefully
- [ ] PR badge is clickable and opens PR URL
- [ ] PR badge shows correct state color (open/merged/closed)
- [ ] Thread count updates when threads are added/removed
- [ ] Thread count includes draft threads
- [ ] Recent branches section appears with correct ordering
- [ ] Recent branches are suppressed during search
- [ ] Fetch button spins during fetch and refreshes branch list
- [ ] Remote branches appear below "Remote" divider
- [ ] Remote branches with local counterparts are hidden
- [ ] "Create branch from X" shows highlighted branch name
- [ ] New branch created from highlighted base is correct (`git log` check)
- [ ] Virtual scrolling works with section dividers
- [ ] All features render correctly in all 6 themes (light + dark)
- [ ] Memo comparator prevents unnecessary re-renders
- [ ] Keyboard navigation through recent → all → remote sections works
