import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "@okcode/contracts";

const PICK_FOLDER_CHANNEL = "desktop:pick-folder";
const CONFIRM_CHANNEL = "desktop:confirm";
const SET_THEME_CHANNEL = "desktop:set-theme";
const SET_WINDOW_OPACITY_CHANNEL = "desktop:set-window-opacity";
const SET_SIDEBAR_OPACITY_CHANNEL = "desktop:set-sidebar-opacity";
const CONTEXT_MENU_CHANNEL = "desktop:context-menu";
const OPEN_EXTERNAL_CHANNEL = "desktop:open-external";
const MENU_ACTION_CHANNEL = "desktop:menu-action";
const UPDATE_STATE_CHANNEL = "desktop:update-state";
const UPDATE_GET_STATE_CHANNEL = "desktop:update-get-state";
const UPDATE_DOWNLOAD_CHANNEL = "desktop:update-download";
const UPDATE_INSTALL_CHANNEL = "desktop:update-install";
const PREVIEW_OPEN_CHANNEL = "desktop:preview-open";
const PREVIEW_CLOSE_CHANNEL = "desktop:preview-close";
const PREVIEW_RELOAD_CHANNEL = "desktop:preview-reload";
const PREVIEW_NAVIGATE_CHANNEL = "desktop:preview-navigate";
const PREVIEW_GET_STATE_CHANNEL = "desktop:preview-get-state";
const PREVIEW_SET_BOUNDS_CHANNEL = "desktop:preview-set-bounds";
const PREVIEW_STATE_CHANNEL = "desktop:preview-state";
const wsUrl = process.env.OKCODE_DESKTOP_WS_URL ?? null;

contextBridge.exposeInMainWorld("desktopBridge", {
  getWsUrl: () => wsUrl,
  pickFolder: () => ipcRenderer.invoke(PICK_FOLDER_CHANNEL),
  confirm: (message) => ipcRenderer.invoke(CONFIRM_CHANNEL, message),
  setTheme: (theme) => ipcRenderer.invoke(SET_THEME_CHANNEL, theme),
  setWindowOpacity: (opacity) => ipcRenderer.invoke(SET_WINDOW_OPACITY_CHANNEL, opacity),
  setSidebarOpacity: (opacity) => ipcRenderer.invoke(SET_SIDEBAR_OPACITY_CHANNEL, opacity),
  showContextMenu: (items, position) => ipcRenderer.invoke(CONTEXT_MENU_CHANNEL, items, position),
  openExternal: (url: string) => ipcRenderer.invoke(OPEN_EXTERNAL_CHANNEL, url),
  onMenuAction: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, action: unknown) => {
      if (typeof action !== "string") return;
      listener(action);
    };

    ipcRenderer.on(MENU_ACTION_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(MENU_ACTION_CHANNEL, wrappedListener);
    };
  },
  getUpdateState: () => ipcRenderer.invoke(UPDATE_GET_STATE_CHANNEL),
  downloadUpdate: () => ipcRenderer.invoke(UPDATE_DOWNLOAD_CHANNEL),
  installUpdate: () => ipcRenderer.invoke(UPDATE_INSTALL_CHANNEL),
  onUpdateState: (listener) => {
    const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      if (typeof state !== "object" || state === null) return;
      listener(state as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(UPDATE_STATE_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(UPDATE_STATE_CHANNEL, wrappedListener);
    };
  },
  preview: {
    open: (input) => ipcRenderer.invoke(PREVIEW_OPEN_CHANNEL, input),
    close: () => ipcRenderer.invoke(PREVIEW_CLOSE_CHANNEL),
    reload: () => ipcRenderer.invoke(PREVIEW_RELOAD_CHANNEL),
    navigate: (input) => ipcRenderer.invoke(PREVIEW_NAVIGATE_CHANNEL, input),
    getState: () => ipcRenderer.invoke(PREVIEW_GET_STATE_CHANNEL),
    setBounds: (bounds) => ipcRenderer.invoke(PREVIEW_SET_BOUNDS_CHANNEL, bounds),
    onState: (listener) => {
      const wrappedListener = (_event: Electron.IpcRendererEvent, state: unknown) => {
        if (typeof state !== "object" || state === null) return;
        listener(state as Parameters<typeof listener>[0]);
      };

      ipcRenderer.on(PREVIEW_STATE_CHANNEL, wrappedListener);
      return () => {
        ipcRenderer.removeListener(PREVIEW_STATE_CHANNEL, wrappedListener);
      };
    },
  },
} satisfies DesktopBridge);
