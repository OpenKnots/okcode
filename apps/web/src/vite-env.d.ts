/// <reference types="vite/client" />

import type { NativeApi, DesktopBridge, MobileBridge } from "@okcode/contracts";

interface ImportMetaEnv {
  readonly APP_VERSION: string;
  readonly APP_COMMIT_HASH: string;
  readonly APP_BUILD_TIMESTAMP: string;
  readonly APP_RELEASE_CHANNEL: "stable" | "prerelease" | "development";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    nativeApi?: NativeApi;
    desktopBridge?: DesktopBridge;
    mobileBridge?: MobileBridge;
  }
}
