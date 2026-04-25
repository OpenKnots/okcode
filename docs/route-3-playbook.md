# Route 3 Playbook

## Purpose

Route 3 is the aggressive reset path for cutting scope when broad support starts hurting the core product. This document is operational on purpose: if the trigger conditions are met, the team should be able to execute the reset without reopening the entire product debate.

## Trigger Conditions

Take Route 3 when several of these hold at the same time:

- Optional provider or feature work is consuming more PR volume than core orchestration work.
- Startup, reconnect, or recovery reliability is being degraded by optional domains.
- One or more providers create disproportionate support burden relative to usage.
- Settings and navigation are causing recurring user confusion.
- The team is repeatedly fixing low-adoption features while core chat/runtime work slips.
- Bundle or startup costs keep rising because dormant or niche features stay in the default path.

## Execution Order

1. Freeze new optional-surface work.
2. Publish a support matrix and mark non-core surfaces as deprecated.
3. Hide deprecated surfaces behind feature flags immediately.
4. Remove deprecated surfaces from primary navigation in the next release.
5. Stop loading deprecated server capabilities in the default runtime.
6. Remove deprecated RPCs, client API surface, and live handlers.
7. Archive or extract surviving code into optional packages or separate repos where justified.
8. Delete dead code after one deprecation window ends.

## Default Cut List

Start here unless current usage data clearly argues otherwise:

- Provider-specific UX branches that duplicate the shared chat flow
- Optional review or analysis products that are not top-tier bets
- Niche settings panels with overlapping provider controls
- Experimental server domains that do not affect the default project-chat path
- Template or demo UI baggage that is not part of the maintained product

## Provider Reduction Sequence

If provider de-scoping becomes necessary, reduce in this order unless usage/support data says otherwise:

1. Lowest-usage provider with highest support cost
2. Provider with the most duplicated configuration/UI surface
3. Provider whose auth/install path fails most often in the field

Codex remains the last provider removed. It is the product’s primary happy path.

## User-Facing Deprecation Sequence

1. Announce the deprecation in release notes and settings copy.
2. Add an in-product notice with the exact removal release.
3. Remove the surface from default navigation while leaving direct access during the deprecation window.
4. Remove direct access and runtime support after the window closes.

## Compatibility Promises

During Route 3 execution:

- Existing core threads and project chats remain readable.
- Historical migrations remain untouched.
- Non-core feature removal should not corrupt orchestration data.

What can break:

- Direct access to deprecated routes
- Deprecated RPC clients
- Provider-specific setup paths that are explicitly retired

## Extraction vs Archive vs Delete

Extract when:

- The feature has committed ownership and enough usage to justify continued life outside the core app.

Archive when:

- The code is useful as reference but not worth shipping.

Delete when:

- The surface is unfinished, duplicated, or materially harmful to maintenance focus.

## Rollback Criteria

Pause or reverse Route 3 only if:

- Removal causes a measurable regression in core adoption or retention
- The deprecated surface turns out to be operationally critical for a real user segment
- The extraction target is ready and can preserve value without re-bloating the core app

If rollback is needed, restore only the minimum surface necessary. Do not restore placeholder UX or eager startup wiring.
