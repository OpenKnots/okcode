---
name: github
description: Inspect repositories, PRs, issues, and CI workflows.
catalog_id: github
origin: bundled
version: 1.0.0
author: OK Code
tags:
  - github
  - pr
  - issues
tools:
  - github
---

# GitHub Skill

## When to use this skill

- Use when the task involves GitHub repositories, pull requests, issues, review threads, or CI checks.
- Use when the answer should be grounded in live repository state rather than memory or inference alone.
- Use when the user needs repository context before making code or process decisions.
- Use when reviewing changes, triaging issues, or diagnosing failing GitHub Actions workflows.

## What this skill does

- Uses GitHub as the source of truth for repository, PR, issue, and CI state whenever connector data is available.
- Optimizes for actionable review, triage, and debugging rather than generic summaries.
- Prioritizes bugs, regressions, missing tests, and concrete follow-ups during review tasks.
- Keeps findings tied to exact files, checks, PR metadata, or issue context when possible.

## Implementation

- Start by identifying whether the task is about repository context, issue triage, PR review, CI debugging, or publishing changes.
- Pull the relevant GitHub metadata before making conclusions about state, authorship, status, or changed files.
- For PR review, focus first on behavioral regressions, correctness, risk, and validation gaps.
- For CI failures, inspect failing checks and logs before proposing a fix.
- For issue or project triage, summarize the operational state and the next concrete action.
- Ground conclusions in the observed GitHub data and clearly label any inference.
- When code changes are involved, connect review comments to precise file paths or changed surfaces.

## Best practices

- Do not rely on stale assumptions when current GitHub data is available.
- Keep findings specific, evidence-based, and prioritized by severity.
- Prefer exact file references, check names, issue numbers, and PR identifiers.
- Separate repository facts from interpretation.
- Avoid noisy summaries when the user needs a clear next action.
