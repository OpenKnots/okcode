# Plan: Roll Out OpenClaw as an OK Code Provider

## Summary

Add **OpenClaw** to OK Code as a third provider runtime alongside `codex` and `claudeAgent`.

This should be implemented as a **provider integration**, not as a one-off model entry. OpenClaw would own model routing and execution, while OK Code continues to own thread UX, provider selection, health reporting, and session orchestration.

## Goals

- Let users select **OpenClaw** from the provider/model picker.
- Support a practical MVP quickly without blocking on full provider parity.
- Preserve OK Code's current provider architecture instead of adding ad-hoc special cases.
- Keep the rollout safe by phasing higher-risk features after the basic session loop works.

## Non-goals (initial rollout)

- Full OpenClaw tool/event parity on day one.
- Perfect rollback/history parity before an MVP exists.
- Replacing existing Codex or Claude provider flows.
- Supporting every OpenClaw capability in the first release.

## Recommended rollout shape

- **Phase 0:** architecture + contracts groundwork
- **Phase 1:** UI + config plumbing
- **Phase 2:** MVP OpenClaw adapter (usable provider)
- **Phase 3:** richer session/history/approval parity
- **Phase 4:** polish, observability, and hardening

---

## Phase 0 — Architecture and contract groundwork

### Objective

Define OpenClaw as a first-class provider in contracts and app state without yet making it fully executable.

### Checklist

- [ ] Add `openclaw` to `ProviderKind`.
- [ ] Decide whether OpenClaw-specific options live under `providerOptions.openclaw` or a new dedicated config object.
- [ ] Define initial OpenClaw provider start options, likely including:
  - [ ] gateway/base URL
  - [ ] auth token or password reference
  - [ ] default agent/session mode
  - [ ] optional model override
- [ ] Add OpenClaw model option strategy:
  - [ ] start with static built-ins **or**
  - [ ] start with manual custom model slugs only **or**
  - [ ] fetch dynamic models later as a follow-up
- [ ] Set a clear default for session model switching support (`in-session`, `restart-session`, or `unsupported`).
- [ ] Decide MVP behavior for unsupported provider features:
  - [ ] rollback
  - [ ] thread snapshot reads
  - [ ] approval routing
  - [ ] structured user input

### Likely files

- `packages/contracts/src/orchestration.ts`
- `packages/contracts/src/model.ts`
- `packages/contracts/src/provider.ts`
- `packages/contracts/src/server.ts`

### Exit criteria

- `openclaw` exists in contracts/types without breaking existing providers.
- MVP capability decisions are documented and not left implicit.

---

## Phase 1 — UI and settings plumbing

### Objective

Make OpenClaw visible and selectable in the OK Code UI, even if execution is still stubbed or gated behind availability checks.

### Checklist

- [ ] Add OpenClaw to provider picker options.
- [ ] Add an icon/label treatment for OpenClaw in the model picker.
- [ ] Update provider-specific app settings and custom model handling.
- [ ] Add settings UI for OpenClaw connection details.
- [ ] Add provider install/configuration copy in settings.
- [ ] Extend provider health banner/status display to recognize OpenClaw.
- [ ] Ensure draft persistence/store logic can serialize OpenClaw provider selections.
- [ ] Ensure thread/session display can show `providerName: "openclaw"` cleanly.

### Likely files

- `apps/web/src/session-logic.ts`
- `apps/web/src/components/chat/ProviderModelPicker.tsx`
- `apps/web/src/routes/_chat.settings.tsx`
- `apps/web/src/appSettings.ts`
- `apps/web/src/composerDraftStore.ts`
- `apps/web/src/store.ts`

### Notes

For MVP, it is acceptable for the UI to show OpenClaw only when:
- the provider is configured, or
- a feature flag is enabled.

### Exit criteria

- Users can select OpenClaw in the UI.
- App state and settings persist the choice correctly.
- Existing Codex/Claude picker behavior remains unchanged.

---

## Phase 2 — MVP OpenClaw adapter

### Objective

Ship a usable OpenClaw-backed provider that supports the core thread loop:
**start session → send turn → stream output → stop session**.

### Checklist

- [ ] Implement `OpenClawAdapter` using the existing `ProviderAdapter` contract.
- [ ] Register the adapter in the provider registry.
- [ ] Wire the adapter into server layers.
- [ ] Map OK Code thread lifecycle to OpenClaw session lifecycle.
- [ ] Implement `startSession`.
- [ ] Implement `sendTurn`.
- [ ] Implement `interruptTurn` if OpenClaw supports it cleanly; otherwise define MVP fallback behavior.
- [ ] Implement `stopSession`.
- [ ] Implement `listSessions`.
- [ ] Stream assistant output back into OK Code's canonical provider event stream.
- [ ] Normalize OpenClaw errors into OK Code provider errors.
- [ ] Add provider health probing for OpenClaw reachability/authentication.
- [ ] Gate the provider as unavailable when config or auth is missing.

### Likely files

- `apps/server/src/provider/Layers/OpenClawAdapter.ts`
- `apps/server/src/provider/Services/OpenClawAdapter.ts`
- `apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`
- `apps/server/src/serverLayers.ts`
- `apps/server/src/provider/Layers/ProviderHealth.ts`

### MVP behavioral constraints

- [ ] One OpenClaw session per OK Code thread.
- [ ] Basic text streaming required.
- [ ] Rich tool/request parity optional.
- [ ] Rollback may be unsupported initially if surfaced honestly.
- [ ] Thread readback may be shallow or best-effort in MVP.

### Exit criteria

- A user can select OpenClaw and successfully complete a normal prompt/response cycle.
- Streaming feels native enough for regular use.
- Health/auth failures are visible and understandable.

---

## Phase 3 — Session, history, and approval parity

### Objective

Reduce the behavioral gap between OpenClaw and the native Codex/Claude integrations.

### Checklist

- [ ] Implement `readThread` with meaningful history reconstruction.
- [ ] Implement `rollbackThread`, or explicitly model why rollback is unsupported.
- [ ] Improve resume/reconnect behavior for long-lived OpenClaw sessions.
- [ ] Decide how approval requests are surfaced:
  - [ ] OpenClaw-native approvals only
  - [ ] translated into OK Code approvals
  - [ ] hybrid with clear ownership
- [ ] Support structured user-input prompts if OpenClaw exposes them.
- [ ] Improve event translation for tools, progress states, and status updates.
- [ ] Preserve provider refs/IDs where useful for resumability and debugging.

### Design questions to resolve

- [ ] Does OK Code own approvals, or does OpenClaw own approvals?
- [ ] How should rollback behave if OpenClaw sessions are not trivially rewindable?
- [ ] Should OpenClaw session state be persisted directly, indirectly, or only via transcript replay?

### Exit criteria

- OpenClaw threads behave predictably across refreshes, resumes, and longer conversations.
- Missing parity is minimal and intentional rather than accidental.

---

## Phase 4 — Polish, dynamic models, and hardening

### Objective

Make OpenClaw feel like a polished built-in provider rather than a basic bridge.

### Checklist

- [ ] Add dynamic model discovery from OpenClaw if available.
- [ ] Support richer provider-specific model options where meaningful.
- [ ] Improve install/setup guidance in settings.
- [ ] Add better telemetry/logging around OpenClaw session failures.
- [ ] Add browser/manual test coverage for picker/settings flows.
- [ ] Add adapter-focused unit tests and integration tests.
- [ ] Add resilience for network interruptions and transient gateway failures.
- [ ] Add clearer recovery messaging for auth/config/session mismatch errors.

### Exit criteria

- Setup is understandable.
- Errors are debuggable.
- OpenClaw feels like a normal provider choice inside OK Code.

---

## Cross-cutting risks

- OpenClaw session semantics may not map perfectly onto OK Code's provider assumptions.
- Approval handling may become confusing if both systems try to own the same UX.
- Rollback/history parity may require deeper transcript/state mapping than the MVP needs.
- Provider model discovery may be dynamic in OpenClaw while OK Code currently prefers static provider model catalogs.

## Cross-cutting decisions to keep explicit

- [ ] Is OpenClaw primarily a **remote runtime** or a **thin bridge** in MVP?
- [ ] Are OpenClaw models static, custom-only, or dynamically discovered in the first release?
- [ ] Is rollback required for launch, best-effort, or explicitly unsupported?
- [ ] Who owns approval UX in the integrated flow?

## Suggested order of implementation

1. Phase 0 contracts
2. Phase 1 picker/settings plumbing
3. Phase 2 MVP adapter + health checks
4. Manual smoke testing
5. Phase 3 parity work
6. Phase 4 polish/hardening

## Validation checklist

- [ ] Typecheck passes across contracts, web, and server.
- [ ] Existing Codex and Claude flows still work.
- [ ] OpenClaw shows correct provider health in settings/chat.
- [ ] New OpenClaw thread can start, stream, and stop successfully.
- [ ] Misconfigured OpenClaw setup fails with a useful message.
- [ ] Re-opening the app preserves provider selection and model choice.

## Done criteria

- OpenClaw is selectable as a provider in OK Code.
- A normal thread can run end-to-end through OpenClaw.
- Provider health and configuration are understandable.
- Advanced parity gaps are documented and tracked rather than hidden.
