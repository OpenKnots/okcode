import type {
  DesktopPreviewElementSelection,
  DesktopPreviewState,
  ProjectId,
  ThreadId,
} from "@okcode/contracts";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CircleAlertIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LoaderCircleIcon,
  MousePointerClickIcon,
  RefreshCwIcon,
  StarIcon,
  XIcon,
} from "lucide-react";

import { validateHttpPreviewUrl } from "@okcode/shared/preview";
import { readDesktopPreviewBridge } from "~/desktopPreview";
import { cn } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { usePreviewStateStore } from "~/previewStateStore";

import { Button } from "./ui/button";
import { Input } from "./ui/input";

const CLOSED_PREVIEW_STATE: DesktopPreviewState = {
  status: "closed",
  url: null,
  title: null,
  visible: false,
  error: null,
  canGoBack: false,
  canGoForward: false,
  pickingElement: false,
};

const HIDDEN_PREVIEW_BOUNDS = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  visible: false,
  viewportWidth: 0,
  viewportHeight: 0,
} as const;

export function resolvePreviewStatusCopy(state: DesktopPreviewState): string {
  if (state.pickingElement) {
    return "Click an element in the preview to reference it in chat. Press Escape to cancel.";
  }

  if (state.error) {
    return state.error.message;
  }

  switch (state.status) {
    case "loading":
      return "Loading local preview...";
    case "ready":
      return state.url ? `Rendering ${state.url}` : "Preview ready.";
    case "closed":
      return "Enter a URL to preview inside OK Code.";
    case "error":
      return "Preview failed.";
  }
}

interface PreviewPanelProps {
  threadId: ThreadId;
  projectId: ProjectId;
  projectName: string;
  onElementSelected: (selection: DesktopPreviewElementSelection) => void;
  onClose: () => void;
}

export function PreviewPanel({
  threadId,
  projectId,
  projectName,
  onElementSelected,
  onClose,
}: PreviewPanelProps) {
  const previewBridge = readDesktopPreviewBridge();
  const storedUrl = usePreviewStateStore((state) => state.urlByProjectId[projectId] ?? "");
  const favoriteUrl = usePreviewStateStore(
    (state) => state.favoriteUrlByProjectId[projectId] ?? "",
  );
  const setProjectUrl = usePreviewStateStore((state) => state.setProjectUrl);
  const toggleProjectFavorite = usePreviewStateStore((state) => state.toggleProjectFavorite);
  const setThreadOpen = usePreviewStateStore((state) => state.setThreadOpen);
  const [inputUrl, setInputUrl] = useState(storedUrl);
  const [inputError, setInputError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<DesktopPreviewState>(CLOSED_PREVIEW_STATE);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const projectNameRef = useRef(projectName);

  useEffect(() => {
    setInputUrl(storedUrl);
  }, [storedUrl, projectId]);

  useEffect(() => {
    projectNameRef.current = projectName;
  }, [projectName]);

  useEffect(() => {
    if (!previewBridge) {
      setPreviewState(CLOSED_PREVIEW_STATE);
      return;
    }

    const unsubscribe = previewBridge.onState((state) => {
      setPreviewState(state);
    });

    void previewBridge.getState().then((state) => {
      setPreviewState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [previewBridge]);

  useEffect(() => {
    if (!previewBridge) {
      return;
    }

    if (storedUrl.trim().length === 0) {
      void previewBridge.setBounds(HIDDEN_PREVIEW_BOUNDS).finally(() => {
        void previewBridge.close();
      });
      setPreviewState(CLOSED_PREVIEW_STATE);
      return;
    }

    void previewBridge
      .setBounds(HIDDEN_PREVIEW_BOUNDS)
      .catch(() => undefined)
      .finally(() => {
        void previewBridge.open({ url: storedUrl, title: `${projectNameRef.current} preview` });
      });
  }, [previewBridge, storedUrl]);

  useEffect(() => {
    return () => {
      void previewBridge?.close();
    };
  }, [previewBridge]);

  useLayoutEffect(() => {
    if (!previewBridge) {
      return;
    }

    let frameId = 0;
    let destroyed = false;
    let lastBoundsKey = "";
    let resizeObserver: ResizeObserver | null = null;

    const computeBounds = () => {
      const element = surfaceRef.current;
      if (!element) {
        return HIDDEN_PREVIEW_BOUNDS;
      }

      const rect = element.getBoundingClientRect();
      const visible =
        storedUrl.trim().length > 0 &&
        document.visibilityState === "visible" &&
        rect.width > 0 &&
        rect.height > 0;
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    };

    const syncBounds = () => {
      if (destroyed) {
        return;
      }

      const nextBounds = computeBounds();
      const nextKey = `${Math.round(nextBounds.x)}:${Math.round(nextBounds.y)}:${Math.round(nextBounds.width)}:${Math.round(nextBounds.height)}:${nextBounds.visible ? 1 : 0}`;
      if (nextKey !== lastBoundsKey) {
        lastBoundsKey = nextKey;
        void previewBridge.setBounds(nextBounds);
      }

      frameId = window.requestAnimationFrame(syncBounds);
    };

    const scheduleImmediateSync = () => {
      if (destroyed || frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(syncBounds);
    };

    const element = surfaceRef.current;
    if (typeof ResizeObserver !== "undefined" && element) {
      resizeObserver = new ResizeObserver(() => {
        lastBoundsKey = "";
      });
      resizeObserver.observe(element);
    }

    const visualViewport = window.visualViewport;
    const invalidateBounds = () => {
      lastBoundsKey = "";
    };

    window.addEventListener("resize", invalidateBounds);
    window.addEventListener("scroll", invalidateBounds, true);
    document.addEventListener("visibilitychange", invalidateBounds);
    visualViewport?.addEventListener("resize", invalidateBounds);
    visualViewport?.addEventListener("scroll", invalidateBounds);

    scheduleImmediateSync();

    return () => {
      destroyed = true;
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", invalidateBounds);
      window.removeEventListener("scroll", invalidateBounds, true);
      document.removeEventListener("visibilitychange", invalidateBounds);
      visualViewport?.removeEventListener("resize", invalidateBounds);
      visualViewport?.removeEventListener("scroll", invalidateBounds);
      void previewBridge.setBounds(HIDDEN_PREVIEW_BOUNDS);
    };
  }, [previewBridge, storedUrl, threadId, projectId]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validatedUrl = validateHttpPreviewUrl(inputUrl);
    if (!validatedUrl.ok) {
      setInputError(validatedUrl.error.message);
      return;
    }

    setInputError(null);
    setProjectUrl(projectId, validatedUrl.url);
  };

  const onClosePreview = () => {
    setThreadOpen(threadId, false);
    void previewBridge?.close();
    onClose();
  };

  const onOpenExternal = () => {
    const targetUrl = previewState.url ?? storedUrl;
    if (!targetUrl) {
      return;
    }

    const api = readNativeApi();
    void api?.shell.openExternal(targetUrl);
  };

  const onToggleElementPicker = () => {
    if (!previewBridge) {
      return;
    }

    if (previewState.pickingElement) {
      void previewBridge.cancelPickElement();
      return;
    }

    void previewBridge
      .pickElement()
      .then((result) => {
        if (result.selection) {
          onElementSelected(result.selection);
        }
      })
      .catch(() => undefined);
  };

  const showEmbeddedSurface = previewState.status === "loading" || previewState.status === "ready";
  const currentPageUrl = previewState.url;
  const isFavorite = currentPageUrl !== null && favoriteUrl === currentPageUrl;

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Back"
            onClick={() => {
              void previewBridge?.goBack();
            }}
            disabled={!previewBridge || !previewState.canGoBack}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Forward"
            onClick={() => {
              void previewBridge?.goForward();
            }}
            disabled={!previewBridge || !previewState.canGoForward}
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
          <GlobeIcon className="size-3.5 shrink-0 text-muted-foreground/65" />
          <div className="min-w-0">
            <p
              className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/75"
              title={projectName}
            >
              Preview
            </p>
            <p className="truncate text-[11px] text-muted-foreground/65">{projectName}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(
              "text-muted-foreground/55 hover:bg-transparent hover:text-foreground",
              previewState.pickingElement ? "text-foreground" : undefined,
            )}
            aria-label={
              previewState.pickingElement ? "Cancel element picker" : "Select an element in preview"
            }
            aria-pressed={previewState.pickingElement}
            onClick={onToggleElementPicker}
            disabled={!previewBridge || previewState.status !== "ready"}
          >
            <MousePointerClickIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(
              "text-muted-foreground/55 hover:bg-transparent hover:text-foreground",
              isFavorite ? "text-amber-500 hover:text-amber-500" : undefined,
            )}
            aria-label={isFavorite ? "Remove favorite" : "Favorite current page"}
            aria-pressed={isFavorite}
            onClick={() => {
              if (!currentPageUrl) {
                return;
              }
              toggleProjectFavorite(projectId, currentPageUrl);
            }}
            disabled={!previewBridge || currentPageUrl === null}
          >
            <StarIcon className={cn("size-3.5", isFavorite ? "fill-current" : "")} />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Reload preview"
            onClick={() => {
              setInputError(null);
              void previewBridge?.reload();
            }}
            disabled={!showEmbeddedSurface}
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Open preview externally"
            onClick={onOpenExternal}
            disabled={!previewState.url && storedUrl.trim().length === 0}
          >
            <ExternalLinkIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Close preview"
            onClick={onClosePreview}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <form className="border-b border-border px-3 py-3" onSubmit={onSubmit}>
        <div className="flex items-center gap-2">
          <Input
            value={inputUrl}
            onChange={(event) => {
              setInputUrl(event.target.value);
              if (inputError) {
                setInputError(null);
              }
            }}
            placeholder="http://localhost:3000"
            aria-label="Preview URL"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button type="submit" size="sm">
            Open
          </Button>
        </div>
        <div className="mt-2 flex items-start gap-2 text-xs">
          {previewState.status === "loading" ? (
            <LoaderCircleIcon className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground/70" />
          ) : previewState.error || inputError ? (
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          ) : null}
          <p
            className={
              previewState.error || inputError ? "text-amber-700" : "text-muted-foreground/70"
            }
          >
            {inputError ?? resolvePreviewStatusCopy(previewState)}
          </p>
        </div>
      </form>

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div
          ref={surfaceRef}
          className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70 bg-card/20"
        >
          {!showEmbeddedSurface ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground/70">
              {inputError ?? resolvePreviewStatusCopy(previewState)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
