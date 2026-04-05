import type { PreviewTabsState, PreviewTabState, ThreadId } from "@okcode/contracts";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LaptopIcon,
  LoaderCircleIcon,
  MaximizeIcon,
  MonitorIcon,
  PlusIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  StarIcon,
  TabletIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { validateHttpPreviewUrl } from "@okcode/shared/preview";
import { readDesktopPreviewBridge } from "~/desktopPreview";
import { type BrowserPresetId, BROWSER_PRESETS, getBrowserPreset } from "~/lib/browserPresets";
import { cn } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { usePreviewStateStore } from "~/previewStateStore";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";

const EMPTY_TABS_STATE: PreviewTabsState = {
  tabs: [],
  activeTabId: null,
  visible: false,
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

/**
 * Selector that matches any popup positioner element portaled to the body.
 * When any of these are present, the native BrowserView overlay should be
 * hidden so it doesn't render on top of dropdown menus / popovers.
 */
const POPUP_POSITIONER_SELECTOR = [
  '[data-slot="menu-positioner"]',
  '[data-slot="popover-positioner"]',
  '[data-slot="select-positioner"]',
  '[data-slot="combobox-positioner"]',
  '[data-slot="autocomplete-positioner"]',
  '[data-slot="toast-viewport"]:not(:empty)',
  '[data-slot="toast-viewport-anchored"]:not(:empty)',
].join(",");

const PRESET_ICONS: Record<BrowserPresetId, typeof SmartphoneIcon> = {
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
  laptop: LaptopIcon,
  desktop: MonitorIcon,
  ultrawide: MonitorIcon,
};

/** Sentinel value used by the radio group to represent "no preset" (responsive). */
const RESPONSIVE_VALUE = "__responsive__";

function getActiveTab(state: PreviewTabsState): PreviewTabState | null {
  if (!state.activeTabId) return null;
  return state.tabs.find((t) => t.tabId === state.activeTabId) ?? null;
}

function tabDisplayTitle(tab: PreviewTabState): string {
  if (tab.title) return tab.title;
  if (tab.url) {
    try {
      const u = new URL(tab.url);
      return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
      return tab.url;
    }
  }
  return "New Tab";
}

interface PreviewPanelProps {
  threadId: ThreadId;
  onClose: () => void;
}

export function PreviewPanel({ threadId, onClose }: PreviewPanelProps) {
  const previewBridge = readDesktopPreviewBridge();
  const setGlobalOpen = usePreviewStateStore((state) => state.setGlobalOpen);
  const favoriteUrls = usePreviewStateStore((state) => state.favoriteUrls);
  const toggleFavoriteUrl = usePreviewStateStore((state) => state.toggleFavoriteUrl);
  const presetId = usePreviewStateStore((state) => state.presetByThreadId[threadId] ?? null);
  const setThreadPreset = usePreviewStateStore((state) => state.setThreadPreset);
  const activePreset = presetId ? getBrowserPreset(presetId) : null;
  const PresetIcon = presetId ? PRESET_ICONS[presetId] : null;

  const [tabsState, setTabsState] = useState<PreviewTabsState>(EMPTY_TABS_STATE);
  const [inputUrl, setInputUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const activeTab = getActiveTab(tabsState);
  const showEmbeddedSurface =
    activeTab !== null && (activeTab.status === "loading" || activeTab.status === "ready");

  // Sync URL input when active tab changes
  useEffect(() => {
    if (activeTab?.url) {
      setInputUrl(activeTab.url);
    }
  }, [activeTab?.tabId, activeTab?.url]);

  // Subscribe to state changes
  useEffect(() => {
    if (!previewBridge) {
      setTabsState(EMPTY_TABS_STATE);
      return;
    }

    const unsubscribe = previewBridge.onState((state) => {
      setTabsState(state);
    });

    void previewBridge.getState().then((state) => {
      setTabsState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [previewBridge]);

  // Bounds sync
  useLayoutEffect(() => {
    if (!previewBridge) return;

    let frameId = 0;
    let destroyed = false;
    let lastBoundsKey = "";
    let resizeObserver: ResizeObserver | null = null;

    const computeBounds = () => {
      const element = surfaceRef.current;
      if (!element) return HIDDEN_PREVIEW_BOUNDS;

      const rect = element.getBoundingClientRect();
      // Hide the native BrowserView when any popup/dropdown is open so it
      // doesn't render on top of menus (native overlays ignore CSS z-index).
      const hasOpenPopup = document.querySelector(POPUP_POSITIONER_SELECTOR) !== null;
      const visible =
        tabsState.tabs.length > 0 &&
        document.visibilityState === "visible" &&
        rect.width > 0 &&
        rect.height > 0 &&
        !hasOpenPopup;
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
      if (destroyed) return;

      const nextBounds = computeBounds();
      const nextKey = `${Math.round(nextBounds.x)}:${Math.round(nextBounds.y)}:${Math.round(nextBounds.width)}:${Math.round(nextBounds.height)}:${nextBounds.visible ? 1 : 0}`;
      if (nextKey !== lastBoundsKey) {
        lastBoundsKey = nextKey;
        void previewBridge.setBounds(nextBounds);
      }

      frameId = window.requestAnimationFrame(syncBounds);
    };

    const scheduleImmediateSync = () => {
      if (destroyed || frameId !== 0) return;
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

    // Watch for popup positioners being added/removed from the DOM so we
    // can immediately hide/show the native BrowserView overlay.
    const popupObserver = new MutationObserver(invalidateBounds);
    popupObserver.observe(document.body, { childList: true, subtree: false });

    window.addEventListener("resize", invalidateBounds);
    window.addEventListener("scroll", invalidateBounds, true);
    document.addEventListener("visibilitychange", invalidateBounds);
    visualViewport?.addEventListener("resize", invalidateBounds);
    visualViewport?.addEventListener("scroll", invalidateBounds);

    scheduleImmediateSync();

    return () => {
      destroyed = true;
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      popupObserver.disconnect();
      window.removeEventListener("resize", invalidateBounds);
      window.removeEventListener("scroll", invalidateBounds, true);
      document.removeEventListener("visibilitychange", invalidateBounds);
      visualViewport?.removeEventListener("resize", invalidateBounds);
      visualViewport?.removeEventListener("scroll", invalidateBounds);
      void previewBridge.setBounds(HIDDEN_PREVIEW_BOUNDS);
    };
  }, [previewBridge, tabsState.tabs.length, threadId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void previewBridge?.setBounds(HIDDEN_PREVIEW_BOUNDS);
    };
  }, [previewBridge]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validatedUrl = validateHttpPreviewUrl(inputUrl);
    if (!validatedUrl.ok) {
      setInputError(validatedUrl.error.message);
      return;
    }

    setInputError(null);

    if (activeTab) {
      // Navigate existing active tab
      void previewBridge?.navigate({ url: validatedUrl.url });
    } else {
      // Create a new tab
      void previewBridge?.createTab({ url: validatedUrl.url });
    }
  };

  const onNewTab = () => {
    const url = inputUrl.trim();
    if (url.length > 0) {
      const validatedUrl = validateHttpPreviewUrl(url);
      if (validatedUrl.ok) {
        void previewBridge?.createTab({ url: validatedUrl.url });
        return;
      }
    }
    // Create tab with a default page
    void previewBridge?.createTab({ url: "https://www.google.com" });
  };

  const onClosePreview = () => {
    setGlobalOpen(false);
    void previewBridge?.closeAll();
    onClose();
  };

  const onOpenExternal = () => {
    const targetUrl = activeTab?.url;
    if (!targetUrl) return;
    const api = readNativeApi();
    void api?.shell.openExternal(targetUrl);
  };

  const currentPageUrl = activeTab?.url ?? null;
  const isFavorite = currentPageUrl !== null && favoriteUrls.includes(currentPageUrl);

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Back"
            onClick={() => void previewBridge?.goBack()}
            disabled={!previewBridge || !activeTab?.canGoBack}
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Forward"
            onClick={() => void previewBridge?.goForward()}
            disabled={!previewBridge || !activeTab?.canGoForward}
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Reload"
            onClick={() => {
              setInputError(null);
              void previewBridge?.reload();
            }}
            disabled={!showEmbeddedSurface}
          >
            <RefreshCwIcon className="size-3.5" />
          </Button>
        </div>
        <form
          className="order-last min-w-0 basis-full lg:order-none lg:flex-1 lg:basis-auto"
          onSubmit={onSubmit}
        >
          <Input
            value={inputUrl}
            onChange={(event) => {
              setInputUrl(event.target.value);
              if (inputError) setInputError(null);
            }}
            placeholder="https://example.com"
            aria-label="URL"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="h-7 text-xs"
          />
        </form>
        <div className="flex items-center gap-1">
          <Menu>
            <MenuTrigger
              className={cn(
                "inline-flex h-6 cursor-default items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors",
                presetId
                  ? "bg-accent/60 text-foreground"
                  : "text-muted-foreground/55 hover:bg-accent/40 hover:text-foreground",
              )}
              aria-label="Viewport preset"
            >
              {PresetIcon ? <PresetIcon className="size-3" /> : <MaximizeIcon className="size-3" />}
              <span className="max-sm:hidden">
                {activePreset ? activePreset.label : "Responsive"}
              </span>
            </MenuTrigger>
            <MenuPopup side="bottom" align="end" sideOffset={6}>
              <MenuGroup>
                <MenuGroupLabel>Viewport</MenuGroupLabel>
                <MenuRadioGroup
                  value={presetId ?? RESPONSIVE_VALUE}
                  onValueChange={(value) => {
                    setThreadPreset(
                      threadId,
                      value === RESPONSIVE_VALUE ? null : (value as BrowserPresetId),
                    );
                  }}
                >
                  <MenuRadioItem value={RESPONSIVE_VALUE}>
                    <span className="flex items-center gap-2">
                      <MaximizeIcon className="size-3.5 opacity-60" />
                      Responsive
                    </span>
                  </MenuRadioItem>
                  <MenuSeparator />
                  {BROWSER_PRESETS.map((preset) => {
                    const Icon = PRESET_ICONS[preset.id];
                    return (
                      <MenuRadioItem key={preset.id} value={preset.id}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-3.5 opacity-60" />
                          <span>{preset.label}</span>
                          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
                            {preset.width}&times;{preset.height}
                          </span>
                        </span>
                      </MenuRadioItem>
                    );
                  })}
                </MenuRadioGroup>
              </MenuGroup>
            </MenuPopup>
          </Menu>

          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className={cn(
              "text-muted-foreground/55 hover:bg-transparent hover:text-foreground",
              activeTab?.devToolsOpen ? "text-blue-500 hover:text-blue-500" : undefined,
            )}
            aria-label="Toggle DevTools"
            aria-pressed={activeTab?.devToolsOpen ?? false}
            onClick={() => void previewBridge?.toggleDevTools()}
            disabled={!previewBridge || !activeTab}
          >
            <WrenchIcon className="size-3.5" />
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
              if (currentPageUrl) toggleFavoriteUrl(currentPageUrl);
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
            aria-label="Open externally"
            onClick={onOpenExternal}
            disabled={!activeTab?.url}
          >
            <ExternalLinkIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
            aria-label="Close browser"
            onClick={onClosePreview}
          >
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border/40 bg-muted/30 px-2 py-1">
        {tabsState.tabs.map((tab) => (
          <button
            key={tab.tabId}
            type="button"
            className={cn(
              "group flex max-w-[180px] items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] transition-colors",
              tab.tabId === tabsState.activeTabId
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
            onClick={() => void previewBridge?.activateTab({ tabId: tab.tabId })}
            title={tab.url ?? tabDisplayTitle(tab)}
          >
            {tab.status === "loading" ? (
              <LoaderCircleIcon className="size-3 shrink-0 animate-spin" />
            ) : (
              <GlobeIcon className="size-3 shrink-0 opacity-50" />
            )}
            <span className="truncate">{tabDisplayTitle(tab)}</span>
            <button
              type="button"
              className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                void previewBridge?.closeTab({ tabId: tab.tabId });
              }}
              aria-label={`Close ${tabDisplayTitle(tab)}`}
            >
              <XIcon className="size-2.5" />
            </button>
          </button>
        ))}
        <button
          type="button"
          className="flex items-center justify-center rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-foreground"
          onClick={onNewTab}
          aria-label="New tab"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>

      {/* Status bar */}
      {(inputError || (activeTab && activeTab.status !== "ready")) && (
        <div className="flex items-start gap-2 border-b border-border/40 px-3 py-1.5 text-xs">
          {activeTab?.status === "loading" ? (
            <LoaderCircleIcon className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground/70" />
          ) : null}
          <p
            className={
              activeTab?.error || inputError ? "text-amber-700" : "text-muted-foreground/70"
            }
          >
            {inputError ??
              activeTab?.error?.message ??
              (activeTab?.status === "loading" ? `Loading ${activeTab.url ?? ""}...` : null)}
          </p>
        </div>
      )}

      {/* Content area */}
      <div
        className={cn(
          "flex min-h-0 flex-1 p-3",
          activePreset ? "items-center justify-center" : "flex-col",
        )}
      >
        <div
          ref={surfaceRef}
          className={cn(
            "relative overflow-hidden rounded-lg border border-border/70 bg-card/20",
            !activePreset && "min-h-0 flex-1",
          )}
          style={
            activePreset
              ? {
                  width: activePreset.width,
                  height: activePreset.height,
                  maxWidth: "100%",
                  maxHeight: "100%",
                }
              : undefined
          }
        >
          {!showEmbeddedSurface ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground/70">
              {tabsState.tabs.length === 0
                ? "Enter a URL or click + to open a new tab."
                : (activeTab?.error?.message ?? "Preview closed.")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
