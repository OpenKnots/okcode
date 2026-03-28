import type { DesktopBridge, MobileBridge } from "@okcode/contracts";

function readWindow(): (Window & typeof globalThis) | undefined {
  return typeof window === "undefined" ? undefined : window;
}

export function readDesktopBridge(): DesktopBridge | undefined {
  return readWindow()?.desktopBridge;
}

export function readMobileBridge(): MobileBridge | undefined {
  return readWindow()?.mobileBridge;
}

export function isMobileShell(): boolean {
  return readMobileBridge() !== undefined;
}

export function hasRuntimeConnectionTarget(): boolean {
  const mobileBridge = readMobileBridge();
  if (!mobileBridge) {
    return true;
  }

  const wsUrl = mobileBridge.getWsUrl();
  return typeof wsUrl === "string" && wsUrl.length > 0;
}

export function resolveRuntimeWsUrl(explicitUrl?: string): string {
  if (typeof explicitUrl === "string" && explicitUrl.length > 0) {
    return explicitUrl;
  }

  const runtimeWsUrl = readDesktopBridge()?.getWsUrl() ?? readMobileBridge()?.getWsUrl();
  if (typeof runtimeWsUrl === "string" && runtimeWsUrl.length > 0) {
    return runtimeWsUrl;
  }

  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (typeof envUrl === "string" && envUrl.length > 0) {
    return envUrl;
  }

  const currentWindow = readWindow();
  if (!currentWindow) {
    return "";
  }

  const protocol = currentWindow.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${currentWindow.location.hostname}:${currentWindow.location.port}`;
}

export function resolveServerHttpOrigin(): string {
  const wsUrl = resolveRuntimeWsUrl();
  const currentWindow = readWindow();
  if (wsUrl.length === 0) {
    return currentWindow?.location.origin ?? "";
  }

  const httpUrl = wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  try {
    return new URL(httpUrl).origin;
  } catch {
    return httpUrl;
  }
}
