import { useCallback, useEffect, useSyncExternalStore } from "react";
import { initCustomTheme } from "../lib/customTheme";
import {
  CODE_FONTS,
  DEFAULT_CODE_FONT,
  DEFAULT_COLOR_THEME,
  DEFAULT_MESSAGE_FONT,
  MESSAGE_FONTS,
  getCodeFontStack,
  getMessageFontStack,
  isCodeFont,
  isMessageFont,
} from "./themeConfig";
export {
  CODE_FONTS,
  COLOR_THEMES,
  DEFAULT_CODE_FONT,
  DEFAULT_COLOR_THEME,
  DEFAULT_MESSAGE_FONT,
  MESSAGE_FONTS,
  getCodeFontStack,
  getMessageFontStack,
} from "./themeConfig";
import type { CodeFont, ColorTheme, MessageFont, Theme } from "./themeConfig";

type ThemeSnapshot = {
  theme: Theme;
  systemDark: boolean;
  colorTheme: ColorTheme;
  messageFont: MessageFont;
  codeFont: CodeFont;
};

const STORAGE_KEY = "okcode:theme";
const COLOR_THEME_STORAGE_KEY = "okcode:color-theme";
/** Legacy (pre-split) — kept for one-shot migration to {@link MESSAGE_FONT_STORAGE_KEY}. */
const LEGACY_FONT_FAMILY_STORAGE_KEY = "okcode:font-family";
const MESSAGE_FONT_STORAGE_KEY = "okcode:message-font";
const CODE_FONT_STORAGE_KEY = "okcode:code-font";
const RUNTIME_FONTS_LINK_ID = "okcode-runtime-fonts";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";
const canUseDOM = typeof window !== "undefined" && typeof document !== "undefined";

const SERVER_SNAPSHOT: ThemeSnapshot = {
  theme: "system",
  systemDark: false,
  colorTheme: DEFAULT_COLOR_THEME,
  messageFont: DEFAULT_MESSAGE_FONT,
  codeFont: DEFAULT_CODE_FONT,
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

function getStoredMessageFont(): MessageFont {
  const raw = safeLocalStorageGet(MESSAGE_FONT_STORAGE_KEY);
  if (isMessageFont(raw)) return raw;
  // One-shot migration from the legacy `okcode:font-family` key.
  const legacy = safeLocalStorageGet(LEGACY_FONT_FAMILY_STORAGE_KEY);
  if (isMessageFont(legacy)) {
    safeLocalStorageSet(MESSAGE_FONT_STORAGE_KEY, legacy);
    return legacy;
  }
  return DEFAULT_MESSAGE_FONT;
}

function getStoredCodeFont(): CodeFont {
  const raw = safeLocalStorageGet(CODE_FONT_STORAGE_KEY);
  if (isCodeFont(raw)) return raw;
  return DEFAULT_CODE_FONT;
}

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

function applyMessageFont(font?: MessageFont) {
  const next = font ?? getStoredMessageFont();
  const root = getRootElement();
  if (!hasStyleTarget(root)) return;
  root.style.setProperty("--font-ui", getMessageFontStack(next));
}

function applyCodeFont(font?: CodeFont) {
  const next = font ?? getStoredCodeFont();
  const root = getRootElement();
  if (!hasStyleTarget(root)) return;
  root.style.setProperty("--font-code", getCodeFontStack(next));
}

/**
 * Ensures any Google-Fonts-backed fonts currently selected are available in
 * the page. Replaces (never duplicates) a single `<link>` tag keyed by
 * {@link RUNTIME_FONTS_LINK_ID}.
 *
 * Node/vitest runs with a minimal HTMLElement shim but no document factory
 * methods (`getElementById`, `createElement`, `document.head`). Guard every
 * call we make so this helper no-ops cleanly under tests.
 */
function loadRequiredGoogleFonts(messageFont: MessageFont, codeFont: CodeFont) {
  if (typeof document === "undefined") return;
  if (typeof document.getElementById !== "function") return;

  const families: string[] = [];
  const messageOption = MESSAGE_FONTS.find((f) => f.id === messageFont);
  const codeOption = CODE_FONTS.find((f) => f.id === codeFont);
  if (messageOption?.googleFont) families.push(messageOption.googleFont);
  if (codeOption?.googleFont && codeOption.googleFont !== messageOption?.googleFont) {
    families.push(codeOption.googleFont);
  }

  const existing = document.getElementById(RUNTIME_FONTS_LINK_ID) as HTMLLinkElement | null;

  if (families.length === 0) {
    existing?.remove();
    return;
  }

  const familyParams = families
    .map((name) => `family=${name.replace(/\s+/g, "+")}:ital,wght@0,300..800;1,300..800`)
    .join("&");
  const href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;

  if (existing && existing.href === href) return;

  if (typeof document.createElement !== "function" || !document.head) return;
  const link = existing ?? document.createElement("link");
  link.id = RUNTIME_FONTS_LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  if (!existing) document.head.appendChild(link);
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

  // Apply message + code fonts (both read from storage, both independent).
  const messageFont = getStoredMessageFont();
  const codeFont = getStoredCodeFont();
  applyMessageFont(messageFont);
  applyCodeFont(codeFont);
  loadRequiredGoogleFonts(messageFont, codeFont);

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
  const messageFont = getStoredMessageFont();
  const codeFont = getStoredCodeFont();

  if (
    lastSnapshot &&
    lastSnapshot.theme === theme &&
    lastSnapshot.systemDark === systemDark &&
    lastSnapshot.colorTheme === colorTheme &&
    lastSnapshot.messageFont === messageFont &&
    lastSnapshot.codeFont === codeFont
  ) {
    return lastSnapshot;
  }

  lastSnapshot = { theme, systemDark, colorTheme, messageFont, codeFont };
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
      e.key === MESSAGE_FONT_STORAGE_KEY ||
      e.key === CODE_FONT_STORAGE_KEY ||
      e.key === LEGACY_FONT_FAMILY_STORAGE_KEY
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
  const messageFont = snapshot.messageFont;
  const codeFont = snapshot.codeFont;

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

  const setMessageFont = useCallback((next: MessageFont) => {
    safeLocalStorageSet(MESSAGE_FONT_STORAGE_KEY, next);
    applyMessageFont(next);
    loadRequiredGoogleFonts(next, getStoredCodeFont());
    emitChange();
  }, []);

  const setCodeFont = useCallback((next: CodeFont) => {
    safeLocalStorageSet(CODE_FONT_STORAGE_KEY, next);
    applyCodeFont(next);
    loadRequiredGoogleFonts(getStoredMessageFont(), next);
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
    messageFont,
    setMessageFont,
    codeFont,
    setCodeFont,
  } as const;
}

export type { CodeFont, ColorTheme, MessageFont, Theme };
