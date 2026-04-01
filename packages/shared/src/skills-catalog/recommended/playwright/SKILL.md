---
name: playwright
description: Automate real browsers from the terminal.
catalog_id: playwright
origin: bundled
version: 1.0.0
author: OK Code
tags:
  - browser
  - testing
  - automation
tools:
  - terminal
  - browser
---

# Playwright Skill

## When to use this skill

- Use when the task needs browser automation, UI verification, end-to-end testing, or scripted web interactions.
- Use when the user needs reproducible validation of browser behavior rather than manual spot-checking.
- Use when screenshots, DOM assertions, navigation flows, or form automation are part of the task.
- Use when the user wants a reliable browser-based regression check from the terminal.

## What this skill does

- Designs Playwright workflows that are deterministic, inspectable, and resilient to minor UI changes.
- Prefers stable selectors and event-driven waits over brittle timing assumptions.
- Captures actionable failure context such as URLs, selectors, screenshots, and expectation mismatches.
- Keeps test intent focused on behavior, not incidental implementation details.

## Implementation

- Clarify whether the goal is one-off browser automation, a reusable test, or a debugging workflow.
- Prefer semantic selectors and stable locators over deep CSS selectors tied to styling structure.
- Use assertions that reflect user-observable behavior rather than implementation accidents.
- Prefer waits based on navigation, visible UI state, or network/DOM readiness rather than arbitrary sleep intervals.
- If the task is exploratory, keep scripts short and focused on reproducing the target behavior.
- If the task is test authoring, structure steps and assertions so failures are easy to diagnose.
- Capture enough context on failure for a human to reproduce and fix the issue quickly.

## Best practices

- Avoid timing-based waits unless no stronger signal exists.
- Keep selectors robust and understandable.
- Prefer behavior-level assertions over snapshotting everything.
- Include screenshots or other evidence when reporting a browser failure.
- Keep scripts and tests maintainable; do not overfit to current DOM noise.
