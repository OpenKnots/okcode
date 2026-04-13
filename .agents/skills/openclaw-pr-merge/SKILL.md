---
name: openclaw-pr-merge
description: Perform deterministic OpenClaw PR merge, verify merged state, and clean up after landing.
version: 1.0.0
author: OK Code
tags:
  - openclaw
  - maintainer
  - pr-merge
  - git
tools:
  - terminal
  - filesystem
  - git
triggers:
  - use when the user asks to merge an OpenClaw PR
  - use when the user says merge-pr
  - use when the user wants the PR landed and cleaned up
  - use when the user asks for a deterministic squash merge flow
---

# OpenClaw PR Merge

Use this skill only after review and prepare are complete.
The goal is a deterministic landing with verification, attribution, and cleanup.

## Source of truth

- `openclaw/maintainers/.agents/skills/PR_WORKFLOW.md`
- Repo-local policy in the target repo, especially `AGENTS.md`

## Merge rules

- Merge only when findings are resolved and checks are green.
- Prefer deterministic squash merge flow with explicit subject/body.
- Verify the PR ends in `MERGED` state.
- Do not use auto-merge to bypass maintainer judgment.

## After merge

- Leave a PR comment that explains what was merged and include the SHAs.
- Clean up the PR worktree.
- Run contributor attribution updates when a new contributor landed and the repo
  policy requires it.

## Go / no-go

- Required checks are green or intentionally absent.
- Branch is not behind `main` in a way that matters for the merge.
- Review and prep artifacts exist and are consistent.
