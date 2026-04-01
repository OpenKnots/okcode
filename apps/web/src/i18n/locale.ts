import type { AppLocalePreference, ResolvedAppLocale } from "./types";

function matchSupportedLocale(candidate: string | null | undefined): ResolvedAppLocale | null {
  if (typeof candidate !== "string") {
    return null;
  }

  const normalized = candidate.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized === "en" || normalized.startsWith("en-")) {
    return "en";
  }

  if (normalized === "es" || normalized.startsWith("es-")) {
    return "es";
  }

  if (normalized === "fr" || normalized.startsWith("fr-")) {
    return "fr";
  }

  if (
    normalized === "zh" ||
    normalized === "zh-cn" ||
    normalized === "zh-sg" ||
    normalized === "zh-hans" ||
    normalized.startsWith("zh-hans-")
  ) {
    return "zh-CN";
  }

  return null;
}

export function resolveAppLocale(
  localePreference: AppLocalePreference,
  navigatorLanguages: readonly string[] = [],
  navigatorLanguage?: string | null,
): ResolvedAppLocale {
  if (localePreference !== "system") {
    return matchSupportedLocale(localePreference) ?? "en";
  }

  for (const candidate of [...navigatorLanguages, navigatorLanguage]) {
    const resolved = matchSupportedLocale(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return "en";
}

export function getNavigatorLocaleSnapshot(): {
  language: string | null;
  languages: readonly string[];
} {
  if (typeof navigator === "undefined") {
    return { language: null, languages: [] };
  }

  return {
    language: navigator.language ?? null,
    languages: Array.isArray(navigator.languages) ? [...navigator.languages] : [],
  };
}
