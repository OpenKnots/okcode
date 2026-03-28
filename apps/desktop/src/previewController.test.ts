import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openExternalMock, viewInstances, FakeWebContentsView, FakeMenu, FakeMenuItem } = vi.hoisted(
  () => {
    const openExternalMock = vi.fn();
    const viewInstances: Array<{ webContents: unknown }> = [];

    class FakeWebContents {
      private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
      private history: string[] = [];
      private historyIndex = -1;
      private destroyed = false;
      private _devToolsOpen = false;

      private addListener(event: string, listener: (...args: unknown[]) => void): void {
        const listeners = this.listeners.get(event) ?? new Set<(...args: unknown[]) => void>();
        listeners.add(listener);
        this.listeners.set(event, listeners);
      }

      on = (event: string, listener: (...args: unknown[]) => void) => {
        this.addListener(event, listener);
        return this;
      };

      once = (event: string, listener: (...args: unknown[]) => void) => {
        const wrapped = (...args: unknown[]) => {
          this.off(event, wrapped);
          listener(...args);
        };
        this.addListener(event, wrapped);
        return this;
      };

      off = (event: string, listener: (...args: unknown[]) => void) => {
        const listeners = this.listeners.get(event);
        listeners?.delete(listener);
        if (listeners && listeners.size === 0) {
          this.listeners.delete(event);
        }
        return this;
      };

      removeAllListeners = (event?: string) => {
        if (typeof event === "string") {
          this.listeners.delete(event);
        } else {
          this.listeners.clear();
        }
        return this;
      };

      emit = (event: string, ...args: unknown[]) => {
        const listeners = [...(this.listeners.get(event) ?? [])];
        for (const listener of listeners) {
          listener(...args);
        }
        return listeners.length > 0;
      };

      loadURL = vi.fn(async (url: string) => {
        if (this.destroyed) {
          throw new Error("webContents destroyed");
        }

        const nextUrl = new URL(url).toString();
        if (this.historyIndex < this.history.length - 1) {
          this.history = this.history.slice(0, this.historyIndex + 1);
        }
        this.history.push(nextUrl);
        this.historyIndex = this.history.length - 1;
        this.emit("did-start-loading");
        this.emit("did-navigate", {}, nextUrl);
        this.emit(
          "page-title-updated",
          { preventDefault: () => undefined },
          `Page ${this.historyIndex + 1}`,
        );
        this.emit("did-stop-loading");
      });

      reload = vi.fn(() => {
        if (this.destroyed || this.historyIndex < 0) {
          return;
        }
        this.emit("did-start-loading");
        this.emit("did-stop-loading");
      });

      goBack = vi.fn(() => {
        if (!this.canGoBack()) {
          return;
        }
        this.historyIndex -= 1;
        this.emit("did-start-loading");
        this.emit("did-navigate", {}, this.getURL());
        this.emit("page-title-updated", { preventDefault: () => undefined }, this.getTitle());
        this.emit("did-stop-loading");
      });

      goForward = vi.fn(() => {
        if (!this.canGoForward()) {
          return;
        }
        this.historyIndex += 1;
        this.emit("did-start-loading");
        this.emit("did-navigate", {}, this.getURL());
        this.emit("page-title-updated", { preventDefault: () => undefined }, this.getTitle());
        this.emit("did-stop-loading");
      });

      setWindowOpenHandler = vi.fn();

      inspectElement = vi.fn();

      toggleDevTools = vi.fn(() => {
        this._devToolsOpen = !this._devToolsOpen;
        if (this._devToolsOpen) {
          this.emit("devtools-opened");
        } else {
          this.emit("devtools-closed");
        }
      });

      isDestroyed = vi.fn(() => this.destroyed);

      getURL = vi.fn(() => this.history[this.historyIndex] ?? "");

      getTitle = vi.fn(() => (this.historyIndex >= 0 ? `Page ${this.historyIndex + 1}` : ""));

      canGoBack = vi.fn(() => this.historyIndex > 0);

      canGoForward = vi.fn(
        () => this.historyIndex >= 0 && this.historyIndex < this.history.length - 1,
      );

      close = vi.fn(() => {
        if (this.destroyed) {
          return;
        }
        this.destroyed = true;
        this.emit("destroyed");
      });
    }

    class FakeWebContentsView {
      webContents = new FakeWebContents();
      setBorderRadius = vi.fn();
      setBounds = vi.fn();

      constructor(_options: unknown) {
        viewInstances.push(this);
      }
    }

    class FakeMenu {
      items: Array<{ label: string; click?: () => void }> = [];
      append(item: { label: string; click?: () => void }) {
        this.items.push(item);
      }
      popup = vi.fn();
    }

    class FakeMenuItem {
      label: string;
      click: (() => void) | undefined;
      enabled: boolean;
      type: string;
      constructor(options: {
        label?: string;
        click?: () => void;
        enabled?: boolean;
        type?: string;
      }) {
        this.label = options.label ?? "";
        this.click = options.click ?? undefined;
        this.enabled = options.enabled ?? true;
        this.type = options.type ?? "normal";
      }
    }

    return { openExternalMock, viewInstances, FakeWebContentsView, FakeMenu, FakeMenuItem };
  },
);

vi.mock("electron", () => ({
  shell: {
    openExternal: openExternalMock,
  },
  WebContentsView: FakeWebContentsView,
  Menu: FakeMenu,
  MenuItem: FakeMenuItem,
}));

import type { PreviewTabsState } from "@okcode/contracts";
import { DesktopPreviewController } from "./previewController";

function createWindow() {
  return {
    contentView: {
      addChildView: vi.fn(),
      removeChildView: vi.fn(),
    },
    getContentBounds: () => ({
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    }),
  } as unknown as BrowserWindow;
}

function findTab(state: PreviewTabsState, tabId: string) {
  return state.tabs.find((t) => t.tabId === tabId);
}

describe("DesktopPreviewController", () => {
  beforeEach(() => {
    openExternalMock.mockReset();
    viewInstances.length = 0;
  });

  it("creates tabs, navigates, and supports back/forward", async () => {
    let latestState = null as PreviewTabsState | null;
    const window = createWindow();
    const controller = new DesktopPreviewController(window, (state) => {
      latestState = state;
    });

    controller.setBounds({
      x: 0,
      y: 0,
      width: 960,
      height: 640,
      visible: true,
      viewportWidth: 1024,
      viewportHeight: 768,
    });

    const { tabId: tab1Id } = await controller.createTab({
      url: "http://localhost:3000/",
      title: "Tab 1",
    });
    expect(viewInstances).toHaveLength(1);
    expect(latestState).toBeTruthy();
    expect(latestState!.activeTabId).toBe(tab1Id);
    expect(latestState!.tabs).toHaveLength(1);

    const tab1 = findTab(latestState!, tab1Id);
    expect(tab1).toMatchObject({
      status: "ready",
      url: "http://localhost:3000/",
      canGoBack: false,
      canGoForward: false,
    });

    // Navigate within the same tab
    await controller.navigate({ url: "http://localhost:3000/docs" });
    expect(viewInstances).toHaveLength(1);
    const tab1After = findTab(latestState!, tab1Id);
    expect(tab1After).toMatchObject({
      url: "http://localhost:3000/docs",
      canGoBack: true,
      canGoForward: false,
    });

    controller.goBack();
    expect(findTab(latestState!, tab1Id)).toMatchObject({
      url: "http://localhost:3000/",
      canGoBack: false,
      canGoForward: true,
    });

    controller.goForward();
    expect(findTab(latestState!, tab1Id)).toMatchObject({
      url: "http://localhost:3000/docs",
      canGoBack: true,
      canGoForward: false,
    });
  });

  it("supports multiple tabs and switching between them", async () => {
    let latestState = null as PreviewTabsState | null;
    const window = createWindow();
    const controller = new DesktopPreviewController(window, (state) => {
      latestState = state;
    });

    controller.setBounds({
      x: 0,
      y: 0,
      width: 960,
      height: 640,
      visible: true,
      viewportWidth: 1024,
      viewportHeight: 768,
    });

    const { tabId: tab1Id } = await controller.createTab({
      url: "http://localhost:3000/",
    });
    const { tabId: tab2Id } = await controller.createTab({
      url: "http://localhost:4000/",
    });

    expect(viewInstances).toHaveLength(2);
    expect(latestState!.tabs).toHaveLength(2);
    expect(latestState!.activeTabId).toBe(tab2Id);

    // Switch to tab 1
    controller.activateTab(tab1Id);
    expect(latestState!.activeTabId).toBe(tab1Id);

    // Close tab 1 — should activate tab 2
    controller.closeTab(tab1Id);
    expect(latestState!.tabs).toHaveLength(1);
    expect(latestState!.activeTabId).toBe(tab2Id);

    // Close all
    controller.closeAll();
    expect(latestState!.tabs).toHaveLength(0);
    expect(latestState!.activeTabId).toBeNull();
  });

  it("toggles devtools on the active tab", async () => {
    let latestState = null as PreviewTabsState | null;
    const window = createWindow();
    const controller = new DesktopPreviewController(window, (state) => {
      latestState = state;
    });

    controller.setBounds({
      x: 0,
      y: 0,
      width: 960,
      height: 640,
      visible: true,
      viewportWidth: 1024,
      viewportHeight: 768,
    });

    const { tabId } = await controller.createTab({ url: "http://localhost:3000/" });
    expect(findTab(latestState!, tabId)?.devToolsOpen).toBe(false);

    controller.toggleDevTools();
    expect(findTab(latestState!, tabId)?.devToolsOpen).toBe(true);

    controller.toggleDevTools();
    expect(findTab(latestState!, tabId)?.devToolsOpen).toBe(false);
  });
});
