import { describe, expect, it } from "vitest";

import type { ProviderKind, ServerProviderStatus } from "@okcode/contracts";
import {
  getSelectableThreadProviders,
  isProviderReadyForThreadSelection,
  resolveThreadProviderSelection,
} from "./providerAvailability";

function makeStatus(
  provider: ProviderKind,
  overrides: Partial<ServerProviderStatus> = {},
): ServerProviderStatus {
  return {
    provider,
    status: "ready",
    available: true,
    authStatus: "authenticated",
    checkedAt: "2026-04-12T12:00:00.000Z",
    ...overrides,
  };
}

describe("providerAvailability", () => {
  it("allows ready authenticated CLI providers", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "codex",
        statuses: [makeStatus("codex")],
      }),
    ).toBe(true);
  });

  it("allows ready providers with unknown auth when auth is handled externally", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "codex",
        statuses: [makeStatus("codex", { authStatus: "unknown" })],
      }),
    ).toBe(true);
  });

  it("blocks providers that are explicitly unauthenticated", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "claudeAgent",
        statuses: [makeStatus("claudeAgent", { status: "error", authStatus: "unauthenticated" })],
      }),
    ).toBe(false);
  });

  it("blocks claudeAgent when status is error even if claudeAuthTokenHelperCommand is set and available is true", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "claudeAgent",
        statuses: [
          makeStatus("claudeAgent", {
            status: "error",
            available: true,
            authStatus: "unauthenticated",
          }),
        ],
        claudeAuthTokenHelperCommand: "my-token-helper",
      }),
    ).toBe(false);
  });

  it("allows claudeAgent with claudeAuthTokenHelperCommand when status is ready but auth is unauthenticated", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "claudeAgent",
        statuses: [
          makeStatus("claudeAgent", {
            status: "ready",
            available: true,
            authStatus: "unauthenticated",
          }),
        ],
        claudeAuthTokenHelperCommand: "my-token-helper",
      }),
    ).toBe(true);
  });

  it("treats configured OpenClaw as selectable even when server auth state is unknown", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "openclaw",
        statuses: [],
        openclawGatewayUrl: "ws://localhost:8080",
      }),
    ).toBe(true);
  });

  it("returns selectable providers in stable picker order", () => {
    expect(
      getSelectableThreadProviders({
        statuses: [
          makeStatus("openclaw", { authStatus: "unknown" }),
          makeStatus("codex"),
          makeStatus("claudeAgent", { status: "error", authStatus: "unauthenticated" }),
        ],
      }),
    ).toEqual(["codex", "openclaw"]);
  });

  it("falls back to the first selectable provider when the preferred one is unavailable", () => {
    expect(
      resolveThreadProviderSelection({
        preferredProvider: "claudeAgent",
        selectableProviders: ["codex", "openclaw"],
      }),
    ).toBe("codex");
  });
});
