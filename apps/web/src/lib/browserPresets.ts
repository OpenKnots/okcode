export type BrowserPresetId = "mobile" | "tablet" | "laptop" | "desktop" | "ultrawide" | "custom";

export interface BrowserPreset {
  id: BrowserPresetId;
  label: string;
  width: number;
  height: number;
}

export const BROWSER_PRESETS: readonly BrowserPreset[] = [
  { id: "mobile", label: "Mobile", width: 390, height: 844 },
  { id: "tablet", label: "Tablet", width: 768, height: 1024 },
  { id: "laptop", label: "Laptop", width: 1366, height: 768 },
  { id: "desktop", label: "Desktop", width: 1920, height: 1080 },
  { id: "ultrawide", label: "Ultrawide", width: 2560, height: 1080 },
] as const;

/** Ordered list of preset IDs for cycling (excludes "custom"). */
export const PRESET_CYCLE: readonly (BrowserPresetId | null)[] = [
  null, // responsive
  "mobile",
  "tablet",
  "laptop",
  "desktop",
  "ultrawide",
];

export function getBrowserPreset(id: BrowserPresetId): BrowserPreset | undefined {
  return BROWSER_PRESETS.find((p) => p.id === id);
}

/** Default dimensions for custom viewports. */
export const DEFAULT_CUSTOM_VIEWPORT = { width: 1024, height: 768 } as const;

/** Clamp a viewport dimension to sane bounds. */
export function clampViewportDimension(value: number): number {
  return Math.max(320, Math.min(3840, Math.round(value)));
}
