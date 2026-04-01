import { describe, expect, it } from "vitest";
import { resolveAppLocale } from "./locale";

describe("resolveAppLocale", () => {
  it("returns the explicitly selected locale when supported", () => {
    expect(resolveAppLocale("fr", ["es-MX"], "en-US")).toBe("fr");
  });

  it("resolves Spanish from system locale families", () => {
    expect(resolveAppLocale("system", ["es-MX"], "en-US")).toBe("es");
  });

  it("resolves Simplified Chinese from zh-Hans", () => {
    expect(resolveAppLocale("system", ["zh-Hans-CN"], "en-US")).toBe("zh-CN");
  });

  it("falls back to English for unsupported locales", () => {
    expect(resolveAppLocale("system", ["de-DE"], "pt-BR")).toBe("en");
  });
});
