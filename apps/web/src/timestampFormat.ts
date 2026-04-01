import { type TimestampFormat } from "./appSettings";
import type { ResolvedAppLocale } from "./i18n/types";

export function getTimestampFormatOptions(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormatOptions {
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  };

  if (timestampFormat === "locale") {
    return baseOptions;
  }

  return {
    ...baseOptions,
    hour12: timestampFormat === "12-hour",
  };
}

const timestampFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimestampFormatter(
  locale: ResolvedAppLocale,
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormat {
  const cacheKey = `${locale}:${timestampFormat}:${includeSeconds ? "seconds" : "minutes"}`;
  const cachedFormatter = timestampFormatterCache.get(cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(
    locale,
    getTimestampFormatOptions(timestampFormat, includeSeconds),
  );
  timestampFormatterCache.set(cacheKey, formatter);
  return formatter;
}

export function formatTimestamp(
  isoDate: string,
  timestampFormat: TimestampFormat,
  locale: ResolvedAppLocale,
): string {
  return getTimestampFormatter(locale, timestampFormat, true).format(new Date(isoDate));
}

export function formatShortTimestamp(
  isoDate: string,
  timestampFormat: TimestampFormat,
  locale: ResolvedAppLocale,
): string {
  return getTimestampFormatter(locale, timestampFormat, false).format(new Date(isoDate));
}
