# Web i18n Rollout Tracker

_Last updated: 2026-03-31_

This document tracks the phased rollout of multilingual support for `apps/web`.

Supported locales:

- `en`
- `es`
- `fr`
- `zh-CN`

Status values:

- `TODO`: Not started
- `IN_PROGRESS`: Started but not yet shippable
- `DONE`: Implemented and verified
- `BLOCKED`: Waiting on a dependency or decision

## Scope

In scope for this rollout:

- frontend-only localization in `apps/web`
- product-owned UI strings only
- locale persistence via app settings
- locale-aware timestamps
- root screens, settings, onboarding, and mobile pairing in the first shippable stop

Out of scope for this rollout:

- `apps/server`
- `apps/marketing`
- user/model/code content translation
- arbitrary provider/server freeform error translation

## Current Snapshot

Overall status: `IN_PROGRESS`

Completed so far:

- Added `react-intl` to `apps/web`
- Added locale schema support to `apps/web/src/appSettings.ts`
- Added the shared i18n scaffolding under `apps/web/src/i18n/`
- Added initial message catalogs for `en`, `es`, `fr`, and `zh-CN`
- Wired the root route through a shared `I18nProvider`
- Made timestamps honor the resolved app locale
- Updated the timestamp callsites in chat and diff surfaces
- Added Phase 1 guardrail tests for locale resolution, timestamp formatting, and catalog parity
- Resolved the repo-wide server typecheck blocker by forcing a single `effect` version across `@effect/*`
- `apps/web` tests pass
- `bun fmt` passed
- `bun lint` passed
- `bun typecheck` passed

Not yet completed:

- Settings page migration
- Onboarding migration
- Mobile pairing migration

## Phase 1 — Infrastructure

Objective:
Establish the shared localization foundation without coupling it to the server or user content.

Checklist:

- [x] Add `react-intl` to `apps/web`
  - Status: `DONE`
- [x] Add persisted locale preference to `apps/web/src/appSettings.ts`
  - Status: `DONE`
- [x] Add shared i18n module in `apps/web/src/i18n/`
  - Status: `DONE`
- [x] Add message catalogs for `en`, `es`, `fr`, and `zh-CN`
  - Status: `DONE`
- [ ] Wire `I18nProvider` into [apps/web/src/routes/__root.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/routes/__root.tsx)
  - Status: `DONE`
- [ ] Expose stable translation helpers for component usage
  - Status: `DONE`
- [ ] Add locale-aware timestamp formatting in [apps/web/src/timestampFormat.ts](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/timestampFormat.ts)
  - Status: `DONE`
- [ ] Update timestamp callsites in [apps/web/src/components/chat/MessagesTimeline.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/chat/MessagesTimeline.tsx)
  - Status: `DONE`
- [ ] Update timestamp callsites in [apps/web/src/components/DiffPanel.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/DiffPanel.tsx)
  - Status: `DONE`

Exit criteria:

- Locale can be resolved at runtime from `system | en | es | fr | zh-CN`
- The app can render under a single root i18n provider
- Timestamp formatting can follow the selected app locale

## Phase 2 — First Shippable Surfaces

Objective:
Ship a coherent multilingual slice that is complete on the highest-value product-owned surfaces.

Checklist:

- [ ] Migrate root route loading/error copy in [apps/web/src/routes/__root.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/routes/__root.tsx)
  - Status: `TODO`
- [ ] Migrate root keybinding toasts in [apps/web/src/routes/__root.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/routes/__root.tsx)
  - Status: `TODO`
- [ ] Add language selector to [apps/web/src/routes/_chat.settings.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/routes/_chat.settings.tsx)
  - Status: `TODO`
- [ ] Migrate product-owned settings copy in [apps/web/src/routes/_chat.settings.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/routes/_chat.settings.tsx)
  - Status: `TODO`
- [ ] Migrate supporting settings components in [apps/web/src/components/EnvironmentVariablesEditor.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/EnvironmentVariablesEditor.tsx)
  - Status: `TODO`
- [ ] Migrate supporting settings components in [apps/web/src/components/CustomThemeDialog.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/CustomThemeDialog.tsx)
  - Status: `TODO`
- [ ] Migrate onboarding content in [apps/web/src/components/onboarding/onboardingSteps.ts](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/onboarding/onboardingSteps.ts)
  - Status: `TODO`
- [ ] Migrate onboarding controls in [apps/web/src/components/onboarding/OnboardingDialog.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/onboarding/OnboardingDialog.tsx)
  - Status: `TODO`
- [ ] Migrate mobile pairing UI in [apps/web/src/components/mobile/MobilePairingScreen.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/mobile/MobilePairingScreen.tsx)
  - Status: `TODO`

Exit criteria:

- Users can select a language in Settings without reloading
- Root screens, Settings, Onboarding, and Mobile Pairing render localized product UI
- English remains the safe fallback when a locale cannot be resolved or loaded

## Phase 3 — High-Traffic Product Surfaces

Objective:
Extend localization to the most visible remaining chrome and toast-heavy flows.

Checklist:

- [ ] Migrate sidebar toasts and chrome in [apps/web/src/components/Sidebar.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/Sidebar.tsx)
  - Status: `TODO`
- [ ] Migrate chat home empty state in [apps/web/src/components/ChatHomeEmptyState.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/ChatHomeEmptyState.tsx)
  - Status: `TODO`
- [ ] Migrate workspace file tree messages in [apps/web/src/components/WorkspaceFileTree.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/WorkspaceFileTree.tsx)
  - Status: `TODO`
- [ ] Migrate Git actions UI copy in [apps/web/src/components/GitActionsControl.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/GitActionsControl.tsx)
  - Status: `TODO`
- [ ] Migrate branch selector copy in [apps/web/src/components/BranchToolbarBranchSelector.tsx](/Users/buns/.okcode/worktrees/okcode/okcode-587a5d98/apps/web/src/components/BranchToolbarBranchSelector.tsx)
  - Status: `TODO`

Exit criteria:

- The highest-traffic app chrome and common toasts are localized
- Remaining untranslated product UI is narrow and intentional

## Phase 4 — Hardening and Verification

Objective:
Make the rollout safe to maintain and safe to ship repeatedly.

Checklist:

- [ ] Add locale resolution tests
  - Status: `DONE`
- [ ] Add app settings default tests for locale
  - Status: `DONE`
- [ ] Add message catalog parity tests
  - Status: `DONE`
- [ ] Add timestamp formatting tests
  - Status: `DONE`
- [ ] Run `bun fmt`
  - Status: `DONE`
- [ ] Run `bun lint`
  - Status: `DONE`
- [ ] Run `bun typecheck`
  - Status: `DONE`

Exit criteria:

- Catalog drift is caught by tests
- Locale behavior is covered by automated checks
- Required repository quality gates pass

## Shippable Stop

The first shippable stop is:

- Phase 1 complete
- Phase 2 complete
- Phase 4 verification complete

Phase 3 can follow later without blocking the first release if the app’s core localized surfaces are already coherent.

## Next Up

Immediate next implementation steps:

1. Migrate root route strings and root toasts.
2. Migrate Settings and its supporting components.
3. Migrate Onboarding and Mobile Pairing.
4. Continue with Phase 2 completion toward the first shippable localized stop.
