import type { ServerProviderStatus } from "@okcode/contracts";
import type { ComponentProps, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorNotificationBar } from "./ErrorNotificationBar";

function makeProviderStatus(overrides: Partial<ServerProviderStatus> = {}): ServerProviderStatus {
  return {
    provider: "codex",
    status: "warning",
    available: true,
    authStatus: "authenticated",
    checkedAt: "2026-04-10T12:00:00.000Z",
    message: "Provider is checking state.",
    ...overrides,
  };
}

const THREAD_ERROR =
  "Git command failed in GitCore.createWorktree: OPENAI_API_KEY=sk-proj-secret (/repo) - Base branch 'main' does not resolve to a commit yet.";

function renderBar(
  overrides: Partial<ComponentProps<typeof ErrorNotificationBar>> = {},
): ReactElement {
  const { onDismissThreadError, onRecoverFromOutOfMemory, transportState, ...restOverrides } =
    overrides;
  return (
    <ErrorNotificationBar
      threadError={THREAD_ERROR}
      showAuthFailuresAsErrors
      showNotificationDetails={false}
      includeDiagnosticsTipsInCopy={true}
      providerStatus={makeProviderStatus()}
      isMobileCompanion={false}
      {...restOverrides}
      {...(onDismissThreadError ? { onDismissThreadError } : {})}
      {...(onRecoverFromOutOfMemory ? { onRecoverFromOutOfMemory } : {})}
      {...(transportState ? { transportState } : {})}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ErrorNotificationBar", () => {
  it("keeps raw error text out of the collapsed bar and shows the aggregate count", () => {
    const markup = renderToStaticMarkup(renderBar());

    expect(markup).toContain("Show 2 notifications");
    expect(markup).not.toContain("OPENAI_API_KEY=sk-proj-secret");
    expect(markup).not.toContain("Base branch 'main' does not resolve to a commit yet.");
  });

  it("expands to show redacted error text and diagnostics copy", async () => {
    let renderer: ReactTestRenderer | null = null;
    await act(async () => {
      renderer = create(renderBar());
    });

    const root = renderer!.root;
    const toggle = root.findByProps({ "aria-label": "Show 2 notifications" });

    await act(async () => {
      toggle.props.onClick();
    });

    expect(root.findByProps({ "aria-label": "Hide 2 notifications" })).toBeTruthy();
    expect(root.findByProps({ "aria-label": "Copy diagnostics" })).toBeTruthy();
    expect(JSON.stringify(renderer!.toJSON())).toContain("Worktree thread could not start");
    expect(JSON.stringify(renderer!.toJSON())).toContain(
      "Base branch 'main' does not resolve to a commit yet.",
    );
  });

  it("starts expanded when notification details are enabled", () => {
    const markup = renderToStaticMarkup(
      renderBar({
        showNotificationDetails: true,
      }),
    );

    expect(markup).toContain("Hide 2 notifications");
    expect(markup).toContain("Worktree thread could not start");
    expect(markup).toContain("Base branch &#x27;main&#x27; does not resolve to a commit yet.");
  });

  it("shows an out-of-memory recovery action when the thread error is recoverable", async () => {
    const onRecoverFromOutOfMemory = vi.fn();
    let renderer: ReactTestRenderer | null = null;
    await act(async () => {
      renderer = create(
        renderBar({
          threadError:
            "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory",
          onRecoverFromOutOfMemory,
        }),
      );
    });

    const root = renderer!.root;
    const recoverButton = root.findByProps({
      "aria-label": "Reset session after out-of-memory failure",
    });

    await act(async () => {
      recoverButton.props.onClick();
    });

    expect(onRecoverFromOutOfMemory).toHaveBeenCalledTimes(1);
  });
});
