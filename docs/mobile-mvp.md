# Mobile MVP

## Objective

Ship a mobile companion for OK Code that lets a user stay in control of long-running agent work when they are away from their desk.

The mobile product should not attempt to run provider CLIs, PTYs, or project-local workspaces on-device in the first release. The phone is a remote client for an already-running OK Code server.

## Why This Shape

The current product architecture is already server-first:

- `apps/server` owns provider session startup, WebSocket transport, PTYs, and orchestration.
- `apps/web` is a browser client that consumes the server over WebSocket.
- `REMOTE.md` already documents opening OK Code from another device on the same network or tailnet.

That means the fastest path to a useful mobile product is to make the existing client intentionally usable as a small-screen companion, then wrap that surface in a native shell for push notifications and platform integrations.

## Value Add

The mobile app is worth the lift if it materially improves these workflows:

- Monitor an active thread from anywhere.
- Approve or reject file/command actions quickly.
- Answer user-input prompts without returning to a laptop.
- Send a follow-up message or correction while a turn is in progress.
- Receive push notifications when the agent needs attention.

It is not worth the lift if the goal is local, on-device execution parity with desktop. That is a separate product with a different runtime, reliability model, and OS constraints.

## MVP Scope

The MVP companion must cover only the narrowest high-value loop:

1. Pair a phone to a remote OK Code server.
2. Show the project/thread list with clear attention states.
3. Open a thread and read the timeline reliably.
4. Handle approvals and user-input requests.
5. Send new prompts and follow-ups.
6. Receive push notifications for attention-requiring events.

### Explicit Non-Goals

- Running providers locally on iOS or Android.
- Full terminal parity with desktop.
- Full workspace tree and code-editing parity.
- Complex diff review workflows beyond lightweight viewing.
- Multi-pane desktop layout on mobile.

## Framework Recommendation

Use **Capacitor** for the MVP native shell.

Rationale:

- The existing web app already contains the product logic and transport.
- Capacitor is the lowest-lift path to package the app for iOS and Android while adding push notifications, share sheet, camera/photo attachment access, biometrics, and deep links.
- A React Native or Expo rewrite would slow delivery and duplicate a large amount of UI and orchestration work before validating the product.

## Product Contract

The mobile companion must be a first-class client mode, not a set of accidental viewport behaviors. That means the web app needs an explicit companion presentation mode with these constraints:

- [ ] Sidebar closed by default on mobile.
- [ ] Secondary surfaces shown as sheets, not inline sidebars.
- [ ] Thread timeline and pending actions prioritized above everything else.
- [ ] Layout choices optimized for one-handed use and reconnect tolerance.

## Phased Release Checklist

### Phase 0: Web Companion Mode

Goal: establish an intentional mobile client surface inside `apps/web`.

Checklist:

- [ ] Add explicit client mode resolution (`desktop` vs `mobile`).
- [ ] Default the left thread sidebar to closed on mobile.
- [ ] Move code viewer and diff surfaces into mobile sheets.
- [ ] Document how the mobile companion differs from desktop.
- [ ] Validate the browser app on a phone without the full desktop multi-pane layout.

Exit criteria:

- [ ] The browser app is usable on a phone without inheriting the full desktop multi-pane layout.
- [ ] Remote-access sessions on mobile are stable enough for internal dogfooding.

### Phase 1: Attention Loop

Goal: make the mobile client useful for active supervision.

Checklist:

- [ ] Project attention state per thread.
- [ ] Surface pending approvals and user-input requests clearly.
- [ ] Add fast actions for approve, reject, answer, and follow-up.
- [ ] Show safer reconnect states and degraded-mode messaging when the remote server is unavailable.
- [ ] Confirm a user can monitor and unblock an agent session from a phone.

Exit criteria:

- [ ] A user can reliably monitor and unblock an agent session from a phone.

### Phase 2: Native Shell

Goal: package the companion as an installable app.

Checklist:

- [ ] Add a new `apps/mobile` Capacitor shell that hosts the companion web build.
- [ ] Produce native build targets for iOS and Android.
- [ ] Implement deep-link based pairing.
- [ ] Store pairing details and auth token in native secure storage.
- [ ] Provide manual paste fallback for pairing links when a deep link cannot be opened directly.
- [ ] Verify TestFlight and internal Android builds can complete the attention loop.

Exit criteria:

- [ ] TestFlight and internal Android builds can connect to an OK Code server and complete the attention loop.

### Phase 3: Notifications And Pairing Hardening

Goal: reduce friction and close the loop when the user is away.

Checklist:

- [ ] Add push notifications for approval requested, user input requested, turn completed, and session failed.
- [ ] Provide pairing UX with short-lived bootstrap links or QR code flow.
- [ ] Add token rotation and revocation handling.
- [ ] Improve offline and reconnect messaging.
- [ ] Ensure users can leave the app and still get pulled back in only when needed.

Exit criteria:

- [ ] Users can leave the app and still get pulled back in only when needed.

## Release Readiness Checklist

- [ ] `apps/web` behaves correctly in mobile companion mode on both iOS and Android browsers.
- [ ] `apps/mobile` builds and launches on at least one iOS and one Android target.
- [ ] Pairing works with both deep links and manual paste fallback.
- [ ] Attention states, approvals, and user-input prompts are easy to act on from a phone.
- [ ] Offline, reconnect, and degraded-mode states are understandable and non-blocking.
- [ ] Release notes call out any remaining mobile limitations explicitly.

## Architecture Notes

- Mobile should continue using the existing WebSocket protocol and orchestration snapshot flow.
- Pairing should build on top of the existing auth-token model rather than inventing a second authentication system for MVP.
- The app should assume intermittent connectivity and design all mobile UI around eventual resync from the orchestration snapshot.

## Success Metrics

- Median time to answer an approval request from mobile.
- Percentage of approvals completed without returning to desktop.
- Session reconnect success rate after app background/foreground transitions.
- Weekly active users of remote/mobile sessions.

## Risks

- If remote pairing is clumsy, users will fall back to the mobile browser instead of the app.
- If reconnect behavior is noisy, push notifications become a liability instead of a value add.
- If the mobile surface tries to preserve desktop parity, the product will feel cramped and low-confidence.
