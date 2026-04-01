# Marketing App

## Prerequisites

- Install monorepo dependencies from the repo root before running marketing scripts:

```bash
bun install
```

## Build

```bash
bun run build:marketing
```

If the build fails with:

```text
/bin/bash: next: command not found
```

rerun:

```bash
bun install
bun run build:marketing
```

This usually means the workspace dependencies were not yet installed for the current environment.

If you see a build error about `CodeBlock.tsx` or `GetStarted.tsx` importing `useState`/`useEffect` in a Server Component:

- You are likely running an older marketing checkout where those components still exist.
- Switch to the current branch in this PR (`fix-marketing-build-errors`) and rerun install/build.
- In that older snapshot, the fix is to add `"use client"` at the top of those client-only components.
