import { type BrowserWindow, type HandlerDetails, shell, WebContentsView } from "electron";
import type {
  DesktopPreviewBounds,
  DesktopPreviewState,
  PreviewNavigateResult,
  PreviewOpenResult,
} from "@okcode/contracts";

import {
  createClosedPreviewState,
  createPreviewErrorState,
  sanitizeDesktopPreviewBounds,
  validateDesktopPreviewUrl,
} from "./preview";

const PREVIEW_WEB_PREFERENCES = {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
} as const;

const ABORTED_LOAD_ERROR_CODE = -3;
const NAVIGATION_BLOCKED_MESSAGE = "Blocked navigation outside the local preview policy.";
const PROCESS_GONE_MESSAGE = "Preview process exited unexpectedly.";

function previewVisible(state: DesktopPreviewState, bounds: DesktopPreviewBounds): boolean {
  return bounds.visible && state.status !== "closed";
}

export class DesktopPreviewController {
  private view: WebContentsView | null = null;
  private state: DesktopPreviewState = createClosedPreviewState();
  private bounds: DesktopPreviewBounds = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  };
  private unsubscribers: Array<() => void> = [];
  private disposingView = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly onStateChange: (state: DesktopPreviewState) => void,
  ) {}

  getState(): DesktopPreviewState {
    return this.state;
  }

  async open(input: { url: unknown; title?: unknown }): Promise<PreviewOpenResult> {
    const validatedUrl = validateDesktopPreviewUrl(input.url);
    if (!validatedUrl.ok) {
      this.setState(
        createPreviewErrorState(validatedUrl.error.code, validatedUrl.error.message, {
          url: this.state.url,
          title: this.state.title,
        }),
      );
      return { accepted: false, state: this.state };
    }

    const nextTitle =
      typeof input.title === "string" && input.title.trim().length > 0 ? input.title : null;
    const view = this.ensureView();
    this.setState({
      status: "loading",
      url: validatedUrl.url,
      title: nextTitle ?? this.state.title,
      visible: previewVisible(
        {
          status: "loading",
          url: validatedUrl.url,
          title: nextTitle ?? this.state.title,
          visible: this.state.visible,
          error: null,
        },
        this.bounds,
      ),
      error: null,
    });

    void view.webContents.loadURL(validatedUrl.url).catch((error: unknown) => {
      if (this.view !== view) {
        return;
      }
      this.setState(
        createPreviewErrorState(
          "load-failed",
          error instanceof Error ? error.message : String(error),
          {
            url: validatedUrl.url,
            title: this.state.title,
          },
        ),
      );
    });

    return { accepted: true, state: this.state };
  }

  async navigate(input: { url: unknown }): Promise<PreviewNavigateResult> {
    if (!this.view) {
      return {
        accepted: false,
        state: createClosedPreviewState(),
      };
    }

    const result = await this.open({ url: input.url, title: this.state.title });
    return {
      accepted: result.accepted,
      state: result.state,
    };
  }

  reload(): void {
    this.view?.webContents.reload();
  }

  close(): void {
    this.disposeView();
    this.setState(createClosedPreviewState());
  }

  setBounds(bounds: DesktopPreviewBounds): void {
    this.bounds = sanitizeDesktopPreviewBounds(bounds);
    this.applyViewBounds();
    if (this.state.status !== "closed") {
      this.setState({
        ...this.state,
        visible: previewVisible(this.state, this.bounds),
      });
    }
  }

  destroy(): void {
    this.disposeView();
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }

  private ensureView(): WebContentsView {
    if (this.view && !this.view.webContents.isDestroyed()) {
      this.applyViewBounds();
      return this.view;
    }

    const view = new WebContentsView({
      webPreferences: PREVIEW_WEB_PREFERENCES,
    });
    this.view = view;
    this.window.contentView.addChildView(view);
    this.bindView(view);
    this.applyViewBounds();
    return view;
  }

  private bindView(view: WebContentsView): void {
    const { webContents } = view;

    const onDidStartLoading = () => {
      this.setState({
        status: "loading",
        url: webContents.getURL() || this.state.url,
        title: this.state.title,
        visible: previewVisible(this.state, this.bounds),
        error: null,
      });
    };
    const onDidStopLoading = () => {
      if (this.state.status === "error" || this.state.status === "closed") {
        return;
      }
      this.setState({
        status: "ready",
        url: webContents.getURL() || this.state.url,
        title: webContents.getTitle() || this.state.title,
        visible: previewVisible(this.state, this.bounds),
        error: null,
      });
    };
    const onDidNavigate = (url: string) => {
      this.setState({
        ...this.state,
        url,
      });
    };
    const onPageTitleUpdated = (event: Electron.Event, title: string) => {
      event.preventDefault();
      this.setState({
        ...this.state,
        title: title || null,
      });
    };
    const onDidFailLoad = (
      _event: Electron.Event,
      errorCode: number,
      errorDescription: string,
      validatedUrl: string,
      isMainFrame: boolean,
    ) => {
      if (!isMainFrame || errorCode === ABORTED_LOAD_ERROR_CODE) {
        return;
      }
      this.setState(
        createPreviewErrorState("load-failed", errorDescription || "Preview failed to load.", {
          url: validatedUrl || this.state.url,
          title: this.state.title,
        }),
      );
    };
    const onRenderProcessGone = () => {
      this.setState(
        createPreviewErrorState("process-gone", PROCESS_GONE_MESSAGE, {
          url: this.state.url,
          title: this.state.title,
        }),
      );
    };
    const onDestroyed = () => {
      if (this.disposingView) {
        return;
      }
      this.view = null;
      this.setState(
        createPreviewErrorState("process-gone", PROCESS_GONE_MESSAGE, {
          url: this.state.url,
          title: this.state.title,
        }),
      );
    };

    webContents.setWindowOpenHandler((details) => this.handleWindowOpen(details));
    webContents.on("will-navigate", this.handleWillNavigate);
    webContents.on("did-start-loading", onDidStartLoading);
    webContents.on("did-stop-loading", onDidStopLoading);
    webContents.on("did-navigate", (_event, url) => onDidNavigate(url));
    webContents.on("did-navigate-in-page", (_event, url) => onDidNavigate(url));
    webContents.on("page-title-updated", onPageTitleUpdated);
    webContents.on("did-fail-load", onDidFailLoad);
    webContents.on("render-process-gone", onRenderProcessGone);
    webContents.once("destroyed", onDestroyed);
  }

  private readonly handleWillNavigate = (event: Electron.Event, url: string) => {
    const validatedUrl = validateDesktopPreviewUrl(url);
    if (validatedUrl.ok) {
      return;
    }

    event.preventDefault();
    this.setState(
      createPreviewErrorState("navigation-blocked", NAVIGATION_BLOCKED_MESSAGE, {
        url: this.state.url,
        title: this.state.title,
      }),
    );
  };

  private handleWindowOpen(details: HandlerDetails): Electron.WindowOpenHandlerResponse {
    const validatedUrl = validateDesktopPreviewUrl(details.url);
    if (validatedUrl.ok) {
      void shell.openExternal(validatedUrl.url);
      return { action: "deny" };
    }

    this.setState(
      createPreviewErrorState("navigation-blocked", NAVIGATION_BLOCKED_MESSAGE, {
        url: this.state.url,
        title: this.state.title,
      }),
    );
    return { action: "deny" };
  }

  private applyViewBounds(): void {
    if (!this.view || this.view.webContents.isDestroyed()) {
      return;
    }

    const nextBounds = this.bounds.visible
      ? {
          x: this.bounds.x,
          y: this.bounds.y,
          width: this.bounds.width,
          height: this.bounds.height,
        }
      : { x: 0, y: 0, width: 0, height: 0 };
    this.view.setBounds(nextBounds);
  }

  private disposeView(): void {
    const existingView = this.view;
    if (!existingView) {
      return;
    }

    this.disposingView = true;
    this.view = null;
    try {
      this.window.contentView.removeChildView(existingView);
    } catch {
      // Window may already be torn down.
    }
    if (!existingView.webContents.isDestroyed()) {
      existingView.webContents.close({ waitForBeforeUnload: false });
    }
    existingView.webContents.removeAllListeners();
    this.disposingView = false;
  }

  private setState(nextState: DesktopPreviewState): void {
    this.state = {
      ...nextState,
      visible: previewVisible(nextState, this.bounds),
    };
    this.onStateChange(this.state);
  }
}
