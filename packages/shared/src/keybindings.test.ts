import { describe, expect, it } from "vitest";

import type { ResolvedKeybindingsConfig } from "@okcode/contracts";

import {
  DEFAULT_KEYBINDINGS,
  defaultKeybindingRulesForCommand,
  encodeKeybindingShortcut,
  keybindingValueFromShortcutEvent,
  keybindingValuesForCommand,
  normalizeRecordedShortcutKeyToken,
  parseKeybindingShortcut,
} from "./keybindings";

describe("parseKeybindingShortcut", () => {
  it("parses plus-key shortcuts", () => {
    expect(parseKeybindingShortcut("mod++")).toEqual({
      key: "+",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      modKey: true,
    });
  });

  it("normalizes esc and space tokens", () => {
    expect(parseKeybindingShortcut("mod+esc")?.key).toBe("escape");
    expect(parseKeybindingShortcut("mod+space")?.key).toBe(" ");
  });
});

describe("encodeKeybindingShortcut", () => {
  it("encodes escape with the shared token format", () => {
    expect(
      encodeKeybindingShortcut({
        key: "escape",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        modKey: true,
      }),
    ).toBe("mod+esc");
  });
});

describe("normalizeRecordedShortcutKeyToken", () => {
  it("ignores modifier-only keys", () => {
    expect(normalizeRecordedShortcutKeyToken("Meta")).toBeNull();
    expect(normalizeRecordedShortcutKeyToken("Shift")).toBeNull();
  });

  it("accepts punctuation and navigation keys", () => {
    expect(normalizeRecordedShortcutKeyToken("+")).toBe("+");
    expect(normalizeRecordedShortcutKeyToken("ArrowDown")).toBe("arrowdown");
  });
});

describe("keybindingValueFromShortcutEvent", () => {
  it("records mod on macOS using the meta key", () => {
    expect(
      keybindingValueFromShortcutEvent(
        {
          key: "k",
          metaKey: true,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        },
        "MacIntel",
      ),
    ).toBe("mod+k");
  });

  it("records mod on Windows using control and preserves meta separately", () => {
    expect(
      keybindingValueFromShortcutEvent(
        {
          key: "k",
          metaKey: true,
          ctrlKey: true,
          shiftKey: false,
          altKey: false,
        },
        "Win32",
      ),
    ).toBe("mod+meta+k");
  });

  it("requires at least one modifier", () => {
    expect(
      keybindingValueFromShortcutEvent(
        {
          key: "k",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
        },
        "Linux",
      ),
    ).toBeNull();
  });
});

describe("defaultKeybindingRulesForCommand", () => {
  it("returns the built-in alternate defaults for terminal.toggle", () => {
    expect(defaultKeybindingRulesForCommand("terminal.toggle")).toEqual(
      DEFAULT_KEYBINDINGS.filter((rule) => rule.command === "terminal.toggle"),
    );
  });
});

describe("keybindingValuesForCommand", () => {
  it("returns encoded values from resolved keybindings without duplicates", () => {
    const bindings = [
      {
        command: "chat.new",
        shortcut: {
          key: "n",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          modKey: true,
        },
      },
      {
        command: "chat.new",
        shortcut: {
          key: "n",
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          modKey: true,
        },
      },
      {
        command: "chat.new",
        shortcut: {
          key: "o",
          metaKey: false,
          ctrlKey: false,
          shiftKey: true,
          altKey: false,
          modKey: true,
        },
      },
    ] satisfies ResolvedKeybindingsConfig;

    expect(keybindingValuesForCommand(bindings, "chat.new")).toEqual(["mod+n", "mod+shift+o"]);
  });
});
