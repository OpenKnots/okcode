# Product Scope

## Completion Scope

This cleanup pass is complete when all of the following are true:

- Clicking a project opens one canonical project chat for that project.
- Project chat is branch-agnostic and clearly separate from branch/worktree threads.
- The sidebar makes that model obvious: project row opens project chat, child rows are normal threads.
- Unfinished product surfaces are removed instead of exposed as placeholders.
- Provider support remains broad, but the UX is capability-first rather than provider-first.
- Optional server capabilities are lazy-loaded instead of inflating the default startup path.
- Clearly dead UI and low-value template baggage no longer ships in the main app.

## Explicit Anti-Scope

These are intentionally out of scope for this pass:

- Moving `apps/mobile` or `apps/marketing` out of the repo
- Removing providers from the supported matrix
- Building a new plugin-management product beyond the existing skills surface
- Adding a second backend session model outside the existing thread/orchestration system
- Branch-specific variants of project chat
- Making project chat behave like full worktree orchestration
- Rewriting historical SQLite migrations
- Shipping placeholder routes, RPCs, settings panels, or contracts for future ideas

## Product Boundaries

OK Code is a Codex-first local orchestration app with a shared chat architecture.

Core product:

- Project-level chat
- Branch/worktree thread chat
- Provider session orchestration
- File, git, terminal, and settings workflows needed to support the chat experience

Secondary but retained:

- PR review flows
- Skill management
- Multi-provider support behind the same core chat surface

Not a product goal for now:

- Multiple independent chat products per project
- Placeholder plugin marketplaces
- Device-pairing bundle workflows beyond the existing pairing-link path
- Experimental decision-workspace products

## Provider Policy

Supported provider matrix:

- Codex
- Claude Code
- GitHub Copilot
- Gemini CLI
- OpenClaw

Shared provider contract:

- Auth and health visibility
- Model selection
- Turn send and interrupt
- Approval requests
- User-input requests
- Runtime mode display
- Interaction mode display
- Session health and error reporting

Provider-specific behavior is only justified when it changes real setup or runtime behavior:

- Codex: default project-chat path and GPT/Codex OAuth posture
- Claude Code: permission and thinking controls
- GitHub Copilot: binary and config-directory overrides
- Gemini CLI: binary and credential diagnostics
- OpenClaw: gateway configuration and live gateway testing

## Future Scope Guidance

Likely future scope:

- Better provider capability docs
- Clearer support tiers
- Better project-chat ergonomics
- Stronger project defaults and thread/project switching

Conditional scope:

- Provider de-scoping
- Project-chat-only primary mode
- Tighter PR-review integration
- A stronger plugin platform

Unlikely scope without strong evidence:

- Multiple parallel chat products per project
- Mobile local execution
- Provider-specific project chat shells

## Move-The-Needle Signals

Future expansion or contraction should be driven by:

- Adoption by provider
- Support burden by provider
- CI or runtime instability per capability
- PR volume spent on optional surfaces
- Bundle size and startup impact
- User confusion in navigation or settings
- Time spent maintaining low-usage features versus core orchestration

## Maintenance Rules

- New product ideas must start hidden until they are actually supportable.
- Shared capabilities belong in shared UI and shared contracts first.
- Provider-specific UI needs a concrete behavior reason, not just provider branding.
- If a feature cannot justify long-term support cost, keep it out of the default product surface.
