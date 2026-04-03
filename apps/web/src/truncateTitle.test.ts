import { describe, expect, it } from "vitest";

import { truncateTitle } from "./truncateTitle";

describe("truncateTitle", () => {
  it("trims surrounding whitespace", () => {
    expect(truncateTitle("   hello world   ")).toBe("hello world");
  });

  it("returns trimmed text when within max length", () => {
    expect(truncateTitle("alpha", 10)).toBe("alpha");
  });

  it("appends ellipsis when single long word exceeds max length", () => {
    expect(truncateTitle("abcdefghij", 5)).toBe("abcde...");
  });

  it("truncates at word boundary when possible", () => {
    // "hello world this" is 16 chars; lastIndexOf(" ", 16) = 11 (before "this")
    // but 16 > 11 and 11 > 16/2=8, so cuts at word boundary
    expect(truncateTitle("hello world this is a test", 14)).toBe("hello world...");
  });

  it("falls back to hard cut when last space is too early", () => {
    // "a bbbbbbbbbb..." space at index 1, which is < maxLength/2 (5)
    expect(truncateTitle("a bbbbbbbbbbbbbbbbbbbb", 10)).toBe("a bbbbbbbb...");
  });

  it("collapses multiple whitespace characters into single space", () => {
    expect(truncateTitle("hello   world\n\tnewline")).toBe("hello world newline");
  });

  it("collapses whitespace before checking length", () => {
    // After collapsing: "a b c d e f g h i" (17 chars)
    // lastIndexOf(" ", 10) finds space at index 9 (before "f"), 9 > 10/2=5, cuts at word boundary
    expect(truncateTitle("a  b  c  d  e  f  g  h  i", 10)).toBe("a b c d e...");
  });

  it("uses default max length of 60", () => {
    const sixtyChars = "a".repeat(60);
    expect(truncateTitle(sixtyChars)).toBe(sixtyChars);
    expect(truncateTitle(sixtyChars + "b")).toBe(sixtyChars + "...");
  });
});
