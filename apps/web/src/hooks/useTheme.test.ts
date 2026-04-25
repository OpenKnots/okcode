import { describe, expect, it } from "vitest";

import {
  CODE_FONTS,
  COLOR_THEMES,
  DEFAULT_CODE_FONT,
  DEFAULT_MESSAGE_FONT,
  MESSAGE_FONTS,
  getCodeFontStack,
  getMessageFontStack,
  isCodeFont,
  isMessageFont,
} from "./themeConfig";

describe("COLOR_THEMES", () => {
  it("includes the Hot Tamale preset", () => {
    expect(COLOR_THEMES.some((theme) => theme.id === "hot-tamale")).toBe(true);
  });
});

describe("MESSAGE_FONTS catalogue", () => {
  it("exposes 8+ options covering both neutral sans and femme-fatale serifs", () => {
    expect(MESSAGE_FONTS.length).toBeGreaterThanOrEqual(8);
    const ids = MESSAGE_FONTS.map((f) => f.id);
    // Preserved legacy picks so existing users aren't orphaned.
    expect(ids).toContain("inter");
    expect(ids).toContain("dm-sans");
    // Femme-fatale lineup.
    expect(ids).toContain("playfair-display");
    expect(ids).toContain("italiana");
    expect(ids).toContain("cinzel");
  });

  it("ships a non-empty CSS stack for every option", () => {
    for (const option of MESSAGE_FONTS) {
      expect(option.stack.trim().length).toBeGreaterThan(0);
      // Every stack falls through to a generic family so there is always a
      // renderable font even if Google Fonts failed to load.
      expect(option.stack).toMatch(/sans-serif|serif|monospace/);
    }
  });

  it("points DEFAULT_MESSAGE_FONT at a known option", () => {
    expect(MESSAGE_FONTS.some((f) => f.id === DEFAULT_MESSAGE_FONT)).toBe(true);
  });
});

describe("CODE_FONTS catalogue", () => {
  it("exposes 8+ options and includes the femme-fatale monos", () => {
    expect(CODE_FONTS.length).toBeGreaterThanOrEqual(8);
    const ids = CODE_FONTS.map((f) => f.id);
    expect(ids).toContain("jetbrains-mono");
    // Victor Mono is the signature cursive-italic code font.
    expect(ids).toContain("victor-mono");
    expect(ids).toContain("cascadia-code");
  });

  it("terminates every stack with a monospace fallback", () => {
    for (const option of CODE_FONTS) {
      expect(option.stack).toMatch(/monospace\s*$/);
    }
  });

  it("points DEFAULT_CODE_FONT at a known option", () => {
    expect(CODE_FONTS.some((f) => f.id === DEFAULT_CODE_FONT)).toBe(true);
  });
});

describe("font type guards", () => {
  it("isMessageFont returns true for every catalogue id and false otherwise", () => {
    for (const option of MESSAGE_FONTS) {
      expect(isMessageFont(option.id)).toBe(true);
    }
    expect(isMessageFont("jetbrains-mono")).toBe(false); // code id, not message
    expect(isMessageFont("comic-sans")).toBe(false);
    expect(isMessageFont(null)).toBe(false);
    expect(isMessageFont(undefined)).toBe(false);
    expect(isMessageFont(42)).toBe(false);
  });

  it("isCodeFont returns true for every catalogue id and false otherwise", () => {
    for (const option of CODE_FONTS) {
      expect(isCodeFont(option.id)).toBe(true);
    }
    expect(isCodeFont("inter")).toBe(false); // message id, not code
    expect(isCodeFont("")).toBe(false);
    expect(isCodeFont(null)).toBe(false);
  });
});

describe("font stack resolvers", () => {
  it("returns the matching stack for known ids", () => {
    expect(getMessageFontStack("playfair-display")).toContain("Playfair Display");
    expect(getCodeFontStack("victor-mono")).toContain("Victor Mono");
  });

  it("falls back to the first catalogue entry for an unknown id (edge case)", () => {
    // `any` cast simulates a corrupt storage value reaching the resolver.
    const messageFallback = getMessageFontStack("totally-fake" as never);
    const codeFallback = getCodeFontStack("also-fake" as never);
    const firstMessage = MESSAGE_FONTS[0];
    const firstCode = CODE_FONTS[0];
    expect(firstMessage).toBeDefined();
    expect(firstCode).toBeDefined();
    expect(messageFallback).toBe(firstMessage?.stack);
    expect(codeFallback).toBe(firstCode?.stack);
  });
});
