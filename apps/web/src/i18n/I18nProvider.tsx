import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IntlErrorCode, IntlProvider } from "react-intl";
import { useAppSettings } from "../appSettings";
import { getNavigatorLocaleSnapshot, resolveAppLocale } from "./locale";
import { EN_MESSAGES, loadMessages } from "./loadMessages";
import type { AppLocalePreference, AppMessages, ResolvedAppLocale } from "./types";

type I18nContextValue = {
  locale: AppLocalePreference;
  resolvedLocale: ResolvedAppLocale;
  messages: AppMessages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useAppSettings();
  const [navigatorLocale, setNavigatorLocale] = useState(() => getNavigatorLocaleSnapshot());
  const [loadedLocale, setLoadedLocale] = useState<ResolvedAppLocale>("en");
  const [loadedMessages, setLoadedMessages] = useState<AppMessages>(EN_MESSAGES);

  const resolvedLocale = useMemo(
    () => resolveAppLocale(settings.locale, navigatorLocale.languages, navigatorLocale.language),
    [navigatorLocale.language, navigatorLocale.languages, settings.locale],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncNavigatorLocale = () => {
      setNavigatorLocale(getNavigatorLocaleSnapshot());
    };

    window.addEventListener("languagechange", syncNavigatorLocale);
    return () => {
      window.removeEventListener("languagechange", syncNavigatorLocale);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (resolvedLocale === "en") {
      setLoadedLocale("en");
      setLoadedMessages(EN_MESSAGES);
      return undefined;
    }

    void loadMessages(resolvedLocale).then((messages) => {
      if (cancelled) {
        return;
      }

      setLoadedLocale(resolvedLocale);
      setLoadedMessages(messages);
    });

    return () => {
      cancelled = true;
    };
  }, [resolvedLocale]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = resolvedLocale;
    document.documentElement.dir = "ltr";
  }, [resolvedLocale]);

  const activeMessages = loadedLocale === resolvedLocale ? loadedMessages : EN_MESSAGES;
  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale: settings.locale,
      resolvedLocale,
      messages: activeMessages,
    }),
    [activeMessages, resolvedLocale, settings.locale],
  );

  return (
    <I18nContext.Provider value={contextValue}>
      <IntlProvider
        key={resolvedLocale}
        locale={resolvedLocale}
        defaultLocale="en"
        messages={activeMessages}
        onError={(error) => {
          if (error.code === IntlErrorCode.MISSING_TRANSLATION) {
            return;
          }

          console.error(error);
        }}
      >
        {children}
      </IntlProvider>
    </I18nContext.Provider>
  );
}

export function useI18nContext(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18nContext must be used within an I18nProvider.");
  }

  return context;
}
