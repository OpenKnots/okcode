---
name: openclaw-pr-ops
description: Queue, claim, hand off, and record OpenClaw PR maintainer work using the pr-ops layer.
version: 1.0.0
author: OK Code
tags:
  - openclaw
  - maintainer
  - pr-ops
  - pull-requests
tools:
  - terminal
  - filesystem
  - git
triggers:
  - use when the user asks to plan or queue PRs for OpenClaw
  - use when the user asks for the next PR to review
  - use when the user needs a Codex/Claude PR handoff prompt
  - use when the user asks to record merge, close, or defer decisions
  - use when the user mentions pr-ops, claims, queue, or stats
---

# OpenClaw PR Ops

Use this skill for the maintainer queue layer in the `openclaw/maintainers` repo.
The goal is to pick the next useful PR, prepare the reviewer handoff, and record
the final decision without doing GitHub write actions in pr-ops.

## Source of truth

- `openclaw/maintainers/README.md`
- `openclaw/maintainers/.agents/skills/PR_WORKFLOW.md`

## Core rules

- Keep the queue dedupe-first.
- Prefer claim-aware selection when multiple maintainers or agents are active.
- `pr-ops` plans and tracks work; the reviewer agent in `openclaw/openclaw`
  performs review, merge, and close actions.
- Do not merge or close PRs directly from this layer.

## Workflow

1. Refresh the queue with `scripts/pr-plan`.
2. Select the next item with `scripts/pr-next`.
3. Generate the reviewer prompt with `scripts/pr-handoff --tool codex`.
4. After the reviewer finishes, persist the outcome with
   `scripts/pr-decide --decision <merge|close_duplicate|close_not_planned|defer> --pr <number>`.
5. Check progress with `scripts/pr-stats`.

## Required handoff content

- Representative PR and URL
- Origin PR when the item is part of a cluster
- Cluster members and pending members
- Queue lane and rationale
- Policy flags, if any
- Explicit boundary: the reviewer agent does GitHub actions; pr-ops records state

## Decision rules

- `merge` for the PR that actually landed.
- `close_duplicate` for cluster duplicates that are now redundant.
- `close_not_planned` when the PR is not part of the current plan.
- `defer` only when the PR needs more time or a broader dependency is unresolved.
