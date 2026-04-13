---
name: openclaw-pr-review
description: Review OpenClaw PRs for correctness, scope, tests, docs, and security before any fixes are made.
version: 1.0.0
author: OK Code
tags:
  - openclaw
  - maintainer
  - pr-review
  - code-review
tools:
  - terminal
  - filesystem
  - git
triggers:
  - use when the user asks to review an OpenClaw PR
  - use when the user wants findings before fixing code
  - use when the user says review-pr or pr review
  - use when the user asks for review-only, not implementation
---

# OpenClaw PR Review

Use this skill to review a PR without changing code.
The output should be a clear recommendation plus actionable findings.

## Source of truth

- `openclaw/maintainers/.agents/skills/PR_WORKFLOW.md`
- `openclaw/maintainers/README.md`
- Repo-local policy in the target repo, especially `AGENTS.md`

## Review mode

- Stay on review-only paths.
- Prefer `gh pr view` and `gh pr diff` over ad hoc exploration.
- Do not switch branches or mutate the target codebase during review.

## What to check

- Does the PR solve a real problem?
- Is the implementation the best scoped fix?
- Are tests meaningful and sufficient?
- Are docs, changelog, and user-facing notes updated when required?
- Are there correctness, security, or trust-boundary issues?

## Output shape

- Recommendation: `ready`, `needs work`, `needs discussion`, or `close`
- Findings ordered by severity
- Test coverage and validation gaps
- Any follow-up questions or required assumptions

## Stop conditions

- Do not approve behavior you cannot verify.
- Stop if the problem statement is unclear or unconfirmed.
- Escalate if the fix would require broad architecture changes outside the PR scope.
