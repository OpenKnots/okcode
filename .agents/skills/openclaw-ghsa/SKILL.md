---
name: openclaw-ghsa
description: Handle OpenClaw GHSA work with speed-first, low-noise maintainer coordination and direct-to-main judgment.
version: 1.0.0
author: OK Code
tags:
  - openclaw
  - maintainer
  - ghsa
  - security
tools:
  - terminal
  - filesystem
  - git
triggers:
  - use when the user asks about OpenClaw GHSA handling
  - use when the user asks to coordinate a security fix
  - use when the user mentions maintainer-security-ops
  - use when the user asks for a fast security workflow
---

# OpenClaw GHSA

Use this skill for maintainer-facing security fixes and coordination.
Security work is treated differently from normal PR flow.

## Source of truth

- `openclaw/maintainers/security/README.md`
- `openclaw/openclaw/SECURITY.md`
- `openclaw/maintainers/README.md`

## Rules

- Speed first.
- Usually go directly to `main` instead of opening a normal PR.
- Keep public metadata vague while the fix rolls out.
- Keep real discussion in maintainer channels, not in GHSA comments.
- Only the designated owner should make GHSA state changes.

## Coordination

- Post the GHSA link in `maintainer-security-ops` when you pick it up.
- Mark it complete or update the coordination thread when the fix lands.
- Ask for help early if the scope or exploit path is unclear.
