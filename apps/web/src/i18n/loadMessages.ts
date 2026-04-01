import type { AppMessages, ResolvedAppLocale } from "./types";
import enMessagesJson from "./messages/en.json";

export const EN_MESSAGES: AppMessages = enMessagesJson;

export type MessageLoaderMap = Record<ResolvedAppLocale, () => Promise<AppMessages>>;

const MESSAGE_LOADERS: MessageLoaderMap = {
  en: () => Promise.resolve(EN_MESSAGES),
  es: () => import("./messages/es.json").then((module) => module.default),
  fr: () => import("./messages/fr.json").then((module) => module.default),
  "zh-CN": () => import("./messages/zh-CN.json").then((module) => module.default),
};

const messageCache = new Map<ResolvedAppLocale, Promise<AppMessages>>();
const failedLocaleLogs = new Set<ResolvedAppLocale>();

function logLocaleLoadFailure(locale: ResolvedAppLocale, error: unknown) {
  if (failedLocaleLogs.has(locale)) {
    return;
  }

  failedLocaleLogs.add(locale);
  console.error(`[i18n] Failed to load locale "${locale}". Falling back to English.`, error);
}

export async function loadMessagesFromLoaders(
  locale: ResolvedAppLocale,
  loaders: MessageLoaderMap,
): Promise<AppMessages> {
  try {
    return await loaders[locale]();
  } catch (error) {
    logLocaleLoadFailure(locale, error);
    return EN_MESSAGES;
  }
}

export function loadMessages(locale: ResolvedAppLocale): Promise<AppMessages> {
  const cached = messageCache.get(locale);
  if (cached) {
    return cached;
  }

  const pending = loadMessagesFromLoaders(locale, MESSAGE_LOADERS);
  messageCache.set(locale, pending);
  return pending;
}
