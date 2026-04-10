# Plan: Stable LM Studio Support via Local Server and LM Link

## Goal

Enable OK Code to use LM Studio reliably as the model backend for existing agent providers, with a setup flow that is explicit, testable, and predictable for:

- on-machine LM Studio usage
- LM Link-backed usage where requests still go through the local LM Studio server
- an advanced manual endpoint fallback when the same LM Studio API surface is reachable elsewhere

The user-visible result should be:

- a clear LM Studio setup surface in Settings
- explicit connection diagnostics before a thread starts
- predictable runtime behavior when a thread is using LM Studio
- no behavior change for users who keep using the current default provider paths

## Recommended Product Shape

Treat LM Studio as a backend/connection profile for existing providers, not as a new top-level provider kind.

Specifically:

- `claudeAgent` can run against LM Studio via LM Studio's Anthropic-compatible endpoint.
- `codex` can run against LM Studio through Codex custom-provider mode, using an isolated `CODEX_HOME` managed by OK Code.
- `openclaw` stays unchanged.

This is the least-widening design.

Why:

- OK Code's provider model is agent-runtime-oriented today. `codex`, `claudeAgent`, and `openclaw` are not just model endpoints; they own approvals, streaming semantics, interrupts, recovery, and event normalization.
- LM Studio is an inference server, not a coding-agent runtime. A first-class `lmstudio` provider would force OK Code to invent a new agent loop or degrade existing agent semantics.
- LM Studio's own docs make LM Link a routing mode behind the local server surface, not a separate API contract. From OK Code's perspective, the API target can stay local while diagnostics explain whether the actual model execution is local or routed over LM Link.

## External Facts That Should Drive the Design

- LM Studio exposes OpenAI-compatible and Anthropic-compatible HTTP endpoints from its local server.
- LM Studio can require authentication with an API token.
- LM Studio supports LM Link, but requests can still go to `localhost`; LM Studio handles routing to the preferred linked device.
- Claude Code has a documented LM Studio path using `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`.
- LM Studio exposes model listing endpoints, so OK Code should not rely on static built-in model lists when LM Studio is active.

## Scope

### In Scope

- Add first-class LM Studio setup and diagnostics to OK Code.
- Allow `claudeAgent` and `codex` sessions to opt into LM Studio as their backend.
- Support local on-machine LM Studio and LM Link-backed local routing through the same local endpoint.
- Support a manual base URL as an advanced fallback if the same LM Studio server surface is reachable elsewhere.
- Surface clear errors for server reachability, auth, model discovery, and LM Link status.
- Preserve current behavior when LM Studio is not selected.

### Out of Scope

- A new `lmstudio` provider kind.
- A generic "OpenAI-compatible provider marketplace" abstraction.
- Writing into the user's global `~/.codex/config.toml`.
- Reworking OpenClaw.
- Guaranteeing every local model can handle OK Code's full tool and attachment surface.
- Automatic inference of every per-model capability on day one.

## Current-State Constraints in This Repo

The repo is not currently shaped for "backend selection" under a provider. Important constraints:

- `ProviderKind` is hard-coded in [packages/contracts/src/orchestration.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/contracts/src/orchestration.ts).
- Model lists and model-option behavior are provider-scoped in [packages/contracts/src/model.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/contracts/src/model.ts) and [packages/shared/src/model.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/shared/src/model.ts).
- The web settings model is provider-specific in [apps/web/src/appSettings.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/appSettings.ts) and [apps/web/src/routes/\_chat.settings.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/routes/_chat.settings.tsx).
- Provider picker and traits UI are provider-specific in [apps/web/src/session-logic.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/session-logic.ts), [apps/web/src/components/chat/ProviderModelPicker.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/chat/ProviderModelPicker.tsx), and [apps/web/src/components/chat/composerProviderRegistry.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/chat/composerProviderRegistry.tsx).
- Provider health is CLI/gateway specific in [apps/server/src/provider/Layers/ProviderHealth.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderHealth.ts) and `doctor` only prints Codex and Claude readiness in [apps/server/src/doctor.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/doctor.ts).
- Session recovery persists provider bindings, but [apps/server/src/provider/Layers/ProviderSessionDirectory.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderSessionDirectory.ts) still special-cases only `codex` and `claudeAgent`.
- There is already useful precedent for Codex custom-provider mode in [apps/server/src/provider/Layers/ProviderHealth.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderHealth.ts) and [apps/server/src/sme/authValidation.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/sme/authValidation.ts).

## Product Behavior to Ship

### Settings

Add a new LM Studio section in Settings. It should let the user configure:

- whether LM Studio support is enabled at all
- whether `claudeAgent` should use LM Studio
- whether `codex` should use LM Studio
- connection mode:
  - `localhost`
  - `manual`
- base URL
- API token, if authentication is enabled in LM Studio
- whether LM Link diagnostics should be probed when `lms` is installed

The settings section should also expose:

- `Test connection`
- current reachability status
- auth status
- discovered models count
- last successful probe timestamp
- LM Link status:
  - unavailable
  - disconnected
  - connected
  - preferred device name when available

### Thread UX

When a thread is using LM Studio:

- the effective provider label should read `Claude Code via LM Studio` or `Codex via LM Studio`
- the model picker should be populated from LM Studio-discovered models, not the current hard-coded provider list
- provider-native knobs that are not predictable through LM Studio should be disabled or hidden with a short explanation

The default safe rule is:

- keep model selection
- hide or disable Codex service-tier / fast-mode controls
- hide or disable Claude effort / fast-mode / thinking toggles unless later verified to map predictably through LM Studio

### Failure Handling

Before a thread starts, users should get explicit failures for:

- LM Studio server unreachable
- token required but missing
- token invalid
- model list unavailable
- selected model missing
- LM Link diagnostics requested but the `lms` CLI is unavailable

During a running session:

- if LM Studio becomes unreachable, the thread should fail with a provider error that explicitly mentions the active backend is LM Studio
- recovery should not silently fall back to the default provider backend

## Architecture Decision

Introduce a narrow backend-selection concept under the existing providers.

Do not add a generic plugin system.

Recommended contract shape:

- Keep `ProviderKind` unchanged.
- Extend `ProviderStartOptions` with:
  - per-provider backend selection, limited to `"default"` or `"lmstudio"`
  - shared LM Studio connection options
- Persist the backend selection and a normalized backend fingerprint with the thread binding so recovered sessions cannot accidentally rebind to the wrong backend

Example of the concept, not the exact final schema:

```ts
type ProviderBackend = "default" | "lmstudio";

type LmStudioConnectionMode = "localhost" | "manual";

type LmStudioStartOptions = {
  enabled?: boolean;
  connectionMode?: LmStudioConnectionMode;
  baseUrl?: string;
  apiToken?: string;
  detectLinkStatus?: boolean;
};

type CodexProviderStartOptions = {
  binaryPath?: string;
  homePath?: string;
  backend?: ProviderBackend;
};

type ClaudeProviderStartOptions = {
  binaryPath?: string;
  permissionMode?: string;
  maxThinkingTokens?: number;
  backend?: ProviderBackend;
};
```

## Milestones

### Milestone 1: Shared LM Studio Diagnostics and Settings Foundation

Outcome:

- Settings can store LM Studio configuration.
- Server can probe LM Studio and report stable diagnostics.
- No runtime behavior changes yet unless explicitly enabled.

Work:

- Extend app settings in [apps/web/src/appSettings.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/appSettings.ts).
- Add LM Studio settings UI in [apps/web/src/routes/\_chat.settings.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/routes/_chat.settings.tsx).
- Add contracts for LM Studio config and diagnostics in:
  - [packages/contracts/src/orchestration.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/contracts/src/orchestration.ts)
  - [packages/contracts/src/server.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/contracts/src/server.ts)
- Add a dedicated LM Studio diagnostics service on the server.
- Add a `server.testLmStudioConnection` RPC analogous to the OpenClaw gateway test.
- Add a lightweight LM Studio status payload to `server.getConfig` or a dedicated query path.

Important design rule:

- Do not overload `ServerProviderStatus[]` with a fake `lmstudio` provider. Keep provider readiness and backend diagnostics separate.

### Milestone 2: Claude Code via LM Studio

Outcome:

- Users can select `Claude Code via LM Studio`.
- Claude sessions run through LM Studio's Anthropic-compatible endpoint.

Work:

- Extend provider options generation in [apps/web/src/appSettings.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/appSettings.ts).
- Inject LM Studio env in [apps/server/src/provider/Layers/ClaudeAdapter.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ClaudeAdapter.ts):
  - `ANTHROPIC_BASE_URL`
  - `ANTHROPIC_AUTH_TOKEN`
- Make backend selection explicit in session persistence and recovery:
  - [apps/server/src/provider/Layers/ProviderService.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderService.ts)
  - [apps/server/src/provider/Layers/ProviderSessionDirectory.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderSessionDirectory.ts)
- Add model discovery caching and feed it into the picker instead of only using static Claude models.
- Disable or hide Claude-specific effort/thinking controls while LM Studio is active until they are explicitly verified.

Why Claude first:

- The integration path is straightforward and already aligns with LM Studio's published environment-variable-based setup.
- It avoids immediately coupling the first release to Codex config generation.

### Milestone 3: Codex via LM Studio

Outcome:

- Users can select `Codex via LM Studio` without touching their global Codex config.

Work:

- Add a managed, isolated Codex home under OK Code state, for example under the server state dir.
- Generate a Codex config for LM Studio there and point the session at that `CODEX_HOME`.
- Reuse the existing custom-provider assumptions already present in:
  - [apps/server/src/provider/Layers/ProviderHealth.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderHealth.ts)
  - [apps/server/src/sme/authValidation.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/sme/authValidation.ts)
- Thread the isolated home path into:
  - [apps/server/src/codexAppServerManager.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/codexAppServerManager.ts)
  - [apps/server/src/provider/Layers/CodexAdapter.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/CodexAdapter.ts)

Important design rules:

- Never mutate the user's default `CODEX_HOME`.
- Never require the user to manually maintain a hidden Codex config just for OK Code.
- If LM Studio is enabled for Codex, the connection fingerprint used for resume/recovery must include the effective backend config so recovery cannot silently attach to a non-LM-Studio Codex session.

### Milestone 4: Model Source and Capability Rules

Outcome:

- Model selection is driven by real LM Studio state.
- The UI does not promise unsupported controls.

Work:

- Add an LM Studio model-list fetcher using the LM Studio-compatible model-list endpoint.
- Cache the last successful model list server-side with timestamp and last error.
- Show stale-but-usable cached models in the web app when probing fails.
- Teach the web app to switch model-source strategy when LM Studio is active:
  - static built-in models for normal providers
  - live LM Studio models when backend is LM Studio

Files likely involved:

- [packages/contracts/src/model.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/contracts/src/model.ts)
- [packages/shared/src/model.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/packages/shared/src/model.ts)
- [apps/web/src/appSettings.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/appSettings.ts)
- [apps/web/src/components/chat/ProviderModelPicker.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/chat/ProviderModelPicker.tsx)
- [apps/web/src/components/chat/composerProviderRegistry.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/chat/composerProviderRegistry.tsx)

### Milestone 5: Status, Doctor, and User Guidance

Outcome:

- Users can tell whether LM Studio itself is healthy before blaming the provider.

Work:

- Extend [apps/server/src/doctor.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/doctor.ts) with an LM Studio section.
- Show clear server-status messaging in:
  - [apps/web/src/components/chat/ProviderSetupCard.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/chat/ProviderSetupCard.tsx)
  - [apps/web/src/components/chat/providerStatusPresentation.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/chat/providerStatusPresentation.ts)
  - [apps/web/src/components/home/home-utils.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/components/home/home-utils.ts)

Key wording rule:

- distinguish `provider installed/authenticated` from `LM Studio reachable`
- distinguish `local only` from `LM Link connected`

## Persistence and Recovery Requirements

This work should be treated as recovery-sensitive.

Required rules:

- A thread that started as `Claude via LM Studio` must resume as `Claude via LM Studio`.
- A thread that started as `Codex via LM Studio` must resume as `Codex via LM Studio`.
- If the backend config changed materially since the last session, recovery must fail closed and ask for a fresh session instead of silently falling back.
- The persisted thread binding must carry enough data to detect whether the previous session used the default backend or LM Studio.

The existing persistence path in [apps/server/src/provider/Layers/ProviderSessionDirectory.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/server/src/provider/Layers/ProviderSessionDirectory.ts) is the main place to harden.

## Web-State Changes Required

Even though LM Studio is not a new provider kind, the web state layer still needs cleanup because some places currently assume only `codex` and `claudeAgent`.

At minimum, review and harden:

- [apps/web/src/store.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/store.ts)
- [apps/web/src/composerDraftStore.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/composerDraftStore.ts)
- [apps/web/src/session-logic.ts](/Users/buns/.okcode/worktrees/okcode/okcode-7e142d13/apps/web/src/session-logic.ts)

The required change is not "add a new provider kind"; it is "stop assuming provider identity fully determines model source and trait controls."

## Testing Plan

### Unit Tests

- app settings normalization for LM Studio fields
- provider start-option generation
- LM Studio diagnostics parsing
- LM Link status parsing
- provider label and picker rendering when LM Studio is active
- disabled trait behavior when LM Studio is active
- session persistence and recovery fingerprinting

### Integration Tests

- mock LM Studio server reachable without auth
- mock LM Studio server reachable with auth required
- model list fetch success and failure
- Claude session startup with LM Studio backend selected
- Codex session startup with isolated `CODEX_HOME`
- recovery failure when backend fingerprint changes

### Manual Verification

1. Configure LM Studio local server on the same machine.
2. Test connection from Settings and verify model list loads.
3. Start a new `Claude via LM Studio` thread and verify the label and model source are correct.
4. Restart OK Code and verify the same thread resumes with the same backend.
5. Enable LM Link in LM Studio, set a preferred device, and verify diagnostics report linked-device status while the base URL remains local.
6. Repeat the same for `Codex via LM Studio`.
7. Disable LM Studio for a provider and confirm the provider returns to current default behavior.

## Rollout Strategy

### Phase A

- Land shared contracts, settings, diagnostics, and model discovery.
- Ship Claude via LM Studio first.

### Phase B

- Land Codex isolated-home support.

### Phase C

- Remove any experimental flag only after both paths survive restart/recovery and error handling tests.

## Risks and Mitigations

### Risk: LM Studio model capability mismatch

Mitigation:

- do not promise provider-native trait controls while LM Studio is active
- make the backend label explicit in the UI
- keep errors backend-aware

### Risk: Codex custom-provider setup leaks into the user's global config

Mitigation:

- manage a dedicated OK Code-owned `CODEX_HOME`
- never write to the user's default Codex home

### Risk: Recovery silently reattaches to the wrong backend

Mitigation:

- persist backend fingerprint
- fail closed on mismatch

### Risk: LM Link adds confusion because requests still use localhost

Mitigation:

- describe LM Link as a routing status, not a separate connection URL
- show both:
  - API target
  - link status / preferred device

## Acceptance Criteria for the Implementation

- Users can explicitly enable LM Studio for `claudeAgent` and `codex` without changing existing behavior for other users.
- The UI makes it obvious when a thread is using LM Studio.
- LM Studio connection failures are surfaced before or during startup with actionable messages.
- Model selection comes from LM Studio when LM Studio is active.
- Provider-native controls that are not stable through LM Studio are hidden or disabled.
- Session recovery preserves the selected backend and fails closed on mismatch.
- Existing Codex, Claude Code, and OpenClaw behavior remains unchanged when LM Studio is not selected.

## Recommended Order of Execution

1. Add LM Studio settings, contracts, and diagnostics service.
2. Add web diagnostics UI and model discovery plumbing.
3. Ship `claudeAgent` via LM Studio.
4. Ship `codex` via LM Studio with isolated `CODEX_HOME`.
5. Harden recovery and doctor output.
6. Run soak verification with restart and disconnect scenarios.

## References

- LM Studio: Using LM Link
  - https://lmstudio.ai/docs/developer/core/lmlink
- LM Studio: Server Settings
  - https://lmstudio.ai/docs/developer/core/server/settings
- LM Studio: Claude Code integration
  - https://lmstudio.ai/docs/integrations/claude-code
- LM Studio docs index
  - https://lmstudio.ai/docs
