import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  applyCustomTheme,
  applyFontOverride,
  applyRadiusOverride,
  getStoredCustomTheme,
  initCustomTheme,
  removeCustomTheme,
} from "../lib/customTheme";

type Theme = "light" | "dark" | "system";
type ColorTheme =
  | "default"
  | "iridescent-void"
  | "solar-witch"
  | "midnight-clarity"
  | "carbon"
  | "vapor"
  | "cathedral-circuit";

type FontFamily = "dm-sans" | "inter" | "plus-jakarta-sans";

type ThemeSnapshot = {
  theme: Theme;
  systemDark: boolean;
  colorTheme: ColorTheme;
  fontFamily: FontFamily;
};

export const COLOR_THEMES: { id: ColorTheme; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "iridescent-void", label: "Iridescent Void" },
  { id: "solar-witch", label: "Solar Witch" },
  { id: "midnight-clarity", label: "Midnight Clarity" },
  { id: "carbon", label: "Carbon" },
  { id: "vapor", label: "Vapor" },
  { id: "cathedral-circuit", label: "Cathedral Circuit" },
  { id: "custom", label: "Custom" },
];

export const FONT_FAMILIES: { id: FontFamily; label: string }[] = [
  { id: "inter", label: "Inter" },
  { id: "dm-sans", label: "DM Sans" },
  { id: "plus-jakarta-sans", label: "Plus Jakarta Sans" },
];

const STORAGE_KEY = "okcode:theme";
const COLOR_THEME_STORAGE_KEY = "okcode:color-theme";
const FONT_FAMILY_STORAGE_KEY = "okcode:font-family";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: Theme | null = null;
function emitChange() {
  for (const listener of listeners) listener();
}

function getSystemDark(): boolean {
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getStored(): Theme {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function getStoredColorTheme(): ColorTheme {
  const raw = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
  if (
    raw === "default" ||
    raw === "iridescent-void" ||
    raw === "solar-witch" ||
    raw === "midnight-clarity" ||
    raw === "carbon" ||
    raw === "vapor" ||
    raw === "cathedral-circuit"
  ) {
    return raw;
  }
  return "default";
}

function getStoredFontFamily(): FontFamily {
  const raw = localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
  if (raw === "dm-sans" || raw === "inter" || raw === "plus-jakarta-sans") {
    return raw;
  }
  return "inter";
}

const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  "dm-sans": '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  "plus-jakarta-sans":
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

function applyFont(fontFamily?: FontFamily) {
  const font = fontFamily ?? getStoredFontFamily();
  document.documentElement.style.setProperty("--font-ui", FONT_FAMILY_MAP[font]);
}

function applyTheme(theme: Theme, suppressTransitions = false) {
  if (suppressTransitions) {
    document.documentElement.classList.add("no-transitions");
  }
  const isDark = theme === "dark" || (theme === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", isDark);

  // Apply color theme class
  const colorTheme = getStoredColorTheme();
  // Remove any existing theme-* classes
  const existingThemeClasses = Array.from(document.documentElement.classList).filter((cls) =>
    cls.startsWith("theme-"),
  );
  for (const cls of existingThemeClasses) {
    document.documentElement.classList.remove(cls);
  }
  // Add the new theme class if not default
  if (colorTheme !== "default") {
    document.documentElement.classList.add(`theme-${colorTheme}`);
  }

  // Apply font family
  applyFont();

  syncDesktopTheme(theme);
  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("no-transitions");
    });
  }
}

function syncDesktopTheme(theme: Theme) {
  const bridge = window.desktopBridge;
  if (!bridge || lastDesktopTheme === theme) {
    return;
  }

  lastDesktopTheme = theme;
  void bridge.setTheme(theme).catch(() => {
    if (lastDesktopTheme === theme) {
      lastDesktopTheme = null;
    }
  });
}

// Initialize custom theme + overrides on module load
initCustomTheme();

// Apply immediately on module load to prevent flash
applyTheme(getStored());

function getSnapshot(): ThemeSnapshot {
  const theme = getStored();
  const systemDark = theme === "system" ? getSystemDark() : false;
  const colorTheme = getStoredColorTheme();
  const fontFamily = getStoredFontFamily();

  if (
    lastSnapshot &&
    lastSnapshot.theme === theme &&
    lastSnapshot.systemDark === systemDark &&
    lastSnapshot.colorTheme === colorTheme &&
    lastSnapshot.fontFamily === fontFamily
  ) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark, colorTheme, fontFamily };
  return lastSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);

  // Listen for system preference changes
  const mq = window.matchMedia(MEDIA_QUERY);
  const handleChange = () => {
    if (getStored() === "system") applyTheme("system", true);
    emitChange();
  };
  mq.addEventListener("change", handleChange);

  // Listen for storage changes from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEY ||
      e.key === COLOR_THEME_STORAGE_KEY ||
      e.key === FONT_FAMILY_STORAGE_KEY
    ) {
      applyTheme(getStored(), true);
      emitChange();
    }
  };
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners = listeners.filter((l) => l !== listener);
    mq.removeEventListener("change", handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const theme = snapshot.theme;
  const colorTheme = snapshot.colorTheme;
  const fontFamily = snapshot.fontFamily;

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (snapshot.systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next, true);
    emitChange();
  }, []);

  const setColorTheme = useCallback((next: ColorTheme) => {
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, next);
    applyTheme(getStored(), true);
    emitChange();
  }, []);

  const setFontFamily = useCallback((next: FontFamily) => {
    localStorage.setItem(FONT_FAMILY_STORAGE_KEY, next);
    applyFont(next);
    emitChange();
  }, []);

  // Keep DOM in sync on mount/change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    setTheme,
    resolvedTheme,
    colorTheme,
    setColorTheme,
    fontFamily,
    setFontFamily,
  } as const;
}

export type { Theme, ColorTheme };
