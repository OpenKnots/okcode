# Workspace File Tree in OK Code

## Summary

Add a lightweight workspace file tree to the existing left sidebar so the active thread's project can be browsed without leaving OK Code.

This should feel like a minimal IDE explorer, not a second full file manager.

## Goals

- Show the active thread's workspace structure inside OK Code
- Keep the UI fast for large repos
- Reuse the existing workspace index / ignore handling already used by `@path` search
- Make files one click away from opening in the preferred editor
- Avoid rendering the full repository tree eagerly when only a few folders are expanded

## Non-goals (v1)

- Inline file editing inside OK Code
- Drag/drop rename or move operations
- Multi-select file operations
- Git decorations per file
- Context menus
- Full-text search from the tree

## UX

### Placement

- Reuse the existing left project/thread sidebar
- Only show the file tree for the **active project / active thread workspace**
- Render the tree **below the thread list** for that active project

### Behavior

- Top-level entries load automatically when the active project is visible
- Directories are expandable/collapsible
- Directory children load lazily when expanded
- Files open in the preferred editor when clicked
- The tree respects the same ignore behavior as workspace entry search (`.gitignore`, ignored directories, etc.)
- If the active thread is using a worktree, the file tree should browse the **worktree path**, not the base project root

### Visual style

- Match existing sidebar density and hierarchy
- Use VS Code-style icons already present in the app
- Use chevrons for expandable directories
- Keep labels monospace/subtle like the changed-files tree

## Technical design

### 1. Add a dedicated project directory-list API

Current `projects.searchEntries` is optimized for fuzzy `@path` search, not hierarchical browsing.

Add a new RPC:

- `projects.listDirectory`

Contracts:

- `ProjectListDirectoryInput`
  - `cwd: string`
  - `directoryPath?: string` (undefined = root)
- `ProjectDirectoryEntry`
  - existing `path`, `kind`, `parentPath`
  - `hasChildren: boolean`
- `ProjectListDirectoryResult`
  - `entries: ProjectDirectoryEntry[]`
  - `truncated: boolean`

### 2. Reuse the existing workspace index cache

Extend `apps/server/src/workspaceEntries.ts` so the cached workspace index can also answer directory-list requests.

Implementation notes:

- Build parent → children lookup maps once when the index is created
- Preserve existing search behavior for `searchWorkspaceEntries`
- Sort directory listings as:
  1. directories first
  2. then files
  3. alphabetical within each group

### 3. Add web query helpers

In `apps/web/src/lib/projectReactQuery.ts`:

- add `projectQueryKeys.listDirectory(...)`
- add `projectListDirectoryQueryOptions(...)`

These queries should share the existing `projectQueryKeys.all` prefix so current invalidation after turn diffs keeps the tree fresh.

### 4. Add a recursive sidebar tree component

Create a new component:

- `apps/web/src/components/WorkspaceFileTree.tsx`

Responsibilities:

- fetch root directory entries
- track expanded directory state
- lazily fetch nested directories with React Query
- open files in preferred editor on click
- show lightweight loading/error/empty states

### 5. Integrate into the existing sidebar

In `apps/web/src/components/Sidebar.tsx`:

- determine the active thread for each project while rendering
- if that project owns the active thread and is expanded, render the file tree below its thread rows
- use `thread.worktreePath ?? project.cwd` as the tree root

## Files expected to change

### Contracts / transport

- `packages/contracts/src/project.ts`
- `packages/contracts/src/ipc.ts`
- `packages/contracts/src/ws.ts`
- `apps/web/src/wsNativeApi.ts`

### Server

- `apps/server/src/workspaceEntries.ts`
- `apps/server/src/wsServer.ts`
- `apps/server/src/workspaceEntries.test.ts`

### Web

- `apps/web/src/lib/projectReactQuery.ts`
- `apps/web/src/components/Sidebar.tsx`
- `apps/web/src/components/WorkspaceFileTree.tsx`

## Verification

1. `bun fmt`
2. `bun lint`
3. `bun typecheck`
4. Verify active project shows a file tree in the sidebar
5. Expand nested folders and confirm lazy loading works
6. Click a file and confirm it opens in the preferred editor
7. Confirm ignored folders/files do not appear
8. Confirm worktree-backed threads browse the worktree instead of the base project

## Nice follow-ups

- Add a small filter box above the file tree
- Add “insert path into composer” on modifier-click or context menu
- Add git status badges in the tree
- Persist expanded directory state per project
- Add keyboard navigation
