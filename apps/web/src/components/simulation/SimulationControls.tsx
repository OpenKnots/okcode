import { useCallback } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GridIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipBackIcon,
  SquareIcon,
  TagIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { useSimulationViewerStore } from "~/simulationViewerStore";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

const SPEED_STEPS = [0.25, 0.5, 1, 2, 4] as const;

function SpeedLabel({ speed }: { speed: number }) {
  return (
    <span className="min-w-[2.5ch] text-center tabular-nums text-[11px] text-muted-foreground">
      {speed}x
    </span>
  );
}

/**
 * Compact playback and viewport controls bar.
 *
 * Two layout modes:
 * - **inline** (≥ tablet): horizontal bar that sits below the canvas toolbar
 * - **drawer** (mobile): vertical strip rendered in a bottom sheet
 */
export function SimulationControls({
  layout = "inline",
  className,
}: {
  layout?: "inline" | "drawer";
  className?: string;
}) {
  const playbackState = useSimulationViewerStore((s) => s.playbackState);
  const speed = useSimulationViewerStore((s) => s.speed);
  const currentTick = useSimulationViewerStore((s) => s.currentTick);
  const maxTick = useSimulationViewerStore((s) => s.maxTick);
  const zoom = useSimulationViewerStore((s) => s.zoom);
  const showGrid = useSimulationViewerStore((s) => s.showGrid);
  const showEntityLabels = useSimulationViewerStore((s) => s.showEntityLabels);

  const play = useSimulationViewerStore((s) => s.play);
  const pause = useSimulationViewerStore((s) => s.pause);
  const stop = useSimulationViewerStore((s) => s.stop);
  const setSpeed = useSimulationViewerStore((s) => s.setSpeed);
  const setTick = useSimulationViewerStore((s) => s.setTick);
  const setZoom = useSimulationViewerStore((s) => s.setZoom);
  const toggleGrid = useSimulationViewerStore((s) => s.toggleGrid);
  const toggleEntityLabels = useSimulationViewerStore((s) => s.toggleEntityLabels);
  const reset = useSimulationViewerStore((s) => s.reset);

  const cycleSpeed = useCallback(
    (direction: 1 | -1) => {
      const idx = SPEED_STEPS.indexOf(speed as (typeof SPEED_STEPS)[number]);
      const nextIdx = Math.max(
        0,
        Math.min(SPEED_STEPS.length - 1, (idx === -1 ? 2 : idx) + direction),
      );
      setSpeed(SPEED_STEPS[nextIdx]!);
    },
    [speed, setSpeed],
  );

  const isVertical = layout === "drawer";

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1.5",
        isVertical && "flex-col gap-2 px-1.5 py-3",
        className,
      )}
    >
      {/* ── Playback ───────────────────────────────────────────────── */}
      <div className={cn("flex items-center gap-0.5", isVertical && "flex-col")}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Reset to start"
                onClick={() => setTick(0)}
              />
            }
          >
            <SkipBackIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup>Reset to start</TooltipPopup>
        </Tooltip>

        {playbackState === "playing" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Pause"
                  onClick={pause}
                />
              }
            >
              <PauseIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup>Pause</TooltipPopup>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Play"
                  onClick={play}
                />
              }
            >
              <PlayIcon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup>Play</TooltipPopup>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Stop"
                onClick={stop}
                disabled={playbackState === "stopped"}
              />
            }
          >
            <SquareIcon className="size-3" />
          </TooltipTrigger>
          <TooltipPopup>Stop</TooltipPopup>
        </Tooltip>
      </div>

      <Separator
        orientation={isVertical ? "horizontal" : "vertical"}
        className={isVertical ? "w-full" : "mx-1 h-5"}
      />

      {/* ── Speed ──────────────────────────────────────────────────── */}
      <div className={cn("flex items-center gap-0.5", isVertical && "flex-col")}>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Decrease speed"
          onClick={() => cycleSpeed(-1)}
          disabled={speed <= SPEED_STEPS[0]!}
        >
          <ChevronLeftIcon className="size-3" />
        </Button>
        <SpeedLabel speed={speed} />
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Increase speed"
          onClick={() => cycleSpeed(1)}
          disabled={speed >= SPEED_STEPS[SPEED_STEPS.length - 1]!}
        >
          <ChevronRightIcon className="size-3" />
        </Button>
      </div>

      <Separator
        orientation={isVertical ? "horizontal" : "vertical"}
        className={isVertical ? "w-full" : "mx-1 h-5"}
      />

      {/* ── Timeline scrubber ──────────────────────────────────────── */}
      <div
        className={cn("flex min-w-0 flex-1 items-center gap-2", isVertical && "w-full flex-col")}
      >
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {currentTick}
        </span>
        <input
          type="range"
          min={0}
          max={maxTick}
          value={currentTick}
          onChange={(e) => setTick(Number(e.target.value))}
          className={cn(
            "h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted/50 accent-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm",
            isVertical && "w-full",
          )}
          aria-label="Timeline"
        />
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {maxTick}
        </span>
      </div>

      <Separator
        orientation={isVertical ? "horizontal" : "vertical"}
        className={isVertical ? "w-full" : "mx-1 h-5"}
      />

      {/* ── Zoom ───────────────────────────────────────────────────── */}
      <div className={cn("flex items-center gap-0.5", isVertical && "flex-col")}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Zoom out"
                onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
                disabled={zoom <= 0.25}
              />
            }
          >
            <ZoomOutIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup>Zoom out</TooltipPopup>
        </Tooltip>
        <span className="min-w-[3ch] text-center text-[10px] tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Zoom in"
                onClick={() => setZoom(Math.min(4, zoom + 0.25))}
                disabled={zoom >= 4}
              />
            }
          >
            <ZoomInIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup>Zoom in</TooltipPopup>
        </Tooltip>
      </div>

      <Separator
        orientation={isVertical ? "horizontal" : "vertical"}
        className={isVertical ? "w-full" : "mx-1 h-5"}
      />

      {/* ── Overlay toggles ────────────────────────────────────────── */}
      <div className={cn("flex items-center gap-0.5", isVertical && "flex-col")}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Toggle grid"
                aria-pressed={showGrid}
                onClick={toggleGrid}
                className={showGrid ? "text-foreground" : "text-muted-foreground/40"}
              />
            }
          >
            <GridIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup>{showGrid ? "Hide grid" : "Show grid"}</TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Toggle entity labels"
                aria-pressed={showEntityLabels}
                onClick={toggleEntityLabels}
                className={showEntityLabels ? "text-foreground" : "text-muted-foreground/40"}
              />
            }
          >
            <TagIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup>{showEntityLabels ? "Hide labels" : "Show labels"}</TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Reset simulation"
                onClick={reset}
              />
            }
          >
            <RotateCcwIcon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup>Reset simulation</TooltipPopup>
        </Tooltip>
      </div>
    </div>
  );
}
