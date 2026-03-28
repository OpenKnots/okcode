import { describe, expect, it } from "vitest";
import { detectPlatform, pickAsset } from "./download";
import type { ReleaseAsset } from "./releases";

/* -------------------------------------------------------------------------- */
/*  Fixture helpers                                                           */
/* -------------------------------------------------------------------------- */

function asset(name: string, url = `https://example.com/${name}`): ReleaseAsset {
  return { name, browser_download_url: url };
}

const SAMPLE_ASSETS: ReleaseAsset[] = [
  asset("okcode-1.0.0-arm64.dmg"),
  asset("okcode-1.0.0-x64.dmg"),
  asset("okcode-1.0.0-x64.exe"),
  asset("okcode-1.0.0-x64.AppImage"),
];

/* -------------------------------------------------------------------------- */
/*  detectPlatform                                                            */
/* -------------------------------------------------------------------------- */

describe("detectPlatform", () => {
  it("returns Windows platform for a Windows user-agent", () => {
    const result = detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    expect(result).toEqual({ os: "win", label: "Download for Windows" });
  });

  it("returns macOS platform for a macOS user-agent", () => {
    const result = detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)");
    expect(result).toEqual({ os: "mac", label: "Download for macOS", arch: "arm64" });
  });

  it("returns Linux platform for a Linux user-agent", () => {
    const result = detectPlatform("Mozilla/5.0 (X11; Linux x86_64)");
    expect(result).toEqual({ os: "linux", label: "Download for Linux" });
  });

  it("returns null for an unrecognised user-agent", () => {
    expect(detectPlatform("")).toBeNull();
    expect(detectPlatform("SomeBot/1.0")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(detectPlatform("windows")).not.toBeNull();
    expect(detectPlatform("LINUX")).not.toBeNull();
    expect(detectPlatform("mac")).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*  pickAsset                                                                 */
/* -------------------------------------------------------------------------- */

describe("pickAsset", () => {
  describe("Windows", () => {
    const platform = { os: "win", label: "Download for Windows" };

    it("selects the .exe asset", () => {
      expect(pickAsset(SAMPLE_ASSETS, platform)).toBe("https://example.com/okcode-1.0.0-x64.exe");
    });

    it("returns null when no .exe is available", () => {
      const assets = [asset("okcode-1.0.0-arm64.dmg")];
      expect(pickAsset(assets, platform)).toBeNull();
    });
  });

  describe("macOS", () => {
    it("prefers the arch-specific .dmg", () => {
      const platform = { os: "mac", label: "Download for macOS", arch: "arm64" };
      expect(pickAsset(SAMPLE_ASSETS, platform)).toBe("https://example.com/okcode-1.0.0-arm64.dmg");
    });

    it("falls back to any .dmg when arch-specific is missing", () => {
      const platform = { os: "mac", label: "Download for macOS", arch: "arm64" };
      const assets = [asset("okcode-1.0.0.dmg")];
      expect(pickAsset(assets, platform)).toBe("https://example.com/okcode-1.0.0.dmg");
    });

    it("selects x64 .dmg when arch is x64", () => {
      const platform = { os: "mac", label: "Download for macOS", arch: "x64" };
      expect(pickAsset(SAMPLE_ASSETS, platform)).toBe("https://example.com/okcode-1.0.0-x64.dmg");
    });

    it("returns null when no .dmg is available", () => {
      const platform = { os: "mac", label: "Download for macOS", arch: "arm64" };
      const assets = [asset("okcode-1.0.0-x64.exe")];
      expect(pickAsset(assets, platform)).toBeNull();
    });
  });

  describe("Linux", () => {
    const platform = { os: "linux", label: "Download for Linux" };

    it("selects the .AppImage asset", () => {
      expect(pickAsset(SAMPLE_ASSETS, platform)).toBe(
        "https://example.com/okcode-1.0.0-x64.AppImage",
      );
    });

    it("returns null when no .AppImage is available", () => {
      const assets = [asset("okcode-1.0.0-arm64.dmg")];
      expect(pickAsset(assets, platform)).toBeNull();
    });
  });

  describe("unknown platform", () => {
    it("returns null for an unrecognised OS", () => {
      const platform = { os: "freebsd", label: "Download" };
      expect(pickAsset(SAMPLE_ASSETS, platform)).toBeNull();
    });
  });

  describe("empty assets", () => {
    it("returns null when assets array is empty", () => {
      expect(pickAsset([], { os: "win", label: "Download for Windows" })).toBeNull();
      expect(pickAsset([], { os: "mac", label: "Download for macOS", arch: "arm64" })).toBeNull();
      expect(pickAsset([], { os: "linux", label: "Download for Linux" })).toBeNull();
    });
  });
});
