# Preview Panel

## Summary

Build an in-app web UI preview for the desktop app only, using a dedicated renderer-hosted preview panel backed by an Electron-managed embedded webview surface.

Do not route preview traffic through the OK Code server, and do not expose arbitrary browsing. The preview should be an explicit local-dev feature for project URLs like `http://localhost:3000`, with strict allowlisting, clear failure states, and zero impact on the existing web/browser mode.

This fits the current architecture because:

- desktop-only capabilities already live behind `DesktopBridge` in [`packages/contracts/src/ipc.ts`](../packages/contracts/src/ipc.ts) and [`apps/desktop/src/preload.ts`](../apps/desktop/src/preload.ts)
- the web app already has panel and drawer patterns in [`apps/web/src/components/ThreadTerminalDrawer.tsx`](../apps/web/src/components/ThreadTerminalDrawer.tsx), [`apps/web/src/components/PlanSidebar.tsx`](../apps/web/src/components/PlanSidebar.tsx), and [`apps/web/src/components/DiffPanel.tsx`](../apps/web/src/components/DiffPanel.tsx)
- external URL opening is currently explicit and safe in [`apps/web/src/wsNativeApi.ts`](../apps/web/src/wsNativeApi.ts) and [`apps/desktop/src/main.ts`](../apps/desktop/src/main.ts)

## Architecture Choice

Use a desktop-only preview panel in the React UI, but let Electron own the actual embedded browsing surface.

Chosen approach:

- React owns preview state, toolbar controls, visibility, and status text.
- Desktop bridge exposes preview commands and preview status events.
- Electron main process owns one preview session per app window and renders it in a dedicated child browsing surface.
- The preview only loads explicit, validated local-dev URLs.

Do not use:

- plain `iframe` in the main renderer, because it gives weaker isolation, worse dev-server compatibility, and less control over navigation and security
- OK Code server proxying preview traffic, because that crosses the wrong boundary and adds avoidable complexity
- general-purpose browsing, because it is out of scope and materially increases security risk

## Public Interface Changes

Add to `DesktopBridge` in [`packages/contracts/src/ipc.ts`](../packages/contracts/src/ipc.ts):

- `preview.open(input: { url: string; title?: string | null }): Promise<PreviewOpenResult>`
- `preview.close(): Promise<void>`
- `preview.reload(): Promise<void>`
- `preview.navigate(input: { url: string }): Promise<PreviewNavigateResult>`
- `preview.getState(): Promise<DesktopPreviewState>`
- `preview.onState(listener): () => void`

Add desktop-only preview types:

- `DesktopPreviewState`
- `DesktopPreviewStatus = "closed" | "loading" | "ready" | "error"`
- `DesktopPreviewErrorCode = "invalid-url" | "non-local-url" | "navigation-blocked" | "load-failed" | "process-gone"`

Do not add preview RPCs to `NativeApi` or `WS_METHODS`. This is a desktop capability, not a server capability.

## URL Policy

Allow only:

- `http://localhost:<port>`
- `http://127.0.0.1:<port>`
- `http://[::1]:<port>`

Defaults:

- reject `https`, custom hosts, LAN IPs, and remote domains
- reject empty URLs and malformed URLs
- keep navigation inside the same local-origin policy set
- if the page tries to open a new window, open externally only if the target also passes local-dev validation, otherwise block

This keeps the feature predictable and aligned with local app preview rather than browser replacement.

## UI Design

Add a new right-side preview panel in the chat route, parallel to existing plan and diff patterns:

- collapsed by default
- desktop-only
- resizable
- openable from chat header and compact controls
- remembers last open or closed state per thread, but preview URL is project-scoped, not thread-scoped

Panel contents:

- toolbar with URL field, reload, open externally, and close
- status row with `Loading`, `Ready`, `Blocked`, or failure reason
- empty state with instructions: “Start your local dev server, then enter localhost URL”
- embedded preview surface below the toolbar

Recommended placement:

- route-level shell under [`apps/web/src/routes/_chat.tsx`](../apps/web/src/routes/_chat.tsx)
- preview panel component under `apps/web/src/components/PreviewPanel.tsx`
- small preview state store under `apps/web/src/previewStateStore.ts`

## Data Flow

1. User opens preview panel.
2. User enters a `localhost` URL or picks a remembered recent URL.
3. React validates the basic shape immediately.
4. Renderer calls `desktopBridge.preview.open`.
5. Main process validates the URL again, creates or reuses the preview surface, and starts the load.
6. Main process emits preview state updates for loading, ready, title, current URL, and errors.
7. React updates the toolbar and status from those events.
8. Close hides and tears down the embedded surface cleanly.

Important default:

- one preview session per desktop window, not per thread tab, for simpler lifecycle and lower memory pressure

## Desktop Main Process Design

In [`apps/desktop/src/main.ts`](../apps/desktop/src/main.ts):

- add IPC channels for preview open, close, reload, navigate, get-state, and state-updates
- maintain a preview controller keyed by `BrowserWindow`
- create and destroy the child browsing surface on demand
- clamp bounds to a container region communicated by the renderer
- emit state updates on `did-start-loading`, `did-stop-loading`, `page-title-updated`, `did-fail-load`, and process-gone-style events
- deny arbitrary popups and off-policy navigations

Implementation note:

- prefer a `WebContentsView` or equivalent child web contents surface supported by the Electron version in use
- the critical requirement is main-process ownership plus explicit bounds control

## Security and Reliability Rules

- desktop-only feature, no-op in browser mode
- double-validate URLs in renderer and main
- never grant Node integration to preview content
- keep context isolation and sandboxing on
- do not share the OK Code preload bridge with preview content
- tear down the preview surface on window close and on explicit close
- show actionable errors instead of silent blank pages

## Testing

Add tests in three layers:

- contracts and preload typing for bridge methods and preview state types
- desktop unit tests for URL validation, navigation blocking, state transitions, and teardown behavior
- web component tests for panel open and close, desktop-only rendering, status mapping, and invalid URL handling

Critical scenarios:

- valid `localhost` preview loads
- invalid or non-local URL is rejected
- reload works
- dev server goes down after load
- preview process crashes or is killed
- user closes preview while loading
- browser mode hides all preview UI
- external link from preview is blocked or opened per policy

## Rollout

### Phase 1

- bridge types
- desktop controller
- hidden preview panel shell
- manual URL entry

### Phase 2

- resize and persistence polish
- recent URLs
- status UX
- external-open action

### Phase 3

- optional project-level suggested preview URL setting in [`packages/contracts/src/server.ts`](../packages/contracts/src/server.ts) and settings UI, only if needed later

## Acceptance Criteria

- desktop app can render a local web UI preview inside OK Code
- browser mode behavior is unchanged
- only explicit local-dev URLs are allowed
- preview failures are visible and recoverable
- existing server and WebSocket architecture remains untouched
- no preview traffic is proxied through `apps/server`
