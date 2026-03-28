import { type BrowserWindow, Menu, MenuItem, WebContentsView } from "electron";
import type {
  DesktopPreviewBounds,
  PreviewCreateTabResult,
  PreviewNavigateResult,
  PreviewTabId,
  PreviewTabState,
  PreviewTabsState,
} from "@okcode/contracts";
import { randomUUID } from "node:crypto";

import { sanitizeDesktopPreviewBounds, validateDesktopPreviewUrl } from "./preview";
import { projectPreviewBoundsToContent } from "./previewBounds";

const PREVIEW_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

const ZERO_BOUNDS = { x: 0, y: 0, width: 0, height: 0 } as const;

interface TabEntry {
  id: PreviewTabId;
  view: WebContentsView;
  state: PreviewTabState;
}

function createClosedTabState(tabId: PreviewTabId): PreviewTabState {
  return {
    tabId,
    status: "closed",
    url: null,
    title: null,
    error: null,
    canGoBack: false,
    canGoForward: false,
    devToolsOpen: false,
  };
}

export class DesktopPreviewController {
  private tabs: Map<PreviewTabId, TabEntry> = new Map();
  private activeTabId: PreviewTabId | null = null;
  private bounds: DesktopPreviewBounds = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
    viewportWidth: 0,
    viewportHeight: 0,
  };
  private disposingTab = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly onStateChange: (state: PreviewTabsState) => void,
  ) {}

  getState(): PreviewTabsState {
    return this.buildTabsState();
  }

  async createTab(input: { url: unknown; title?: unknown }): Promise<PreviewCreateTabResult> {
    const validatedUrl = validateDesktopPreviewUrl(input.url);
    if (!validatedUrl.ok) {
      // Still create the tab but in error state
      const tabId = randomUUID();
      const tabState: PreviewTabState = {
        tabId,
        status: "error",
        url: null,
        title: null,
        error: validatedUrl.error,
        canGoBack: false,
        canGoForward: false,
        devToolsOpen: false,
      };
      // Don't actually create a view for invalid URLs
      return { tabId, state: this.buildTabsState() };
    }

    const tabId = randomUUID();
    const nextTitle =
      typeof input.title === "string" && input.title.trim().length > 0 ? input.title : null;

    const view = this.createView(tabId);
    const tabState: PreviewTabState = {
      tabId,
      status: "loading",
      url: validatedUrl.url,
      title: nextTitle,
      error: null,
      canGoBack: false,
      canGoForward: false,
      devToolsOpen: false,
    };

    const entry: TabEntry = { id: tabId, view, state: tabState };
    this.tabs.set(tabId, entry);

    // Switch to this tab
    this.activateTabInternal(tabId);

    // Load URL
    void view.webContents.loadURL(validatedUrl.url).catch((error: unknown) => {
      const tab = this.tabs.get(tabId);
      if (!tab || tab.view !== view) return;
      tab.state = {
        ...tab.state,
        status: "error",
        error: {
          code: "load-failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
      this.broadcastState();
    });

    const state = this.buildTabsState();
    return { tabId, state };
  }

  closeTab(tabId: PreviewTabId): PreviewTabsState {
    const entry = this.tabs.get(tabId);
    if (!entry) return this.buildTabsState();

    this.disposeTabView(entry);
    this.tabs.delete(tabId);

    // If this was the active tab, activate an adjacent one
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      this.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1]! : null;
      if (this.activeTabId) {
        this.applyActiveTabBounds();
      }
    }

    return this.broadcastState();
  }

  activateTab(tabId: PreviewTabId): PreviewTabsState {
    if (!this.tabs.has(tabId)) return this.buildTabsState();
    this.activateTabInternal(tabId);
    return this.broadcastState();
  }

  goBack(): void {
    const view = this.getActiveView();
    if (!view || view.webContents.isDestroyed() || !view.webContents.canGoBack()) return;
    view.webContents.goBack();
  }

  goForward(): void {
    const view = this.getActiveView();
    if (!view || view.webContents.isDestroyed() || !view.webContents.canGoForward()) return;
    view.webContents.goForward();
  }

  reload(): void {
    this.getActiveView()?.webContents.reload();
  }

  async navigate(input: { url: unknown }): Promise<PreviewNavigateResult> {
    const activeEntry = this.getActiveEntry();
    if (!activeEntry) {
      return { accepted: false, state: this.buildTabsState() };
    }

    const validatedUrl = validateDesktopPreviewUrl(input.url);
    if (!validatedUrl.ok) {
      activeEntry.state = {
        ...activeEntry.state,
        status: "error",
        error: validatedUrl.error,
      };
      return { accepted: false, state: this.broadcastState() };
    }

    activeEntry.state = {
      ...activeEntry.state,
      status: "loading",
      url: validatedUrl.url,
      error: null,
    };
    this.broadcastState();

    void activeEntry.view.webContents.loadURL(validatedUrl.url).catch((error: unknown) => {
      const tab = this.tabs.get(activeEntry.id);
      if (!tab || tab.view !== activeEntry.view) return;
      tab.state = {
        ...tab.state,
        status: "error",
        error: {
          code: "load-failed",
          message: error instanceof Error ? error.message : String(error),
        },
      };
      this.broadcastState();
    });

    return { accepted: true, state: this.buildTabsState() };
  }

  toggleDevTools(): void {
    const view = this.getActiveView();
    if (!view || view.webContents.isDestroyed()) return;
    view.webContents.toggleDevTools();
  }

  closeAll(): void {
    for (const entry of this.tabs.values()) {
      this.disposeTabView(entry);
    }
    this.tabs.clear();
    this.activeTabId = null;
    this.broadcastState();
  }

  setBounds(bounds: DesktopPreviewBounds): void {
    this.bounds = sanitizeDesktopPreviewBounds(bounds);
    this.applyActiveTabBounds();
    this.broadcastState();
  }

  destroy(): void {
    this.closeAll();
  }

  // --- Private helpers ---

  private createView(tabId: PreviewTabId): WebContentsView {
    const view = new WebContentsView({
      webPreferences: PREVIEW_WEB_PREFERENCES,
    });
    view.setBorderRadius(8);
    this.window.contentView.addChildView(view);
    // Start hidden
    view.setBounds(ZERO_BOUNDS);
    this.bindView(tabId, view);
    return view;
  }

  private bindView(tabId: PreviewTabId, view: WebContentsView): void {
    const { webContents } = view;

    webContents.on("did-start-loading", () => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = {
        ...tab.state,
        status: "loading",
        url: webContents.getURL() || tab.state.url,
        error: null,
      };
      this.broadcastState();
    });

    webContents.on("did-stop-loading", () => {
      const tab = this.tabs.get(tabId);
      if (!tab || tab.state.status === "error") return;
      tab.state = {
        ...tab.state,
        status: "ready",
        url: webContents.getURL() || tab.state.url,
        title: webContents.getTitle() || tab.state.title,
        canGoBack: webContents.canGoBack(),
        canGoForward: webContents.canGoForward(),
      };
      this.broadcastState();
    });

    webContents.on("did-navigate", (_event, url) => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = {
        ...tab.state,
        url,
        canGoBack: webContents.canGoBack(),
        canGoForward: webContents.canGoForward(),
      };
      this.broadcastState();
    });

    webContents.on("did-navigate-in-page", (_event, url) => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = {
        ...tab.state,
        url,
        canGoBack: webContents.canGoBack(),
        canGoForward: webContents.canGoForward(),
      };
      this.broadcastState();
    });

    webContents.on("page-title-updated", (event, title) => {
      event.preventDefault();
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = { ...tab.state, title: title || null };
      this.broadcastState();
    });

    webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return; // -3 = aborted
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        tab.state = {
          ...tab.state,
          status: "error",
          url: validatedUrl || tab.state.url,
          error: {
            code: "load-failed",
            message: errorDescription || "Page failed to load.",
          },
        };
        this.broadcastState();
      },
    );

    webContents.on("render-process-gone", () => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = {
        ...tab.state,
        status: "error",
        error: { code: "process-gone", message: "Tab process exited unexpectedly." },
      };
      this.broadcastState();
    });

    webContents.once("destroyed", () => {
      if (this.disposingTab) return;
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = {
        ...tab.state,
        status: "error",
        error: { code: "process-gone", message: "Tab process exited unexpectedly." },
      };
      this.broadcastState();
    });

    // DevTools tracking
    webContents.on("devtools-opened", () => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = { ...tab.state, devToolsOpen: true };
      this.broadcastState();
    });

    webContents.on("devtools-closed", () => {
      const tab = this.tabs.get(tabId);
      if (!tab) return;
      tab.state = { ...tab.state, devToolsOpen: false };
      this.broadcastState();
    });

    // Unrestricted navigation: no will-navigate blocker

    // window.open() → create a new tab
    webContents.setWindowOpenHandler((details) => {
      void this.createTab({ url: details.url });
      return { action: "deny" };
    });

    // Right-click context menu with "Inspect Element"
    webContents.on("context-menu", (_event, params) => {
      const menu = new Menu();
      if (params.linkURL) {
        menu.append(
          new MenuItem({
            label: "Open Link in New Tab",
            click: () => {
              void this.createTab({ url: params.linkURL });
            },
          }),
        );
        menu.append(new MenuItem({ type: "separator" }));
      }
      menu.append(
        new MenuItem({
          label: "Back",
          enabled: webContents.canGoBack(),
          click: () => webContents.goBack(),
        }),
      );
      menu.append(
        new MenuItem({
          label: "Forward",
          enabled: webContents.canGoForward(),
          click: () => webContents.goForward(),
        }),
      );
      menu.append(
        new MenuItem({
          label: "Reload",
          click: () => webContents.reload(),
        }),
      );
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(
        new MenuItem({
          label: "Inspect Element",
          click: () => {
            webContents.inspectElement(params.x, params.y);
          },
        }),
      );
      menu.popup();
    });
  }

  private activateTabInternal(tabId: PreviewTabId): void {
    // Hide current active tab
    if (this.activeTabId && this.activeTabId !== tabId) {
      const oldEntry = this.tabs.get(this.activeTabId);
      if (oldEntry && !oldEntry.view.webContents.isDestroyed()) {
        oldEntry.view.setBounds(ZERO_BOUNDS);
      }
    }

    this.activeTabId = tabId;
    this.applyActiveTabBounds();
  }

  private applyActiveTabBounds(): void {
    if (!this.activeTabId) return;
    const entry = this.tabs.get(this.activeTabId);
    if (!entry || entry.view.webContents.isDestroyed()) return;

    const nextBounds = projectPreviewBoundsToContent(this.bounds, this.window.getContentBounds());
    entry.view.setBounds(nextBounds);
  }

  private getActiveEntry(): TabEntry | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) ?? null;
  }

  private getActiveView(): WebContentsView | null {
    return this.getActiveEntry()?.view ?? null;
  }

  private disposeTabView(entry: TabEntry): void {
    this.disposingTab = true;
    try {
      this.window.contentView.removeChildView(entry.view);
    } catch {
      // Window may already be torn down.
    }
    if (!entry.view.webContents.isDestroyed()) {
      entry.view.webContents.close({ waitForBeforeUnload: false });
    }
    entry.view.webContents.removeAllListeners();
    this.disposingTab = false;
  }

  private buildTabsState(): PreviewTabsState {
    const tabs: PreviewTabState[] = [];
    for (const entry of this.tabs.values()) {
      // Refresh navigation state from live webContents
      const wc = entry.view.webContents;
      if (!wc.isDestroyed()) {
        entry.state = {
          ...entry.state,
          canGoBack: wc.canGoBack(),
          canGoForward: wc.canGoForward(),
        };
      }
      tabs.push(entry.state);
    }

    const visible = this.bounds.visible && tabs.length > 0 && this.activeTabId !== null;

    return {
      tabs,
      activeTabId: this.activeTabId,
      visible,
    };
  }

  private broadcastState(): PreviewTabsState {
    const state = this.buildTabsState();
    this.onStateChange(state);
    return state;
  }
}
