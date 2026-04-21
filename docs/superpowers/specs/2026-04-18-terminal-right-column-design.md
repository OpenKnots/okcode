# Desktop Terminal Dock Design

**Goal:** Keep the approved desktop shell interpretation explicit and render the thread terminal below the right panel when that panel is open.

## Approved Shell Interpretation

The counted desktop shells are:

- `sidebar`
- `preview`
- `right panel`
- `plan sidebar`

The terminal is explicitly excluded from the shell cap.

## Current Constraint

`ThreadTerminalDrawer` is owned by `ChatView` and depends on substantial composer and thread-local behavior. Moving all terminal state and callbacks into the route would be a larger refactor than this layout change needs.

## Design

Use a two-part approach:

1. Add a small pure helper that defines:
   - which desktop shells are counted
   - when the terminal should dock into the right column versus remain inline
2. Keep terminal behavior inside `ChatView`, but portal the rendered drawer into a host element supplied by the desktop thread route when the right panel is open.

## Route Layout Change

The desktop thread route will render an empty terminal dock host below the existing right panel content inside the right sidebar. That preserves the current right panel width and places the terminal directly underneath it when both are open.

If the right panel is closed, the terminal keeps its existing inline fallback in `ChatView`.

## Testing

- Add a pure helper test that asserts the counted shells exclude terminal and top out at the four approved shells.
- Add helper tests that assert terminal docking only happens on desktop when the right-panel dock host is available.
- Run web formatting, lint, and typecheck gates after implementation.
