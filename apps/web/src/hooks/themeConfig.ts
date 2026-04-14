export type Theme = "light" | "dark" | "system";
export type ColorTheme =
  | "default"
  | "iridescent-void"
  | "carbon"
  | "purple-stuff"
  | "hot-tamale"
  | "custom";
export type FontFamily = "dm-sans" | "inter" | "plus-jakarta-sans";

export const COLOR_THEMES: { id: ColorTheme; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "iridescent-void", label: "Iridescent Void" },
  { id: "carbon", label: "Carbon" },
  { id: "purple-stuff", label: "Deep Purple" },
  { id: "hot-tamale", label: "Hot Tamale" },
  { id: "custom", label: "Custom" },
];

export const FONT_FAMILIES: { id: FontFamily; label: string }[] = [
  { id: "inter", label: "Inter" },
  { id: "dm-sans", label: "DM Sans" },
  { id: "plus-jakarta-sans", label: "Plus Jakarta Sans" },
];

export const DEFAULT_COLOR_THEME: ColorTheme = "carbon";
