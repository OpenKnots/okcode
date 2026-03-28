import { describe, expect, it } from "vitest";

import { createWsUrl, parseMobilePairingInput } from "./mobilePairing";

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
