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

/**
 * Maximum total WebContentsView instances across all threads.
 * When this limit is exceeded, the least-recently-used thread's
 * views are disposed to free resources.
 */
const MAX_TOTAL_VIEWS = 20;

interface TabEntry {
  id: PreviewTabId;
  view: WebContentsView;
  state: PreviewTabState;
}

interface ThreadTabSet {
  tabs: Map<PreviewTabId, TabEntry>;
  activeTabId: PreviewTabId | null;
}

export class DesktopPreviewController {
  /** Per-thread tab storage. */
  private threadTabs: Map<string, ThreadTabSet> = new Map();
  /** The thread whose tabs are currently visible. */
  private activeThreadId: string | null = null;
  /** LRU ordering of thread IDs (most recently used last). */
  private threadLru: string[] = [];

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

  // ── Thread management ─────────────────────────────────────────

  /**
   * Switch the active thread. Hides the current thread's tabs and
   * shows the target thread's tabs (creating the set if needed).
   */
  activateThread(threadId: string): PreviewTabsState {
    if (this.activeThreadId === threadId) {
      return this.buildTabsState();
    }

    // Hide all views from the old thread
    this.hideActiveThreadViews();

    this.activeThreadId = threadId;
    this.touchThreadLru(threadId);

    // Ensure the thread set exists
    if (!this.threadTabs.has(threadId)) {
      this.threadTabs.set(threadId, { tabs: new Map(), activeTabId: null });
    }

    // Show the active tab of the new thread
    this.applyActiveTabBounds();

    return this.broadcastState();
  }

  // ── Public API (operates on the active thread) ────────────────

  getState(): PreviewTabsState {
    return this.buildTabsState();
  }

  async createTab(input: {
    url: unknown;
    title?: unknown;
    threadId?: unknown;
  }): Promise<PreviewCreateTabResult> {
    // If a threadId is provided and differs from the active one, switch first
    const requestedThread =
      typeof input.threadId === "string" && input.threadId.length > 0
        ? input.threadId
        : this.activeThreadId;

    if (requestedThread && requestedThread !== this.activeThreadId) {
      this.activateThread(requestedThread);
    }

    const validatedUrl = validateDesktopPreviewUrl(input.url);
    if (!validatedUrl.ok) {
      const tabId = randomUUID();
      return { tabId, state: this.buildTabsState() };
    }

    // Enforce global view limit before creating a new one
    this.enforceViewLimit();

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
      isPinned: false,
    };

    const entry: TabEntry = { id: tabId, view, state: tabState };
    const threadSet = this.getActiveThreadSet();
    threadSet.tabs.set(tabId, entry);

    // Switch to this tab
    this.activateTabInternal(tabId);

    // Load URL
    void view.webContents.loadURL(validatedUrl.url).catch((error: unknown) => {
      const tab = threadSet.tabs.get(tabId);
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
    const threadSet = this.getActiveThreadSet();
    const entry = threadSet.tabs.get(tabId);
    if (!entry) return this.buildTabsState();

    // Pinned tabs cannot be closed directly — unpin first
    if (entry.state.isPinned) return this.buildTabsState();

    this.disposeTabView(entry);
    threadSet.tabs.delete(tabId);

    // If this was the active tab, activate an adjacent one
    if (threadSet.activeTabId === tabId) {
      const remaining = Array.from(threadSet.tabs.keys());
      threadSet.activeTabId = remaining.length > 0 ? remaining[remaining.length - 1]! : null;
      if (threadSet.activeTabId) {
        this.applyActiveTabBounds();
      }
    }

    return this.broadcastState();
  }

  togglePinTab(tabId: PreviewTabId): PreviewTabsState {
    const threadSet = this.getActiveThreadSet();
    const entry = threadSet.tabs.get(tabId);
    if (!entry) return this.buildTabsState();

    entry.state = { ...entry.state, isPinned: !entry.state.isPinned };
    return this.broadcastState();
  }

  activateTab(tabId: PreviewTabId): PreviewTabsState {
    const threadSet = this.getActiveThreadSet();
    if (!threadSet.tabs.has(tabId)) return this.buildTabsState();
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
      const threadSet = this.getActiveThreadSet();
      const tab = threadSet.tabs.get(activeEntry.id);
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

  /** Close all tabs for the active thread only. */
  closeAll(): void {
    const threadSet = this.threadTabs.get(this.activeThreadId ?? "");
    if (!threadSet) return;

    for (const entry of threadSet.tabs.values()) {
      this.disposeTabView(entry);
    }
    threadSet.tabs.clear();
    threadSet.activeTabId = null;
    this.broadcastState();
  }

  setBounds(bounds: DesktopPreviewBounds): void {
    this.bounds = sanitizeDesktopPreviewBounds(bounds);
    this.applyActiveTabBounds();
    this.broadcastState();
  }

  destroy(): void {
    // Destroy all tabs across all threads
    for (const threadSet of this.threadTabs.values()) {
      for (const entry of threadSet.tabs.values()) {
        this.disposeTabView(entry);
      }
      threadSet.tabs.clear();
    }
    this.threadTabs.clear();
    this.activeThreadId = null;
    this.threadLru = [];
  }

  // ── Private helpers ───────────────────────────────────────────

  private getActiveThreadSet(): ThreadTabSet {
    if (!this.activeThreadId) {
      // Create a transient "default" thread set
      const threadId = "__default__";
      this.activeThreadId = threadId;
      if (!this.threadTabs.has(threadId)) {
        this.threadTabs.set(threadId, { tabs: new Map(), activeTabId: null });
      }
    }
    return this.threadTabs.get(this.activeThreadId)!;
  }

  private hideActiveThreadViews(): void {
    if (!this.activeThreadId) return;
    const threadSet = this.threadTabs.get(this.activeThreadId);
    if (!threadSet) return;

    for (const entry of threadSet.tabs.values()) {
      if (!entry.view.webContents.isDestroyed()) {
        entry.view.setBounds(ZERO_BOUNDS);
      }
    }
  }

  private touchThreadLru(threadId: string): void {
    const idx = this.threadLru.indexOf(threadId);
    if (idx !== -1) {
      this.threadLru.splice(idx, 1);
    }
    this.threadLru.push(threadId);
  }

  /**
   * Enforce the global MAX_TOTAL_VIEWS limit by evicting the
   * least-recently-used thread's views when the cap is exceeded.
   */
  private enforceViewLimit(): void {
    let totalViews = 0;
    for (const threadSet of this.threadTabs.values()) {
      totalViews += threadSet.tabs.size;
    }

    // Evict from least-recently-used threads until under limit
    while (totalViews >= MAX_TOTAL_VIEWS && this.threadLru.length > 0) {
      const lruThreadId = this.threadLru[0]!;
      // Never evict the active thread
      if (lruThreadId === this.activeThreadId) {
        if (this.threadLru.length <= 1) break;
        // Move it to the end and try the next
        this.threadLru.shift();
        this.threadLru.push(lruThreadId);
        continue;
      }

      const threadSet = this.threadTabs.get(lruThreadId);
      if (threadSet) {
        for (const entry of threadSet.tabs.values()) {
          this.disposeTabView(entry);
          totalViews--;
        }
        threadSet.tabs.clear();
        threadSet.activeTabId = null;
      }
      this.threadLru.shift();
      this.threadTabs.delete(lruThreadId);
    }
  }

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

    // We need to look up the tab in whichever thread owns it.
    const findTab = (): TabEntry | undefined => {
      for (const threadSet of this.threadTabs.values()) {
        const tab = threadSet.tabs.get(tabId);
        if (tab) return tab;
      }
      return undefined;
    };

    webContents.on("did-start-loading", () => {
      const tab = findTab();
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
      const tab = findTab();
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
      const tab = findTab();
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
      const tab = findTab();
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
      const tab = findTab();
      if (!tab) return;
      tab.state = { ...tab.state, title: title || null };
      this.broadcastState();
    });

    webContents.on(
      "did-fail-load",
      (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return; // -3 = aborted
        const tab = findTab();
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
      const tab = findTab();
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
      const tab = findTab();
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
      const tab = findTab();
      if (!tab) return;
      tab.state = { ...tab.state, devToolsOpen: true };
      this.broadcastState();
    });

    webContents.on("devtools-closed", () => {
      const tab = findTab();
      if (!tab) return;
      tab.state = { ...tab.state, devToolsOpen: false };
      this.broadcastState();
    });

    // Unrestricted navigation: no will-navigate blocker

    // window.open() -> create a new tab in the same thread
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
    const threadSet = this.getActiveThreadSet();

    // Hide current active tab within this thread
    if (threadSet.activeTabId && threadSet.activeTabId !== tabId) {
      const oldEntry = threadSet.tabs.get(threadSet.activeTabId);
      if (oldEntry && !oldEntry.view.webContents.isDestroyed()) {
        oldEntry.view.setBounds(ZERO_BOUNDS);
      }
    }

    threadSet.activeTabId = tabId;
    this.applyActiveTabBounds();
  }

  private applyActiveTabBounds(): void {
    const threadSet = this.threadTabs.get(this.activeThreadId ?? "");
    if (!threadSet?.activeTabId) return;
    const entry = threadSet.tabs.get(threadSet.activeTabId);
    if (!entry || entry.view.webContents.isDestroyed()) return;

    const nextBounds = projectPreviewBoundsToContent(this.bounds, this.window.getContentBounds());
    entry.view.setBounds(nextBounds);
  }

  private getActiveEntry(): TabEntry | null {
    const threadSet = this.threadTabs.get(this.activeThreadId ?? "");
    if (!threadSet?.activeTabId) return null;
    return threadSet.tabs.get(threadSet.activeTabId) ?? null;
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

  /** Build state for the active thread only (what the renderer sees). */
  private buildTabsState(): PreviewTabsState {
    const threadSet = this.threadTabs.get(this.activeThreadId ?? "");
    if (!threadSet) {
      return { tabs: [], activeTabId: null, visible: false };
    }

    const tabs: PreviewTabState[] = [];
    for (const entry of threadSet.tabs.values()) {
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

    // Sort pinned tabs first, preserving insertion order within each group
    tabs.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

    const visible = this.bounds.visible && tabs.length > 0 && threadSet.activeTabId !== null;

    return {
      tabs,
      activeTabId: threadSet.activeTabId,
      visible,
    };
  }

  private broadcastState(): PreviewTabsState {
    const state = this.buildTabsState();
    this.onStateChange(state);
    return state;
  }
}
