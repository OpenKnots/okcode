import type { DesktopPreviewState, ProjectId, ThreadId } from "@okcode/contracts";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CircleAlertIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";

import { readDesktopPreviewBridge, validateLocalPreviewUrl } from "~/desktopPreview";
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
};

export function resolvePreviewStatusCopy(state: DesktopPreviewState): string {
  if (state.error) {
    return state.error.message;
  }

  switch (state.status) {
    case "loading":
      return "Loading local preview...";
    case "ready":
      return state.url ? `Rendering ${state.url}` : "Preview ready.";
    case "closed":
      return "Enter a localhost URL to preview your app inside OK Code.";
    case "error":
      return "Preview failed.";
  }
}

interface PreviewPanelProps {
  threadId: ThreadId;
  projectId: ProjectId;
  projectName: string;
  onClose: () => void;
}

export function PreviewPanel({ threadId, projectId, projectName, onClose }: PreviewPanelProps) {
  const previewBridge = readDesktopPreviewBridge();
  const storedUrl = usePreviewStateStore((state) => state.urlByProjectId[projectId] ?? "");
  const setProjectUrl = usePreviewStateStore((state) => state.setProjectUrl);
  const setThreadOpen = usePreviewStateStore((state) => state.setThreadOpen);
  const [inputUrl, setInputUrl] = useState(storedUrl);
  const [inputError, setInputError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<DesktopPreviewState>(CLOSED_PREVIEW_STATE);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputUrl(storedUrl);
  }, [storedUrl, projectId]);

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
      void previewBridge.close();
      setPreviewState(CLOSED_PREVIEW_STATE);
      return;
    }

    void previewBridge.close().finally(() => {
      void previewBridge.open({ url: storedUrl, title: `${projectName} preview` });
    });
  }, [previewBridge, projectName, storedUrl, threadId]);

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

    const syncBounds = () => {
      frameId = 0;
      if (destroyed) {
        return;
      }

      const element = surfaceRef.current;
      if (!element) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const nextBounds = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
      };
      const nextKey = `${Math.round(nextBounds.x)}:${Math.round(nextBounds.y)}:${Math.round(nextBounds.width)}:${Math.round(nextBounds.height)}:${nextBounds.visible ? 1 : 0}`;
      if (nextKey !== lastBoundsKey) {
        lastBoundsKey = nextKey;
        void previewBridge.setBounds(nextBounds);
      }
    };

    const scheduleSync = () => {
      if (destroyed || frameId !== 0) {
        return;
      }
      frameId = window.requestAnimationFrame(syncBounds);
    };

    const element = surfaceRef.current;
    if (typeof ResizeObserver !== "undefined" && element) {
      resizeObserver = new ResizeObserver(() => {
        scheduleSync();
      });
      resizeObserver.observe(element);
    }

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("scroll", scheduleSync, true);
    visualViewport?.addEventListener("resize", scheduleSync);
    visualViewport?.addEventListener("scroll", scheduleSync);

    scheduleSync();
    const settleTimeoutId = window.setTimeout(scheduleSync, 50);

    return () => {
      destroyed = true;
      window.clearTimeout(settleTimeoutId);
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("scroll", scheduleSync, true);
      visualViewport?.removeEventListener("resize", scheduleSync);
      visualViewport?.removeEventListener("scroll", scheduleSync);
      void previewBridge.setBounds({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        visible: false,
      });
    };
  }, [previewBridge, storedUrl, threadId, projectId]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validatedUrl = validateLocalPreviewUrl(inputUrl);
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

  const showEmbeddedSurface = previewState.status === "loading" || previewState.status === "ready";

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <GlobeIcon className="size-4 shrink-0 text-muted-foreground/70" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">Preview</p>
            <p className="truncate text-xs text-muted-foreground/70">{projectName}</p>
          </div>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
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
          aria-label="Close preview"
          onClick={onClosePreview}
        >
          <XIcon className="size-3.5" />
        </Button>
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
