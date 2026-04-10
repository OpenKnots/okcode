import { describe, expect, it } from "vitest";
import type { ServerProviderStatus } from "@okcode/contracts";
import {
  getProviderSetupPhase,
  getProviderStatusDescription,
  getProviderStatusHeading,
} from "./providerStatusPresentation";

function makeStatus(overrides: Partial<ServerProviderStatus> = {}): ServerProviderStatus {
  return {
    provider: "codex",
    status: "ready",
    available: true,
    authStatus: "authenticated",
    checkedAt: "2026-03-31T12:00:00.000Z",
    ...overrides,
  };
}

describe("getProviderSetupPhase", () => {
  it("prioritizes install when the provider is unavailable", () => {
    expect(
      getProviderSetupPhase(
        makeStatus({
          available: false,
          status: "error",
          authStatus: "unknown",
        }),
      ),
    ).toBe("install");
  });

  it("classifies available but signed-out providers as authenticate", () => {
    expect(
      getProviderSetupPhase(
        makeStatus({
          status: "error",
          authStatus: "unauthenticated",
        }),
      ),
    ).toBe("authenticate");
  });

  it("uses verify for degraded providers with unknown auth state", () => {
    expect(
      getProviderSetupPhase(
        makeStatus({
          status: "warning",
          authStatus: "unknown",
        }),
      ),
    ).toBe("verify");
  });
});

describe("provider auth copy", () => {
  it("produces auth-specific headings", () => {
    expect(
      getProviderStatusHeading(
        makeStatus({
          provider: "claudeAgent",
          status: "error",
          authStatus: "unauthenticated",
        }),
      ),
    ).toBe("Claude Code needs authentication");
  });

  it("preserves explicit provider detail messages", () => {
    expect(
      getProviderStatusDescription(
        makeStatus({
          status: "warning",
          authStatus: "unknown",
          message: "Codex CLI authentication status command is unavailable in this Codex version.",
        }),
      ),
    ).toBe("Codex CLI authentication status command is unavailable in this Codex version.");
  });
});
