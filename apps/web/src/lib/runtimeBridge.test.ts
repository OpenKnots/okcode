import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  hasRuntimeConnectionTarget,
  resolveRuntimeWsUrl,
  resolveServerHttpOrigin,
} from "./runtimeBridge";

const originalWindow = globalThis.window;

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        protocol: "https:",
        hostname: "okcode.local",
        port: "3773",
        origin: "https://okcode.local:3773",
      },
      desktopBridge: undefined,
      mobileBridge: undefined,
    },
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
});

describe("runtimeBridge", () => {
  it("prefers the mobile runtime websocket URL when present", () => {
    window.mobileBridge = {
      getWsUrl: () => "wss://pair.example/ws?token=secret",
      getPairingState: async () => ({
        paired: true,
        serverUrl: "https://pair.example",
        tokenPresent: true,
        lastError: null,
      }),
      applyPairingUrl: async () => ({
        paired: true,
        serverUrl: "https://pair.example",
        tokenPresent: true,
        lastError: null,
      }),
      clearPairing: async () => ({
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: null,
      }),
      openExternal: async () => true,
      onPairingState: () => () => {},
    };

    expect(resolveRuntimeWsUrl()).toBe("wss://pair.example/ws?token=secret");
    expect(resolveServerHttpOrigin()).toBe("https://pair.example");
    expect(hasRuntimeConnectionTarget()).toBe(true);
  });

  it("treats an unpaired mobile shell as lacking a connection target", () => {
    window.mobileBridge = {
      getWsUrl: () => null,
      getPairingState: async () => ({
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: null,
      }),
      applyPairingUrl: async () => ({
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: null,
      }),
      clearPairing: async () => ({
        paired: false,
        serverUrl: null,
        tokenPresent: false,
        lastError: null,
      }),
      openExternal: async () => true,
      onPairingState: () => () => {},
    };

    expect(hasRuntimeConnectionTarget()).toBe(false);
    expect(resolveRuntimeWsUrl()).toBe("wss://okcode.local:3773");
  });
});
