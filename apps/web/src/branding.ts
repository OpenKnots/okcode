import type { BuildMetadata, BuildSurface } from "@okcode/contracts";
import { APP_BASE_NAME } from "@okcode/shared/brand";

export { APP_BASE_NAME };

export const APP_STAGE_LABEL = import.meta.env.DEV ? "Dev" : "";
export const APP_DISPLAY_NAME = APP_STAGE_LABEL
  ? `${APP_BASE_NAME} (${APP_STAGE_LABEL})`
  : APP_BASE_NAME;
export const APP_VERSION = import.meta.env.APP_VERSION || "0.0.0";
export const APP_COMMIT_HASH = import.meta.env.APP_COMMIT_HASH.trim() || null;

function resolveAppSurface(): BuildSurface {
  if (typeof window !== "undefined") {
    if (window.mobileBridge) return "mobile";
    if (window.desktopBridge) return "desktop";
  }
  return "web";
}

function resolveBrowserPlatform(): string {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ipod")) {
    return "ios";
  }
  if (userAgent.includes("android")) {
    return "android";
  }

  const navigatorWithClientHints = navigator as Navigator & {
    readonly userAgentData?: { readonly platform?: string; readonly architecture?: string };
  };
  return (
    navigatorWithClientHints.userAgentData?.platform?.trim() || navigator.platform || "unknown"
  );
}

function resolveBrowserArch(): string {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const navigatorWithClientHints = navigator as Navigator & {
    readonly userAgentData?: { readonly platform?: string; readonly architecture?: string };
  };
  const hintedArch = navigatorWithClientHints.userAgentData?.architecture?.trim();
  if (hintedArch) {
    return hintedArch;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("arm64") || userAgent.includes("aarch64")) {
    return "arm64";
  }
  if (userAgent.includes("x86_64") || userAgent.includes("win64") || userAgent.includes("x64")) {
    return "x64";
  }
  return "unknown";
}

export const APP_BUILD_INFO: BuildMetadata = {
  version: APP_VERSION,
  commitHash: APP_COMMIT_HASH,
  platform: resolveBrowserPlatform(),
  arch: resolveBrowserArch(),
  channel: import.meta.env.DEV ? "development" : import.meta.env.APP_RELEASE_CHANNEL,
  buildTimestamp: import.meta.env.APP_BUILD_TIMESTAMP,
  surface: resolveAppSurface(),
};
