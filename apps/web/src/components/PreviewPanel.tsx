import type { PreviewTabsState, PreviewTabState, ProjectId } from "@okcode/contracts";
import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GlobeIcon,
  LaptopIcon,
  LoaderCircleIcon,
  MaximizeIcon,
  Minimize2Icon,
  MonitorIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  RulerIcon,
  SmartphoneIcon,
  StarIcon,
  TabletIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { validateHttpPreviewUrl } from "@okcode/shared/preview";
import { readDesktopPreviewBridge } from "~/desktopPreview";
import {
  type BrowserPresetId,
  BROWSER_PRESETS,
  DEFAULT_CUSTOM_VIEWPORT,
  PRESET_CYCLE,
  clampViewportDimension,
  getBrowserPreset,
} from "~/lib/browserPresets";
import { cn } from "~/lib/utils";
import { isMacPlatform } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { usePreviewStateStore } from "~/previewStateStore";

import { PreviewLayoutSwitcher } from "./PreviewLayoutSwitcher";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

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
  '[data-slot="toast-positioner"]:not(:empty)',
  '[data-slot="toast-popup"]:not(:empty)',
].join(",");

export function hasBlockingPreviewOverlay(root: ParentNode = document): boolean {
  return root.querySelector(POPUP_POSITIONER_SELECTOR) !== null;
}

const PRESET_ICONS: Record<BrowserPresetId, typeof SmartphoneIcon> = {
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
  laptop: LaptopIcon,
  desktop: MonitorIcon,
  ultrawide: MonitorIcon,
  custom: RulerIcon,
};

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
  projectId: ProjectId;
  threadId: string;
  onClose: () => void;
}

/**
 * Resolve effective viewport dimensions for a preset, applying orientation and
 * custom viewport overrides.
 */
function resolveViewportDimensions(
  presetId: BrowserPresetId | null,
  orientation: "portrait" | "landscape",
  customViewport: { width: number; height: number },
): { width: number; height: number } | null {
  if (!presetId) return null;

  let w: number;
  let h: number;

  if (presetId === "custom") {
    w = customViewport.width;
    h = customViewport.height;
  } else {
    const preset = getBrowserPreset(presetId);
    if (!preset) return null;
    w = preset.width;
    h = preset.height;
  }

  if (orientation === "landscape") {
    return { width: Math.max(w, h), height: Math.min(w, h) };
  }
  // portrait: ensure height >= width (natural for mobile/tablet), leave landscape-native presets as-is
  return { width: w, height: h };
}

export function PreviewPanel({ projectId, threadId, onClose }: PreviewPanelProps) {
  const previewBridge = readDesktopPreviewBridge();
  const setProjectOpen = usePreviewStateStore((state) => state.setProjectOpen);
  const favoriteUrls = usePreviewStateStore((state) => state.favoriteUrls);
  const toggleFavoriteUrl = usePreviewStateStore((state) => state.toggleFavoriteUrl);
  const presetId = usePreviewStateStore((state) => state.presetByProjectId[projectId] ?? null);
  const setProjectPreset = usePreviewStateStore((state) => state.setProjectPreset);
  const orientation = usePreviewStateStore(
    (state) => state.orientationByProjectId[projectId] ?? "portrait",
  );
  const toggleProjectOrientation = usePreviewStateStore((state) => state.toggleProjectOrientation);
  const customViewport = usePreviewStateStore(
    (state) => state.customViewportByProjectId[projectId] ?? DEFAULT_CUSTOM_VIEWPORT,
  );
  const setCustomViewport = usePreviewStateStore((state) => state.setCustomViewport);
  const layoutMode = usePreviewStateStore(
    (state) => state.layoutModeByProjectId[projectId] ?? "top",
  );
  const toggleFullscreen = usePreviewStateStore((state) => state.toggleFullscreen);

  const effectiveDims = resolveViewportDimensions(presetId, orientation, customViewport);
  const PresetIcon = presetId ? PRESET_ICONS[presetId] : null;

  const [tabsState, setTabsState] = useState<PreviewTabsState>(EMPTY_TABS_STATE);
  const [inputUrl, setInputUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // Live surface dimensions for the badge
  const [surfaceDims, setSurfaceDims] = useState<{ w: number; h: number } | null>(null);
  const [dimsBadgeVisible, setDimsBadgeVisible] = useState(false);
  const dimsFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom viewport local input state
  const [customWidthInput, setCustomWidthInput] = useState(String(customViewport.width));
  const [customHeightInput, setCustomHeightInput] = useState(String(customViewport.height));

  // Sync custom input fields when store value changes externally
  useEffect(() => {
    setCustomWidthInput(String(customViewport.width));
    setCustomHeightInput(String(customViewport.height));
  }, [customViewport.width, customViewport.height]);

  const activeTab = getActiveTab(tabsState);
  const showEmbeddedSurface =
    activeTab !== null && (activeTab.status === "loading" || activeTab.status === "ready");

  // Sync URL input when active tab changes
  useEffect(() => {
    if (activeTab?.url) {
      setInputUrl(activeTab.url);
    }
  }, [activeTab?.tabId, activeTab?.url]);

  // Subscribe to state changes & activate thread in a single effect to avoid
  // race conditions where the subscription effect resets state to EMPTY while
  // the activation promise is still in-flight.
  useEffect(() => {
    if (!previewBridge) {
      setTabsState(EMPTY_TABS_STATE);
      return;
    }

    let cancelled = false;

    const unsubscribe = previewBridge.onState((state) => {
      if (!cancelled) setTabsState(state);
    });

    // Activate the thread and seed the initial state in one go.
    void previewBridge.activateThread({ threadId }).then((state) => {
      if (!cancelled) setTabsState(state);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [previewBridge, threadId]);

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
      const hasOpenPopup = hasBlockingPreviewOverlay();
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
  }, [previewBridge, tabsState.tabs.length, projectId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void previewBridge?.setBounds(HIDDEN_PREVIEW_BOUNDS);
    };
  }, [previewBridge]);

  // Live dimensions badge via ResizeObserver
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSurfaceDims({ w: Math.round(width), h: Math.round(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Show dimensions badge transiently when preset or orientation changes
  useEffect(() => {
    if (!presetId) {
      setDimsBadgeVisible(false);
      return;
    }
    setDimsBadgeVisible(true);
    if (dimsFadeTimer.current) clearTimeout(dimsFadeTimer.current);
    dimsFadeTimer.current = setTimeout(() => setDimsBadgeVisible(false), 2500);
    return () => {
      if (dimsFadeTimer.current) clearTimeout(dimsFadeTimer.current);
    };
  }, [presetId, orientation, customViewport.width, customViewport.height]);

  // Keyboard shortcuts for cycling presets
  const handlePresetShortcut = useCallback(
    (event: KeyboardEvent) => {
      const isMac = isMacPlatform(navigator.platform);
      const mod = isMac ? event.metaKey : event.ctrlKey;
      if (!mod || !event.shiftKey) return;

      if (event.key === "M" || event.key === "m") {
        // Ctrl/Cmd+Shift+M: toggle mobile
        event.preventDefault();
        setProjectPreset(projectId, presetId === "mobile" ? null : "mobile");
        return;
      }

      if (event.key === "[" || event.key === "]") {
        event.preventDefault();
        const currentIndex = PRESET_CYCLE.indexOf(presetId);
        const idx = currentIndex === -1 ? 0 : currentIndex;
        const delta = event.key === "]" ? 1 : -1;
        const nextIndex = (idx + delta + PRESET_CYCLE.length) % PRESET_CYCLE.length;
        const next = PRESET_CYCLE[nextIndex];
        setProjectPreset(projectId, next ?? null);
      }
    },
    [presetId, projectId, setProjectPreset],
  );

  useEffect(() => {
    window.addEventListener("keydown", handlePresetShortcut);
    return () => window.removeEventListener("keydown", handlePresetShortcut);
  }, [handlePresetShortcut]);

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
      // Create a new tab for this thread
      void previewBridge?.createTab({ url: validatedUrl.url, threadId });
    }
  };

  const onNewTab = () => {
    const url = inputUrl.trim();
    if (url.length > 0) {
      const validatedUrl = validateHttpPreviewUrl(url);
      if (validatedUrl.ok) {
        void previewBridge?.createTab({ url: validatedUrl.url, threadId });
        return;
      }
    }
    // Create tab with a default page
    void previewBridge?.createTab({ url: "https://www.google.com", threadId });
  };

  const onClosePreview = () => {
    setProjectOpen(projectId, false);
    void previewBridge?.closeAll();
    onClose();
  };

  const onOpenExternal = () => {
    const targetUrl = activeTab?.url;
    if (!targetUrl) return;
    const api = readNativeApi();
    void api?.shell.openExternal(targetUrl);
  };

  const commitCustomViewport = () => {
    const w = clampViewportDimension(Number(customWidthInput) || DEFAULT_CUSTOM_VIEWPORT.width);
    const h = clampViewportDimension(Number(customHeightInput) || DEFAULT_CUSTOM_VIEWPORT.height);
    setCustomViewport(projectId, { width: w, height: h });
    setCustomWidthInput(String(w));
    setCustomHeightInput(String(h));
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
          {/* ---- Viewport Preset Strip ---- */}
          <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5">
            {/* Responsive */}
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  "inline-flex h-5 w-5 cursor-default items-center justify-center rounded transition-colors",
                  presetId === null
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground/55 hover:text-foreground",
                )}
                aria-label="Responsive"
                onClick={() => setProjectPreset(projectId, null)}
              >
                <MaximizeIcon className="size-3" />
              </TooltipTrigger>
              <TooltipPopup side="bottom" sideOffset={6}>
                Responsive
              </TooltipPopup>
            </Tooltip>

            <div className="mx-0.5 h-3 w-px bg-border/50" />

            {/* Device presets */}
            {BROWSER_PRESETS.map((preset) => {
              const Icon = PRESET_ICONS[preset.id];
              const isActive = presetId === preset.id;
              return (
                <Tooltip key={preset.id}>
                  <TooltipTrigger
                    className={cn(
                      "inline-flex h-5 w-5 cursor-default items-center justify-center rounded transition-colors",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground/55 hover:text-foreground",
                    )}
                    aria-label={preset.label}
                    aria-pressed={isActive}
                    onClick={() => setProjectPreset(projectId, isActive ? null : preset.id)}
                  >
                    <Icon className="size-3" />
                  </TooltipTrigger>
                  <TooltipPopup side="bottom" sideOffset={6}>
                    {preset.label}{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {preset.width}&times;{preset.height}
                    </span>
                  </TooltipPopup>
                </Tooltip>
              );
            })}

            <div className="mx-0.5 h-3 w-px bg-border/50" />

            {/* Custom viewport */}
            <Tooltip>
              <TooltipTrigger
                className={cn(
                  "inline-flex h-5 w-5 cursor-default items-center justify-center rounded transition-colors",
                  presetId === "custom"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground/55 hover:text-foreground",
                )}
                aria-label="Custom viewport"
                aria-pressed={presetId === "custom"}
                onClick={() => setProjectPreset(projectId, presetId === "custom" ? null : "custom")}
              >
                <RulerIcon className="size-3" />
              </TooltipTrigger>
              <TooltipPopup side="bottom" sideOffset={6}>
                Custom size
              </TooltipPopup>
            </Tooltip>

            {/* Orientation toggle */}
            {presetId && (
              <>
                <div className="mx-0.5 h-3 w-px bg-border/50" />
                <Tooltip>
                  <TooltipTrigger
                    className={cn(
                      "inline-flex h-5 w-5 cursor-default items-center justify-center rounded text-muted-foreground/55 transition-colors hover:text-foreground",
                      orientation === "landscape" && "text-foreground",
                    )}
                    aria-label={
                      orientation === "portrait" ? "Switch to landscape" : "Switch to portrait"
                    }
                    onClick={() => toggleProjectOrientation(projectId)}
                  >
                    <RotateCcwIcon className="size-3" />
                  </TooltipTrigger>
                  <TooltipPopup side="bottom" sideOffset={6}>
                    {orientation === "portrait" ? "Landscape" : "Portrait"}
                  </TooltipPopup>
                </Tooltip>
              </>
            )}
          </div>

          {/* Custom viewport dimension inputs */}
          {presetId === "custom" && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Input
                type="number"
                value={customWidthInput}
                onChange={(e) => setCustomWidthInput(e.target.value)}
                onBlur={commitCustomViewport}
                onKeyDown={(e) => e.key === "Enter" && commitCustomViewport()}
                aria-label="Viewport width"
                className="h-5 w-14 text-center text-[10px] tabular-nums"
                min={320}
                max={3840}
              />
              <span>&times;</span>
              <Input
                type="number"
                value={customHeightInput}
                onChange={(e) => setCustomHeightInput(e.target.value)}
                onBlur={commitCustomViewport}
                onKeyDown={(e) => e.key === "Enter" && commitCustomViewport()}
                aria-label="Viewport height"
                className="h-5 w-14 text-center text-[10px] tabular-nums"
                min={320}
                max={2160}
              />
            </div>
          )}

          {/* ---- Layout Mode Switcher ---- */}
          <PreviewLayoutSwitcher projectId={projectId} />

          {/* Exit fullscreen shortcut button */}
          {layoutMode === "fullscreen" && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
                    aria-label="Exit full screen"
                    onClick={() => toggleFullscreen(projectId)}
                  >
                    <Minimize2Icon className="size-3.5" />
                  </Button>
                }
              />
              <TooltipPopup side="bottom" sideOffset={6}>
                Exit full screen
              </TooltipPopup>
            </Tooltip>
          )}

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
              "group flex items-center gap-1.5 rounded-md py-1 text-[11px] transition-colors",
              tab.isPinned ? "max-w-[40px] px-2" : "max-w-[180px] px-2.5",
              tab.tabId === tabsState.activeTabId
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
            )}
            onClick={() => void previewBridge?.activateTab({ tabId: tab.tabId })}
            title={tab.url ?? tabDisplayTitle(tab)}
          >
            {tab.isPinned ? (
              <PinIcon className="size-3 shrink-0 rotate-[-45deg] text-blue-500" />
            ) : tab.status === "loading" ? (
              <LoaderCircleIcon className="size-3 shrink-0 animate-spin" />
            ) : (
              <GlobeIcon className="size-3 shrink-0 opacity-50" />
            )}
            {!tab.isPinned && <span className="truncate">{tabDisplayTitle(tab)}</span>}
            {tab.isPinned ? (
              <button
                type="button"
                className="ml-auto shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  void previewBridge?.togglePinTab({ tabId: tab.tabId });
                }}
                aria-label={`Unpin ${tabDisplayTitle(tab)}`}
              >
                <PinOffIcon className="size-2.5" />
              </button>
            ) : (
              <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    void previewBridge?.togglePinTab({ tabId: tab.tabId });
                  }}
                  aria-label={`Pin ${tabDisplayTitle(tab)}`}
                >
                  <PinIcon className="size-2.5" />
                </button>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    void previewBridge?.closeTab({ tabId: tab.tabId });
                  }}
                  aria-label={`Close ${tabDisplayTitle(tab)}`}
                >
                  <XIcon className="size-2.5" />
                </button>
              </span>
            )}
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

      {/* Status bar – always mounted, animated in/out via CSS to avoid layout shift */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          inputError || (activeTab && activeTab.status !== "ready")
            ? "grid-rows-[1fr]"
            : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
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
        </div>
      </div>

      {/* Content area */}
      <div
        className={cn(
          "flex min-h-0 flex-1 p-3",
          effectiveDims ? "items-center justify-center" : "flex-col",
        )}
      >
        <div
          ref={surfaceRef}
          data-preview-surface="true"
          className={cn(
            "relative overflow-hidden rounded-lg border border-border/70 bg-card/20",
            !effectiveDims && "min-h-0 flex-1",
          )}
          style={
            effectiveDims
              ? {
                  width: effectiveDims.width,
                  height: effectiveDims.height,
                  maxWidth: "100%",
                  maxHeight: "100%",
                  transition: "width 250ms ease-out, height 250ms ease-out",
                }
              : undefined
          }
        >
          {/* Empty-state placeholder – fade in/out instead of mount/unmount to avoid flicker */}
          <div
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground/70 transition-opacity duration-200",
              showEmbeddedSurface ? "opacity-0" : "opacity-100",
            )}
          >
            {tabsState.tabs.length === 0
              ? "Enter a URL or click + to open a new tab."
              : (activeTab?.error?.message ?? "Preview closed.")}
          </div>

          {/* Live dimensions badge */}
          {surfaceDims && presetId && (
            <div
              className={cn(
                "pointer-events-none absolute bottom-2 right-2 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] tabular-nums text-white/90 transition-opacity duration-300",
                dimsBadgeVisible ? "opacity-100" : "opacity-0",
              )}
            >
              {surfaceDims.w} &times; {surfaceDims.h}
            </div>
          )}
        </div>
      </div>

      {/* Preset info bar */}
      {presetId && effectiveDims && (
        <div className="flex items-center justify-center gap-2 border-t border-border/40 px-3 py-1 text-[10px] text-muted-foreground/60">
          {PresetIcon && <PresetIcon className="size-3 opacity-50" />}
          <span className="tabular-nums">
            {presetId === "custom" ? "Custom" : (getBrowserPreset(presetId)?.label ?? presetId)}
            {" \u2014 "}
            {effectiveDims.width}&times;{effectiveDims.height}
            {orientation === "landscape" ? " (landscape)" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
