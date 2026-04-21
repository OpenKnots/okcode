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

  it("blocks claudeAgent when status is error", () => {
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
      }),
    ).toBe(false);
  });

  it("blocks unauthenticated claudeAgent even when the status is otherwise ready", () => {
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
      }),
    ).toBe(false);
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

  it("shows openclaw as selectable when gateway URL is set but not yet probed", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "openclaw",
        statuses: [
          makeStatus("openclaw", {
            status: "warning",
            available: false,
            authStatus: "unknown",
          }),
        ],
        openclawGatewayUrl: "ws://gateway.example/local",
      }),
    ).toBe(true);
  });

  it("shows openclaw as selectable when status is ready && available", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "openclaw",
        statuses: [
          makeStatus("openclaw", {
            status: "ready",
            available: true,
            authStatus: "authenticated",
          }),
        ],
        openclawGatewayUrl: "",
      }),
    ).toBe(true);
  });

  it("excludes openclaw when gateway URL is blank and status is not ready", () => {
    expect(
      isProviderReadyForThreadSelection({
        provider: "openclaw",
        statuses: [
          makeStatus("openclaw", {
            status: "error",
            available: false,
            authStatus: "unauthenticated",
          }),
        ],
        openclawGatewayUrl: "",
      }),
    ).toBe(false);
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
