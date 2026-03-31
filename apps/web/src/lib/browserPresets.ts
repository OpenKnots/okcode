export type BrowserPresetId = "mobile" | "tablet" | "laptop" | "desktop" | "ultrawide";

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

export function getBrowserPreset(id: BrowserPresetId): BrowserPreset | undefined {
  return BROWSER_PRESETS.find((p) => p.id === id);
}
