import { useCallback, useEffect, useSyncExternalStore } from "react";
import { initCustomTheme } from "../lib/customTheme";
import { DEFAULT_COLOR_THEME } from "./themeConfig";
export { COLOR_THEMES, DEFAULT_COLOR_THEME, FONT_FAMILIES } from "./themeConfig";
import type { ColorTheme, FontFamily, Theme } from "./themeConfig";

type ThemeSnapshot = {
  theme: Theme;
  systemDark: boolean;
  colorTheme: ColorTheme;
  fontFamily: FontFamily;
};

const STORAGE_KEY = "okcode:theme";
const COLOR_THEME_STORAGE_KEY = "okcode:color-theme";
const FONT_FAMILY_STORAGE_KEY = "okcode:font-family";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const canUseDOM = typeof window !== "undefined" && typeof document !== "undefined";

const SERVER_SNAPSHOT: ThemeSnapshot = {
  theme: "system",
  systemDark: false,
  colorTheme: DEFAULT_COLOR_THEME,
  fontFamily: "inter",
};

let listeners: Array<() => void> = [];
let lastSnapshot: ThemeSnapshot | null = null;
let lastDesktopTheme: Theme | null = null;
function emitChange() {
  for (const listener of listeners) listener();
}

function safeLocalStorageGet(key: string): string | null {
  if (!canUseDOM) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string) {
  if (!canUseDOM) {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and keep the in-memory theme usable.
  }
}

function getSystemDark(): boolean {
  if (!canUseDOM) {
    return false;
  }

  return window.matchMedia(MEDIA_QUERY).matches;
}

function getStored(): Theme {
  const raw = safeLocalStorageGet(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

function getStoredColorTheme(): ColorTheme {
  const raw = safeLocalStorageGet(COLOR_THEME_STORAGE_KEY);
  const normalized = raw === "cotton-candy" ? "purple-stuff" : raw;

  if (
    normalized === "default" ||
    normalized === "iridescent-void" ||
    normalized === "carbon" ||
    normalized === "purple-stuff" ||
    normalized === "hot-tamale" ||
    normalized === "custom"
  ) {
    if (normalized !== raw && raw !== null) {
      safeLocalStorageSet(COLOR_THEME_STORAGE_KEY, normalized);
    }

    return normalized;
  }
  return DEFAULT_COLOR_THEME;
}

function getStoredFontFamily(): FontFamily {
  const raw = safeLocalStorageGet(FONT_FAMILY_STORAGE_KEY);
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

function getRootElement(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const root = document.documentElement;
  if (!root) {
    return null;
  }

  return root;
}

function hasStyleTarget(
  root: HTMLElement | null,
): root is HTMLElement & { style: CSSStyleDeclaration } {
  return typeof root?.style?.setProperty === "function";
}

function hasClassListTarget(
  root: HTMLElement | null,
): root is HTMLElement & { classList: DOMTokenList } {
  return (
    typeof root?.classList?.add === "function" &&
    typeof root.classList.remove === "function" &&
    typeof root.classList.toggle === "function"
  );
}

function applyFont(fontFamily?: FontFamily) {
  const font = fontFamily ?? getStoredFontFamily();
  const root = getRootElement();
  if (!hasStyleTarget(root)) {
    return;
  }
  root.style.setProperty("--font-ui", FONT_FAMILY_MAP[font]);
}

function applyTheme(theme: Theme, suppressTransitions = false) {
  const root = getRootElement();
  if (!hasClassListTarget(root)) {
    return;
  }

  if (suppressTransitions) {
    root.classList.add("no-transitions");
  }
  const isDark = theme === "dark" || (theme === "system" && getSystemDark());
  root.classList.toggle("dark", isDark);

  // Apply color theme class
  const colorTheme = getStoredColorTheme();
  // Remove any existing theme-* classes
  const existingThemeClasses = Array.from(root.classList).filter((cls) => cls.startsWith("theme-"));
  for (const cls of existingThemeClasses) {
    root.classList.remove(cls);
  }
  // Add the new theme class if not default
  if (colorTheme !== "default") {
    root.classList.add(`theme-${colorTheme}`);
  }

  // Apply font family
  applyFont();

  syncDesktopTheme(theme);
  if (suppressTransitions) {
    // Force a reflow so the no-transitions class takes effect before removal
    // oxlint-disable-next-line no-unused-expressions
    root.offsetHeight;
    requestAnimationFrame(() => {
      root.classList.remove("no-transitions");
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
if (canUseDOM) {
  initCustomTheme();

  // Apply immediately on module load to prevent flash
  applyTheme(getStored());
}

function getSnapshot(): ThemeSnapshot {
  if (!canUseDOM) {
    return SERVER_SNAPSHOT;
  }

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

function getServerSnapshot(): ThemeSnapshot {
  return SERVER_SNAPSHOT;
}

function subscribe(listener: () => void): () => void {
  if (!canUseDOM) {
    return () => {};
  }

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
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const theme = snapshot.theme;
  const colorTheme = snapshot.colorTheme;
  const fontFamily = snapshot.fontFamily;

  const resolvedTheme: "light" | "dark" =
    theme === "system" ? (snapshot.systemDark ? "dark" : "light") : theme;

  const setTheme = useCallback((next: Theme) => {
    safeLocalStorageSet(STORAGE_KEY, next);
    applyTheme(next, true);
    emitChange();
  }, []);

  const setColorTheme = useCallback((next: ColorTheme) => {
    safeLocalStorageSet(COLOR_THEME_STORAGE_KEY, next);
    applyTheme(getStored(), true);
    emitChange();
  }, []);

  const setFontFamily = useCallback((next: FontFamily) => {
    safeLocalStorageSet(FONT_FAMILY_STORAGE_KEY, next);
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
