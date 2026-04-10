import { describe, expect, it } from "vitest";

import { createWsUrl, parseMobilePairingInput, tryParseCompanionBundle } from "./mobilePairing";

describe("mobilePairing", () => {
  it("parses okcode deep links", () => {
    expect(
      parseMobilePairingInput(
        "okcode://pair?server=https%3A%2F%2Fexample.com%3A3773%2Fremote&token=secret",
      ),
    ).toEqual({
      serverUrl: "https://example.com:3773/remote",
      token: "secret",
      wsUrl: "wss://example.com:3773/remote?token=secret",
    });
  });

  it("parses plain server URLs that carry the token query param", () => {
    expect(parseMobilePairingInput("http://192.168.1.42:3773/?token=abc123")).toEqual({
      serverUrl: "http://192.168.1.42:3773/",
      token: "abc123",
      wsUrl: "ws://192.168.1.42:3773/?token=abc123",
    });
  });

  it("normalizes websocket inputs to an http server URL", () => {
    expect(createWsUrl("wss://tailnet.example/okcode", "secret")).toBe(
      "wss://tailnet.example/okcode?token=secret",
    );
    expect(parseMobilePairingInput("wss://tailnet.example/okcode?token=secret")).toEqual({
      serverUrl: "https://tailnet.example/okcode",
      token: "secret",
      wsUrl: "wss://tailnet.example/okcode?token=secret",
    });
  });

  it("rejects incomplete pairing links", () => {
    expect(() => parseMobilePairingInput("okcode://pair?server=https://example.com")).toThrow(
      "auth token",
    );
  });
});

describe("tryParseCompanionBundle", () => {
  it("parses a valid companion bundle", () => {
    const bundle = {
      pairingId: "pair-123",
      bootstrapToken: "bootstrap-abc",
      endpoints: [
        { kind: "lan", url: "http://192.168.1.10:3773", reachable: true },
        { kind: "tailscale", url: "http://100.64.0.1:3773", label: "macbook", reachable: true },
      ],
      expiresAt: "2026-04-10T12:00:00Z",
      passwordRequired: false,
    };

    expect(tryParseCompanionBundle(JSON.stringify(bundle))).toEqual({
      pairingId: "pair-123",
      bootstrapToken: "bootstrap-abc",
      endpoints: bundle.endpoints,
      expiresAt: "2026-04-10T12:00:00Z",
      passwordRequired: false,
      passwordHint: undefined,
    });
  });

  it("parses a bundle with password required and hint", () => {
    const bundle = {
      pairingId: "pair-456",
      bootstrapToken: "bootstrap-xyz",
      endpoints: [{ kind: "manual", url: "http://mybox:3773", reachable: true }],
      expiresAt: "2026-04-10T13:00:00Z",
      passwordRequired: true,
      passwordHint: "The usual one",
    };

    const result = tryParseCompanionBundle(JSON.stringify(bundle));
    expect(result).not.toBeNull();
    expect(result!.passwordRequired).toBe(true);
    expect(result!.passwordHint).toBe("The usual one");
  });

  it("returns null for non-JSON input", () => {
    expect(tryParseCompanionBundle("okcode://pair?server=foo&token=bar")).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    expect(tryParseCompanionBundle(JSON.stringify({ pairingId: "abc" }))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(tryParseCompanionBundle("")).toBeNull();
  });

  it("ignores unknown extra fields in the bundle", () => {
    const bundle = {
      pairingId: "pair-789",
      bootstrapToken: "bootstrap-def",
      endpoints: [],
      expiresAt: "2026-04-10T14:00:00Z",
      passwordRequired: false,
      futureField: "should be ignored",
    };

    const result = tryParseCompanionBundle(JSON.stringify(bundle));
    expect(result).not.toBeNull();
    expect(result!.pairingId).toBe("pair-789");
  });
});
