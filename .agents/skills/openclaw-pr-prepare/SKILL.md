---
name: openclaw-pr-prepare
description: Fix OpenClaw PR findings on the PR head branch, run gates, and make the branch ready for merge.
version: 1.0.0
author: OK Code
tags:
  - openclaw
  - maintainer
  - pr-prepare
  - implementation
tools:
  - terminal
  - filesystem
  - git
triggers:
  - use when the user asks to prepare an OpenClaw PR for merge
  - use when the user asks to fix review findings on a PR
  - use when the user says prepare-pr
  - use when the user wants the PR head branch updated and gated
---

# OpenClaw PR Prepare

Use this skill after review findings exist and the PR needs implementation work.
The job is to make the PR merge-ready on its head branch, not to merge it.

## Source of truth

- `openclaw/maintainers/.agents/skills/PR_WORKFLOW.md`
- Repo-local policy in the target repo, especially `AGENTS.md`

## Working rules

- Start from the PR head branch.
- Fix blocker and important findings first.
- Reuse existing logic where possible instead of adding parallel code paths.
- Keep types strict and boundaries validated.
- Prefer root-cause fixes over local patches.

## Gates

- Run the repo-local gate set before declaring ready.
- In OpenClaw, default to `pnpm build`, `pnpm check`, and `pnpm test`
  unless the repo-local policy explicitly allows a docs-only exception.
- Treat unrelated baseline failures as background noise only when they are
  reproduced on `origin/main` and are clearly not caused by the PR.

## Commit hygiene

- Use concise, action-oriented commit subjects.
- Keep changes grouped by concern.
- Add changelog or docs updates when repo policy requires them.

## Exit criteria

- Findings resolved or explicitly deferred with reason.
- Verification run and recorded.
- Branch is ready for `/merge-pr`.
