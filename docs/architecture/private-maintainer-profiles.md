# Private maintainer profiles for PR review

OK Code can now load a PR review workflow from a **user-local profile** instead of requiring `.okcode/` files in the target repo.

This keeps private maintainer workflows out of public repositories while still letting the PR Review UI drive the same local scripts and docs.

## Location

Profiles live under:

```txt
$OKCODE_HOME/pr-review-profiles/*.md
```

If `OKCODE_HOME` is unset, that defaults to:

```txt
~/.okcode/pr-review-profiles/*.md
```

## OpenClaw maintainer profile

Current built-in adapter:

- `adapter: openclawMaintainer`

This adapter is intended for repositories like `openclaw/openclaw`, where the maintainer workflow lives in a private local `maintainers` checkout.

### Example

```md
---
id: openclaw-maintainer
title: OpenClaw Maintainer Workflow
repositories:
  - openclaw/openclaw
adapter: openclawMaintainer
maintainersRepo: ~/Documents/GitHub/OpenClaw/maintainers
---

Load the private OpenClaw maintainer workflow and run the local wrapper scripts.
```

## Behavior

When the active repo matches a local profile and no repo-local `.okcode/` workflow exists, OK Code will:

1. Load the private maintainer workflow from the local profile.
2. Read the local maintainer docs and skills from the configured `maintainersRepo`.
3. Project them into OK Code's internal PR workflow model.
4. Expose runnable workflow steps in the PR Review UI.

For the OpenClaw adapter, the PR Review steps run these local commands from `maintainersRepo`:

- `scripts/pr-review <PR>`
- `scripts/pr-prepare run <PR>`
- `scripts/pr-merge run <PR>`

## Privacy model

- No `.okcode/` files are required in the public repo.
- No maintainer workflow files are copied into the public repo.
- The workflow remains local to the maintainer machine.

Repo-local `.okcode/` config still takes precedence when present.
