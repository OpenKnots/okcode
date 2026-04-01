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
