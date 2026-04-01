export const APP_LOCALE_PREFERENCES = ["system", "en", "es", "fr", "zh-CN"] as const;
export type AppLocalePreference = (typeof APP_LOCALE_PREFERENCES)[number];

export const RESOLVED_APP_LOCALES = ["en", "es", "fr", "zh-CN"] as const;
export type ResolvedAppLocale = (typeof RESOLVED_APP_LOCALES)[number];

export type AppMessages = Record<string, string>;
export type TranslationValues = Record<string, unknown>;
