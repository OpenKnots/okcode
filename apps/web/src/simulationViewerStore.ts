import { create } from "zustand";

// ─── Viewport Presets ────────────────────────────────────────────────
export type SimulationViewportPreset =
  | "mobile"
  | "tablet"
  | "laptop"
  | "desktop"
  | "wide"
  | "ultrawide";

export interface SimulationViewportConfig {
  id: SimulationViewportPreset;
  label: string;
  width: number;
  height: number;
  /** Columns of grid panels to show in multi-panel layout. */
  panelColumns: 1 | 2 | 3 | 4;
  /** Whether to show the controls panel inline vs. collapsed. */
  inlineControls: boolean;
  /** Whether the side inspector should be visible by default. */
  showInspector: boolean;
}

export const SIMULATION_VIEWPORT_PRESETS: readonly SimulationViewportConfig[] = [
  {
    id: "mobile",
    label: "Mobile",
    width: 390,
    height: 844,
    panelColumns: 1,
    inlineControls: false,
    showInspector: false,
  },
  {
    id: "tablet",
    label: "Tablet",
    width: 768,
    height: 1024,
    panelColumns: 1,
    inlineControls: true,
    showInspector: false,
  },
  {
    id: "laptop",
    label: "Laptop",
    width: 1366,
    height: 768,
    panelColumns: 2,
    inlineControls: true,
    showInspector: true,
  },
  {
    id: "desktop",
    label: "Desktop",
    width: 1920,
    height: 1080,
    panelColumns: 2,
    inlineControls: true,
    showInspector: true,
  },
  {
    id: "wide",
    label: "Wide",
    width: 2560,
    height: 1080,
    panelColumns: 3,
    inlineControls: true,
    showInspector: true,
  },
  {
    id: "ultrawide",
    label: "Ultrawide",
    width: 3440,
    height: 1440,
    panelColumns: 4,
    inlineControls: true,
    showInspector: true,
  },
] as const;

export function getSimulationViewportPreset(
  id: SimulationViewportPreset,
): SimulationViewportConfig | undefined {
  return SIMULATION_VIEWPORT_PRESETS.find((p) => p.id === id);
}

// ─── Playback State ──────────────────────────────────────────────────
export type PlaybackState = "stopped" | "playing" | "paused";

// ─── Inspector Tabs ──────────────────────────────────────────────────
export type InspectorTab = "parameters" | "entities" | "timeline" | "metrics";

// ─── Simulation Parameter ────────────────────────────────────────────
export interface SimulationParameter {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

// ─── Entity (for entity inspector) ───────────────────────────────────
export interface SimulationEntity {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  properties: Record<string, number | string | boolean>;
}

// ─── Metric snapshot ─────────────────────────────────────────────────
export interface MetricSnapshot {
  tick: number;
  timestamp: number;
  values: Record<string, number>;
}

// ─── Store Interface ─────────────────────────────────────────────────
interface SimulationViewerState {
  // Panel open state
  isOpen: boolean;

  // Playback
  playbackState: PlaybackState;
  speed: number; // multiplier (0.25 – 4)
  currentTick: number;
  maxTick: number;

  // Viewport
  viewportPreset: SimulationViewportPreset | null;
  zoom: number; // 0.25 – 4

  // Inspector
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;

  // Controls drawer (mobile)
  controlsDrawerOpen: boolean;

  // Parameters
  parameters: SimulationParameter[];

  // Entities
  entities: SimulationEntity[];
  selectedEntityId: string | null;

  // Metrics history
  metrics: MetricSnapshot[];

  // Grid overlay
  showGrid: boolean;
  showEntityLabels: boolean;

  // ─── Actions ─────────────────────────────────────────────────────
  open: () => void;
  close: () => void;

  play: () => void;
  pause: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  setTick: (tick: number) => void;
  setMaxTick: (maxTick: number) => void;

  setViewportPreset: (preset: SimulationViewportPreset | null) => void;
  setZoom: (zoom: number) => void;

  toggleInspector: () => void;
  setInspectorTab: (tab: InspectorTab) => void;

  toggleControlsDrawer: () => void;
  setControlsDrawerOpen: (open: boolean) => void;

  setParameters: (params: SimulationParameter[]) => void;
  updateParameter: (id: string, value: number) => void;

  setEntities: (entities: SimulationEntity[]) => void;
  selectEntity: (id: string | null) => void;

  pushMetrics: (snapshot: MetricSnapshot) => void;
  clearMetrics: () => void;

  toggleGrid: () => void;
  toggleEntityLabels: () => void;

  /** Full reset to initial values. */
  reset: () => void;
}

const STORAGE_KEY = "okcode:simulation-viewer:v1";

interface PersistedSimulationState {
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  viewportPreset: SimulationViewportPreset | null;
  zoom: number;
  speed: number;
  showGrid: boolean;
  showEntityLabels: boolean;
}

function createDefaultPersistedState(): PersistedSimulationState {
  return {
    inspectorOpen: true,
    inspectorTab: "parameters",
    viewportPreset: null,
    zoom: 1,
    speed: 1,
    showGrid: true,
    showEntityLabels: true,
  };
}

function readPersistedState(): PersistedSimulationState {
  if (typeof window === "undefined") return createDefaultPersistedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultPersistedState();
    const parsed = JSON.parse(raw) as Partial<PersistedSimulationState>;
    return {
      inspectorOpen: typeof parsed.inspectorOpen === "boolean" ? parsed.inspectorOpen : true,
      inspectorTab:
        parsed.inspectorTab &&
        ["parameters", "entities", "timeline", "metrics"].includes(parsed.inspectorTab)
          ? parsed.inspectorTab
          : "parameters",
      viewportPreset:
        parsed.viewportPreset &&
        SIMULATION_VIEWPORT_PRESETS.some((p) => p.id === parsed.viewportPreset)
          ? parsed.viewportPreset
          : null,
      zoom:
        typeof parsed.zoom === "number" && Number.isFinite(parsed.zoom)
          ? Math.max(0.25, Math.min(4, parsed.zoom))
          : 1,
      speed:
        typeof parsed.speed === "number" && Number.isFinite(parsed.speed)
          ? Math.max(0.25, Math.min(4, parsed.speed))
          : 1,
      showGrid: typeof parsed.showGrid === "boolean" ? parsed.showGrid : true,
      showEntityLabels:
        typeof parsed.showEntityLabels === "boolean" ? parsed.showEntityLabels : true,
    };
  } catch {
    return createDefaultPersistedState();
  }
}

function persistState(state: PersistedSimulationState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
}

function snapshotPersisted(state: SimulationViewerState): PersistedSimulationState {
  return {
    inspectorOpen: state.inspectorOpen,
    inspectorTab: state.inspectorTab,
    viewportPreset: state.viewportPreset,
    zoom: state.zoom,
    speed: state.speed,
    showGrid: state.showGrid,
    showEntityLabels: state.showEntityLabels,
  };
}

const persisted = readPersistedState();

export const useSimulationViewerStore = create<SimulationViewerState>((set, get) => ({
  isOpen: false,
  playbackState: "stopped",
  speed: persisted.speed,
  currentTick: 0,
  maxTick: 1000,
  viewportPreset: persisted.viewportPreset,
  zoom: persisted.zoom,
  inspectorOpen: persisted.inspectorOpen,
  inspectorTab: persisted.inspectorTab,
  controlsDrawerOpen: false,
  parameters: [],
  entities: [],
  selectedEntityId: null,
  metrics: [],
  showGrid: persisted.showGrid,
  showEntityLabels: persisted.showEntityLabels,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, playbackState: "stopped" }),

  play: () => set({ playbackState: "playing" }),
  pause: () => set({ playbackState: "paused" }),
  stop: () => set({ playbackState: "stopped", currentTick: 0 }),
  setSpeed: (speed) => {
    const clamped = Math.max(0.25, Math.min(4, speed));
    set({ speed: clamped });
    persistState({ ...snapshotPersisted(get()), speed: clamped });
  },
  setTick: (tick) => set({ currentTick: Math.max(0, Math.min(tick, get().maxTick)) }),
  setMaxTick: (maxTick) => set({ maxTick: Math.max(1, maxTick) }),

  setViewportPreset: (preset) => {
    set({ viewportPreset: preset });
    persistState({ ...snapshotPersisted(get()), viewportPreset: preset });
  },
  setZoom: (zoom) => {
    const clamped = Math.max(0.25, Math.min(4, zoom));
    set({ zoom: clamped });
    persistState({ ...snapshotPersisted(get()), zoom: clamped });
  },

  toggleInspector: () => {
    const next = !get().inspectorOpen;
    set({ inspectorOpen: next });
    persistState({ ...snapshotPersisted(get()), inspectorOpen: next });
  },
  setInspectorTab: (tab) => {
    set({ inspectorTab: tab });
    persistState({ ...snapshotPersisted(get()), inspectorTab: tab });
  },

  toggleControlsDrawer: () => set((s) => ({ controlsDrawerOpen: !s.controlsDrawerOpen })),
  setControlsDrawerOpen: (open) => set({ controlsDrawerOpen: open }),

  setParameters: (params) => set({ parameters: params }),
  updateParameter: (id, value) =>
    set((state) => ({
      parameters: state.parameters.map((p) =>
        p.id === id ? { ...p, value: Math.max(p.min, Math.min(p.max, value)) } : p,
      ),
    })),

  setEntities: (entities) => set({ entities }),
  selectEntity: (id) => set({ selectedEntityId: id }),

  pushMetrics: (snapshot) =>
    set((state) => ({
      metrics: [...state.metrics.slice(-499), snapshot],
    })),
  clearMetrics: () => set({ metrics: [] }),

  toggleGrid: () => {
    const next = !get().showGrid;
    set({ showGrid: next });
    persistState({ ...snapshotPersisted(get()), showGrid: next });
  },
  toggleEntityLabels: () => {
    const next = !get().showEntityLabels;
    set({ showEntityLabels: next });
    persistState({ ...snapshotPersisted(get()), showEntityLabels: next });
  },

  reset: () => {
    const defaults = createDefaultPersistedState();
    set({
      playbackState: "stopped",
      currentTick: 0,
      speed: defaults.speed,
      zoom: defaults.zoom,
      viewportPreset: defaults.viewportPreset,
      inspectorOpen: defaults.inspectorOpen,
      inspectorTab: defaults.inspectorTab,
      controlsDrawerOpen: false,
      parameters: [],
      entities: [],
      selectedEntityId: null,
      metrics: [],
      showGrid: defaults.showGrid,
      showEntityLabels: defaults.showEntityLabels,
    });
    persistState(defaults);
  },
}));
