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
  | "cursor-dark"
  | "cathedral-circuit"
  | "custom";

type ThemeSnapshot = {
  theme: Theme;
  systemDark: boolean;
  colorTheme: ColorTheme;
};

export const COLOR_THEMES: { id: ColorTheme; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "iridescent-void", label: "Iridescent Void" },
  { id: "solar-witch", label: "Solar Witch" },
  { id: "cursor-dark", label: "Cursor Dark" },
  { id: "cathedral-circuit", label: "Cathedral Circuit" },
  { id: "custom", label: "Custom" },
];

const STORAGE_KEY = "okcode:theme";
const COLOR_THEME_STORAGE_KEY = "okcode:color-theme";
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
    raw === "cursor-dark" ||
    raw === "cathedral-circuit" ||
    raw === "custom"
  ) {
    return raw;
  }
  return "default";
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

  // Handle custom theme style injection
  if (colorTheme === "custom") {
    const customTheme = getStoredCustomTheme();
    if (customTheme) {
      applyCustomTheme(customTheme);
    }
  } else {
    removeCustomTheme();
  }

  // Always reapply overrides (radius, font) since they work on top of any theme
  applyRadiusOverride();
  applyFontOverride();

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

  if (
    lastSnapshot &&
    lastSnapshot.theme === theme &&
    lastSnapshot.systemDark === systemDark &&
    lastSnapshot.colorTheme === colorTheme
  ) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark, colorTheme };
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
    if (e.key === STORAGE_KEY || e.key === COLOR_THEME_STORAGE_KEY) {
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

  // Keep DOM in sync on mount/change
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme, resolvedTheme, colorTheme, setColorTheme } as const;
}

export type { Theme, ColorTheme };
