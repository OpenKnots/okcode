import { useCallback } from "react";
import {
  GaugeIcon,
  LaptopIcon,
  MaximizeIcon,
  MonitorIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  SmartphoneIcon,
  TabletIcon,
  XIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import {
  type SimulationViewportPreset,
  SIMULATION_VIEWPORT_PRESETS,
  useSimulationViewerStore,
} from "~/simulationViewerStore";
import { useMediaQuery, useIsMobile } from "~/hooks/useMediaQuery";

import { Button } from "~/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "~/components/ui/menu";
import { Sheet, SheetPopup } from "~/components/ui/sheet";

import { SimulationCanvas } from "./SimulationCanvas";
import { SimulationControls } from "./SimulationControls";
import { SimulationInspector } from "./SimulationInspector";

// ─── Viewport Preset Icons ──────────────────────────────────────────
const PRESET_ICONS: Record<SimulationViewportPreset, typeof SmartphoneIcon> = {
  mobile: SmartphoneIcon,
  tablet: TabletIcon,
  laptop: LaptopIcon,
  desktop: MonitorIcon,
  wide: MonitorIcon,
  ultrawide: MonitorIcon,
};

const RESPONSIVE_VALUE = "__responsive__";

// ─── Breakpoint Thresholds ──────────────────────────────────────────
//
// These govern which *layout shell* is rendered. They are independent
// of the viewport-preset selector which controls the simulation
// coordinate space.
//
// Layout modes:
//   mobile   (<640px)  – stacked, sheet-based inspector, FAB controls
//   tablet   (640–1023) – stacked with bottom inspector strip
//   laptop   (1024–1535) – side inspector, inline controls
//   desktop+ (≥1536)   – wider inspector, more breathing room
//
const TABLET_QUERY = "sm";
const LAPTOP_QUERY = "lg";
const DESKTOP_QUERY = "2xl";
const WIDE_QUERY = "4xl";

// ─── Toolbar ────────────────────────────────────────────────────────
function SimulationToolbar({ onClose }: { onClose: () => void }) {
  const viewportPreset = useSimulationViewerStore((s) => s.viewportPreset);
  const setViewportPreset = useSimulationViewerStore((s) => s.setViewportPreset);
  const inspectorOpen = useSimulationViewerStore((s) => s.inspectorOpen);
  const toggleInspector = useSimulationViewerStore((s) => s.toggleInspector);
  const playbackState = useSimulationViewerStore((s) => s.playbackState);

  const preset = viewportPreset
    ? SIMULATION_VIEWPORT_PRESETS.find((p) => p.id === viewportPreset)
    : null;
  const PresetIcon = viewportPreset ? PRESET_ICONS[viewportPreset] : null;

  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
      {/* Left: Title + status */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GaugeIcon className="size-4 shrink-0 text-primary/80" />
        <span className="truncate text-sm font-medium text-foreground">Simulation</span>
        {playbackState !== "stopped" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              playbackState === "playing"
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-amber-500/15 text-amber-400",
            )}
          >
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                playbackState === "playing" ? "animate-pulse bg-emerald-400" : "bg-amber-400",
              )}
            />
            {playbackState === "playing" ? "Running" : "Paused"}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {/* Viewport preset picker */}
        <Menu>
          <MenuTrigger
            className={cn(
              "inline-flex h-6 cursor-default items-center gap-1 rounded-md px-1.5 text-[11px] transition-colors",
              viewportPreset
                ? "bg-accent/60 text-foreground"
                : "text-muted-foreground/55 hover:bg-accent/40 hover:text-foreground",
            )}
            aria-label="Viewport preset"
          >
            {PresetIcon ? <PresetIcon className="size-3" /> : <MaximizeIcon className="size-3" />}
            <span className="max-sm:hidden">{preset ? preset.label : "Responsive"}</span>
          </MenuTrigger>
          <MenuPopup side="bottom" align="end" sideOffset={6}>
            <MenuGroup>
              <MenuGroupLabel>Simulation Viewport</MenuGroupLabel>
              <MenuRadioGroup
                value={viewportPreset ?? RESPONSIVE_VALUE}
                onValueChange={(value) => {
                  setViewportPreset(
                    value === RESPONSIVE_VALUE ? null : (value as SimulationViewportPreset),
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
                {SIMULATION_VIEWPORT_PRESETS.map((p) => {
                  const Icon = PRESET_ICONS[p.id];
                  return (
                    <MenuRadioItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <Icon className="size-3.5 opacity-60" />
                        <span>{p.label}</span>
                        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">
                          {p.width}&times;{p.height}
                        </span>
                      </span>
                    </MenuRadioItem>
                  );
                })}
              </MenuRadioGroup>
            </MenuGroup>
          </MenuPopup>
        </Menu>

        {/* Toggle inspector */}
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground max-sm:hidden"
          aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
          aria-pressed={inspectorOpen}
          onClick={toggleInspector}
        >
          {inspectorOpen ? (
            <PanelRightCloseIcon className="size-3.5" />
          ) : (
            <PanelRightOpenIcon className="size-3.5" />
          )}
        </Button>

        {/* Close */}
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="text-muted-foreground/55 hover:bg-transparent hover:text-foreground"
          aria-label="Close simulation viewer"
          onClick={onClose}
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Mobile Layout ──────────────────────────────────────────────────
//
// Full-screen stacked layout. Canvas fills available space.
// Controls in a bottom bar; inspector opens as a sheet.
//
function MobileLayout({ onClose }: { onClose: () => void }) {
  const inspectorOpen = useSimulationViewerStore((s) => s.inspectorOpen);
  const toggleInspector = useSimulationViewerStore((s) => s.toggleInspector);
  const controlsDrawerOpen = useSimulationViewerStore((s) => s.controlsDrawerOpen);
  const setControlsDrawerOpen = useSimulationViewerStore((s) => s.setControlsDrawerOpen);

  return (
    <div className="flex h-full flex-col bg-background">
      <SimulationToolbar onClose={onClose} />
      <SimulationCanvas className="min-h-0 flex-1" />

      {/* Bottom controls bar */}
      <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
        <SimulationControls layout="inline" />
      </div>

      {/* Floating inspector toggle for mobile */}
      <button
        type="button"
        className="absolute bottom-16 right-3 z-10 flex size-10 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg transition-transform active:scale-95"
        onClick={toggleInspector}
        aria-label="Toggle inspector"
      >
        <PanelRightOpenIcon className="size-4" />
      </button>

      {/* Inspector as sheet */}
      <Sheet
        open={inspectorOpen}
        onOpenChange={(open) => {
          if (!open) toggleInspector();
        }}
      >
        <SheetPopup side="bottom" showCloseButton={false} className="h-[70vh] max-h-[70vh] p-0">
          <SimulationInspector layout="sheet" onClose={toggleInspector} />
        </SheetPopup>
      </Sheet>

      {/* Controls drawer (if needed on very small screens) */}
      <Sheet open={controlsDrawerOpen} onOpenChange={(open) => setControlsDrawerOpen(open)}>
        <SheetPopup side="bottom" showCloseButton className="max-h-[50vh] p-0">
          <div className="p-4">
            <SimulationControls layout="drawer" />
          </div>
        </SheetPopup>
      </Sheet>
    </div>
  );
}

// ─── Tablet Layout ──────────────────────────────────────────────────
//
// Canvas on top, controls inline, inspector as a bottom strip.
//
function TabletLayout({ onClose }: { onClose: () => void }) {
  const inspectorOpen = useSimulationViewerStore((s) => s.inspectorOpen);
  const toggleInspector = useSimulationViewerStore((s) => s.toggleInspector);

  return (
    <div className="flex h-full flex-col bg-background">
      <SimulationToolbar onClose={onClose} />
      <SimulationCanvas className="min-h-0 flex-1" />
      <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
        <SimulationControls layout="inline" />
      </div>
      {inspectorOpen && <SimulationInspector layout="bottom" onClose={toggleInspector} />}
    </div>
  );
}

// ─── Laptop Layout ──────────────────────────────────────────────────
//
// Canvas + controls on the left, inspector sidebar on the right.
//
function LaptopLayout({ onClose }: { onClose: () => void }) {
  const inspectorOpen = useSimulationViewerStore((s) => s.inspectorOpen);
  const toggleInspector = useSimulationViewerStore((s) => s.toggleInspector);

  return (
    <div className="flex h-full flex-col bg-background">
      <SimulationToolbar onClose={onClose} />
      <div className="flex min-h-0 flex-1">
        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <SimulationCanvas className="min-h-0 flex-1" />
          <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
            <SimulationControls layout="inline" />
          </div>
        </div>
        {/* Inspector sidebar */}
        {inspectorOpen && <SimulationInspector layout="sidebar" onClose={toggleInspector} />}
      </div>
    </div>
  );
}

// ─── Desktop Layout ─────────────────────────────────────────────────
//
// Same as laptop but with more generous inspector width (handled via
// responsive classes in SimulationInspector).
//
function DesktopLayout({ onClose }: { onClose: () => void }) {
  const inspectorOpen = useSimulationViewerStore((s) => s.inspectorOpen);
  const toggleInspector = useSimulationViewerStore((s) => s.toggleInspector);

  return (
    <div className="flex h-full flex-col bg-background">
      <SimulationToolbar onClose={onClose} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <SimulationCanvas className="min-h-0 flex-1" />
          <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
            <SimulationControls layout="inline" />
          </div>
        </div>
        {inspectorOpen && (
          <SimulationInspector
            layout="sidebar"
            className="w-72 xl:w-80 2xl:w-[22rem]"
            onClose={toggleInspector}
          />
        )}
      </div>
    </div>
  );
}

// ─── Wide / Ultrawide Layout ────────────────────────────────────────
//
// Extra-spacious: wider inspector, larger canvas padding, and room
// for multi-column metric displays.
//
function WideLayout({ onClose }: { onClose: () => void }) {
  const inspectorOpen = useSimulationViewerStore((s) => s.inspectorOpen);
  const toggleInspector = useSimulationViewerStore((s) => s.toggleInspector);

  return (
    <div className="flex h-full flex-col bg-background">
      <SimulationToolbar onClose={onClose} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <SimulationCanvas className="min-h-0 flex-1" />
          <div className="border-t border-border/40 bg-card/80 backdrop-blur-sm">
            <SimulationControls layout="inline" />
          </div>
        </div>
        {inspectorOpen && (
          <SimulationInspector
            layout="sidebar"
            className="w-80 2xl:w-96"
            onClose={toggleInspector}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main Exported Component ────────────────────────────────────────
export interface SimulationViewerProps {
  /** Called when the user closes the viewer. */
  onClose: () => void;
  className?: string;
}

/**
 * Responsive simulation viewer that adapts its layout to six
 * viewport tiers:
 *
 * | Tier       | Width      | Layout                                    |
 * |------------|------------|-------------------------------------------|
 * | Mobile     | < 640px    | Stacked, sheet inspector, FAB controls    |
 * | Tablet     | 640–1023   | Stacked with bottom inspector strip       |
 * | Laptop     | 1024–1535  | Side inspector, inline controls           |
 * | Desktop    | 1536–1999  | Wider inspector, more space               |
 * | Wide       | 2000+      | Extra-wide inspector, generous canvas     |
 * | Ultrawide  | 2000+      | Same as Wide (uses full available width)  |
 */
export function SimulationViewer({ onClose, className }: SimulationViewerProps) {
  const isMobile = useIsMobile();
  const isTablet = useMediaQuery(TABLET_QUERY);
  const isLaptop = useMediaQuery(LAPTOP_QUERY);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isWide = useMediaQuery(WIDE_QUERY);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Determine layout tier (largest matching wins)
  let LayoutComponent: React.ComponentType<{ onClose: () => void }>;
  if (isMobile) {
    LayoutComponent = MobileLayout;
  } else if (!isTablet) {
    // Below sm but not isMobile — shouldn't happen, but fallback
    LayoutComponent = MobileLayout;
  } else if (!isLaptop) {
    LayoutComponent = TabletLayout;
  } else if (!isDesktop) {
    LayoutComponent = LaptopLayout;
  } else if (!isWide) {
    LayoutComponent = DesktopLayout;
  } else {
    LayoutComponent = WideLayout;
  }

  return (
    <div className={cn("flex h-full min-w-0 flex-col", className)}>
      <LayoutComponent onClose={handleClose} />
    </div>
  );
}
