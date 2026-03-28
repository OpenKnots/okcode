import type { BrowserWindow } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  beginPreviewElementPickMock,
  cancelPreviewElementPickMock,
  openExternalMock,
  viewInstances,
  FakeWebContentsView,
} = vi.hoisted(() => {
  const beginPreviewElementPickMock = vi.fn();
  const cancelPreviewElementPickMock = vi.fn(async () => undefined);
  const openExternalMock = vi.fn();
  const viewInstances: Array<{ webContents: unknown }> = [];

  class FakeWebContents {
    private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>();
    private history: string[] = [];
    private historyIndex = -1;
    private destroyed = false;
    private windowOpenHandler: ((details: { url: string }) => { action: "allow" | "deny" }) | null =
      null;

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

    setWindowOpenHandler = vi.fn(
      (handler: ((details: { url: string }) => { action: "allow" | "deny" }) | null) => {
        this.windowOpenHandler = handler;
        return { action: "deny" as const };
      },
    );

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

  return {
    beginPreviewElementPickMock,
    cancelPreviewElementPickMock,
    openExternalMock,
    viewInstances,
    FakeWebContentsView,
  };
});

vi.mock("electron", () => ({
  shell: {
    openExternal: openExternalMock,
  },
  WebContentsView: FakeWebContentsView,
}));

vi.mock("./previewPicker", () => ({
  beginPreviewElementPick: beginPreviewElementPickMock,
  cancelPreviewElementPick: cancelPreviewElementPickMock,
}));

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

describe("DesktopPreviewController", () => {
  beforeEach(() => {
    beginPreviewElementPickMock.mockReset();
    cancelPreviewElementPickMock.mockReset();
    cancelPreviewElementPickMock.mockResolvedValue(undefined);
    openExternalMock.mockReset();
    viewInstances.length = 0;
  });

  it("keeps browser history across open calls and exposes back/forward state", async () => {
    let latestState = null as ReturnType<DesktopPreviewController["getState"]> | null;
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

    await controller.open({ url: "http://localhost:3000/", title: "Project preview" });
    expect(viewInstances).toHaveLength(1);
    expect(latestState).toMatchObject({
      status: "ready",
      url: "http://localhost:3000/",
      canGoBack: false,
      canGoForward: false,
    });

    await controller.open({ url: "http://localhost:3000/docs", title: "Project preview" });
    expect(viewInstances).toHaveLength(1);
    expect(latestState).toMatchObject({
      status: "ready",
      url: "http://localhost:3000/docs",
      canGoBack: true,
      canGoForward: false,
    });

    controller.goBack();
    expect(latestState).toMatchObject({
      status: "ready",
      url: "http://localhost:3000/",
      canGoBack: false,
      canGoForward: true,
    });

    controller.goForward();
    expect(latestState).toMatchObject({
      status: "ready",
      url: "http://localhost:3000/docs",
      canGoBack: true,
      canGoForward: false,
    });

    controller.close();
    expect(latestState).toMatchObject({
      status: "closed",
      url: null,
      canGoBack: false,
      canGoForward: false,
    });
    expect(controller.getState()).toMatchObject({
      status: "closed",
      canGoBack: false,
      canGoForward: false,
    });
    expect(window.contentView.removeChildView).toHaveBeenCalledTimes(1);
  });

  it("tracks preview element picking state and returns the selected element", async () => {
    let latestState = null as ReturnType<DesktopPreviewController["getState"]> | null;
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

    await controller.open({ url: "http://localhost:3000/", title: "Project preview" });
    beginPreviewElementPickMock.mockResolvedValueOnce({
      pageUrl: "http://localhost:3000/",
      pageTitle: "Homepage",
      selector: 'button[data-testid="save"]',
      tagName: "button",
      role: "button",
      ariaLabel: "Save changes",
      text: "Save changes",
      href: null,
      name: null,
      placeholder: null,
    });

    const result = await controller.pickElement();

    expect(beginPreviewElementPickMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      accepted: true,
      reason: null,
      selection: {
        selector: 'button[data-testid="save"]',
        role: "button",
      },
    });
    expect(latestState).toMatchObject({
      status: "ready",
      pickingElement: false,
    });
  });

  it("cancels active preview element picking when requested", async () => {
    let latestState = null as ReturnType<DesktopPreviewController["getState"]> | null;
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

    await controller.open({ url: "http://localhost:3000/", title: "Project preview" });

    let resolvePick: ((value: null) => void) | null = null;
    beginPreviewElementPickMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePick = resolve;
        }),
    );
    cancelPreviewElementPickMock.mockImplementationOnce(async () => {
      resolvePick?.(null);
    });

    const pickResultPromise = controller.pickElement();
    expect(controller.getState().pickingElement).toBe(true);

    await controller.cancelPickElement();
    const result = await pickResultPromise;

    expect(cancelPreviewElementPickMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      accepted: true,
      selection: null,
      reason: "cancelled",
    });
    expect(latestState).toMatchObject({
      status: "ready",
      pickingElement: false,
    });
  });
});
