import { ActivityIcon, BoxIcon, ClockIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { type InspectorTab, useSimulationViewerStore } from "~/simulationViewerStore";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

const TABS: { id: InspectorTab; label: string; Icon: typeof SlidersHorizontalIcon }[] = [
  { id: "parameters", label: "Params", Icon: SlidersHorizontalIcon },
  { id: "entities", label: "Entities", Icon: BoxIcon },
  { id: "timeline", label: "Timeline", Icon: ClockIcon },
  { id: "metrics", label: "Metrics", Icon: ActivityIcon },
];

// ─── Parameter Slider ────────────────────────────────────────────────
function ParameterRow({
  param,
}: {
  param: {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit?: string;
  };
}) {
  const updateParameter = useSimulationViewerStore((s) => s.updateParameter);

  return (
    <label className="flex flex-col gap-1 px-3 py-1.5">
      <span className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{param.label}</span>
        <span className="tabular-nums text-foreground">
          {param.value}
          {param.unit ? ` ${param.unit}` : ""}
        </span>
      </span>
      <input
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={param.value}
        onChange={(e) => updateParameter(param.id, Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted/50 accent-primary [&::-webkit-slider-thumb]:size-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
      />
    </label>
  );
}

// ─── Entity List ─────────────────────────────────────────────────────
function EntityListPanel() {
  const entities = useSimulationViewerStore((s) => s.entities);
  const selectedEntityId = useSimulationViewerStore((s) => s.selectedEntityId);
  const selectEntity = useSimulationViewerStore((s) => s.selectEntity);

  if (entities.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-foreground/60">
        No entities in the simulation yet. Start the simulation to see entities appear.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
      {entities.map((entity) => (
        <button
          key={entity.id}
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
            entity.id === selectedEntityId
              ? "bg-primary/10 text-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
          onClick={() => selectEntity(entity.id === selectedEntityId ? null : entity.id)}
        >
          <BoxIcon className="size-3 shrink-0 opacity-60" />
          <span className="min-w-0 flex-1 truncate font-medium">{entity.label}</span>
          <span className="shrink-0 text-[10px] tabular-nums opacity-50">
            ({Math.round(entity.x)}, {Math.round(entity.y)})
          </span>
        </button>
      ))}

      {/* Selected entity detail */}
      {selectedEntityId &&
        (() => {
          const entity = entities.find((e) => e.id === selectedEntityId);
          if (!entity) return null;
          return (
            <>
              <Separator className="my-1.5" />
              <div className="px-3 py-1.5">
                <p className="mb-1 text-[11px] font-medium text-foreground">{entity.label}</p>
                <p className="text-[10px] text-muted-foreground">Type: {entity.type}</p>
                {Object.entries(entity.properties).map(([key, val]) => (
                  <p key={key} className="text-[10px] text-muted-foreground">
                    {key}: <span className="tabular-nums text-foreground">{String(val)}</span>
                  </p>
                ))}
              </div>
            </>
          );
        })()}
    </div>
  );
}

// ─── Timeline Panel ──────────────────────────────────────────────────
function TimelinePanel() {
  const currentTick = useSimulationViewerStore((s) => s.currentTick);
  const maxTick = useSimulationViewerStore((s) => s.maxTick);
  const speed = useSimulationViewerStore((s) => s.speed);
  const playbackState = useSimulationViewerStore((s) => s.playbackState);

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <InfoCard label="Current Tick" value={String(currentTick)} />
        <InfoCard label="Max Tick" value={String(maxTick)} />
        <InfoCard label="Speed" value={`${speed}x`} />
        <InfoCard label="State" value={playbackState} />
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
        <p className="text-[11px] text-muted-foreground">Progress</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150"
            style={{ width: `${maxTick > 0 ? (currentTick / maxTick) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground/60">
          {maxTick > 0 ? Math.round((currentTick / maxTick) * 100) : 0}%
        </p>
      </div>
    </div>
  );
}

// ─── Metrics Panel ───────────────────────────────────────────────────
function MetricsPanel() {
  const metrics = useSimulationViewerStore((s) => s.metrics);

  if (metrics.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-foreground/60">
        No metrics recorded yet. Metrics will appear as the simulation runs.
      </div>
    );
  }

  // Show latest snapshot
  const latest = metrics[metrics.length - 1]!;
  const entries = Object.entries(latest.values);

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-[10px] text-muted-foreground/60">
        Tick {latest.tick} &middot; {metrics.length} snapshots
      </p>
      {entries.map(([key, val]) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-md bg-muted/20 px-3 py-1.5"
        >
          <span className="text-[11px] text-muted-foreground">{key}</span>
          <span className="text-[11px] tabular-nums font-medium text-foreground">
            {typeof val === "number" ? val.toFixed(2) : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
      <p className="text-[10px] text-muted-foreground/60">{label}</p>
      <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
    </div>
  );
}

// ─── Parameters Panel ────────────────────────────────────────────────
function ParametersPanel() {
  const parameters = useSimulationViewerStore((s) => s.parameters);

  if (parameters.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-foreground/60">
        No parameters configured. Parameters will appear when a simulation is loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto py-1">
      {parameters.map((param) => (
        <ParameterRow key={param.id} param={param} />
      ))}
    </div>
  );
}

// ─── Tab Content Router ──────────────────────────────────────────────
function InspectorTabContent({ tab }: { tab: InspectorTab }) {
  switch (tab) {
    case "parameters":
      return <ParametersPanel />;
    case "entities":
      return <EntityListPanel />;
    case "timeline":
      return <TimelinePanel />;
    case "metrics":
      return <MetricsPanel />;
  }
}

// ─── Main Inspector Component ────────────────────────────────────────
/**
 * Side panel or bottom-drawer inspector for the simulation viewer.
 *
 * Layouts:
 * - **sidebar** (desktop/wide/ultrawide): fixed-width right panel
 * - **bottom** (tablet): horizontal bottom strip
 * - **sheet** (mobile): full-screen sheet overlay
 */
export function SimulationInspector({
  layout = "sidebar",
  className,
  onClose,
}: {
  layout?: "sidebar" | "bottom" | "sheet";
  className?: string;
  onClose?: () => void;
}) {
  const inspectorTab = useSimulationViewerStore((s) => s.inspectorTab);
  const setInspectorTab = useSimulationViewerStore((s) => s.setInspectorTab);

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-col border-border/60 bg-card/90 text-foreground backdrop-blur-sm",
        layout === "sidebar" && "h-full w-64 border-l xl:w-72 2xl:w-80",
        layout === "bottom" && "h-56 w-full border-t",
        layout === "sheet" && "h-full w-full",
        className,
      )}
      data-slot="simulation-inspector"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                inspectorTab === tab.id
                  ? "bg-accent/60 text-foreground"
                  : "text-muted-foreground/60 hover:bg-accent/30 hover:text-foreground",
              )}
              onClick={() => setInspectorTab(tab.id)}
              aria-label={tab.label}
            >
              <tab.Icon className="size-3" />
              <span className={cn(layout === "bottom" ? "max-md:hidden" : "")}>{tab.label}</span>
            </button>
          ))}
        </div>
        {onClose && (
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground/50 hover:text-foreground"
            aria-label="Close inspector"
            onClick={onClose}
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <InspectorTabContent tab={inspectorTab} />
      </div>
    </div>
  );
}
