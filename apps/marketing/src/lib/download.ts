import type { ReleaseAsset } from "./releases";

export interface Platform {
  os: string;
  label: string;
  arch?: string;
}

export function detectPlatform(userAgent: string): Platform | null {
  if (/Win/i.test(userAgent)) return { os: "win", label: "Download for Windows" };
  if (/Mac/i.test(userAgent)) {
    return {
      os: "mac",
      label: "Download for macOS",
      arch: "arm64",
    };
  }
  if (/Linux/i.test(userAgent)) return { os: "linux", label: "Download for Linux" };
  return null;
}

export function pickAsset(assets: ReleaseAsset[], platform: Platform): string | null {
  if (platform.os === "win") {
    return assets.find((a) => a.name.endsWith("-x64.exe"))?.browser_download_url ?? null;
  }
  if (platform.os === "mac") {
    const preferred = assets.find((a) => a.name.endsWith(`-${platform.arch}.dmg`));
    const fallback = assets.find((a) => a.name.endsWith(".dmg"));
    return (preferred ?? fallback)?.browser_download_url ?? null;
  }
  if (platform.os === "linux") {
    return assets.find((a) => a.name.endsWith(".AppImage"))?.browser_download_url ?? null;
  }
  return null;
}
