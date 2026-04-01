import { useCallback } from "react";
import { useIntl, type IntlShape } from "react-intl";
import { useI18nContext } from "./I18nProvider";
import type { TranslationValues } from "./types";

type FormatDateOptions = Parameters<IntlShape["formatDate"]>[1];
type FormatTimeOptions = Parameters<IntlShape["formatTime"]>[1];
type FormatNumberOptions = Parameters<IntlShape["formatNumber"]>[1];

export function useI18n() {
  return useI18nContext();
}

export function useT() {
  const intl = useIntl();
  const context = useI18nContext();

  const t = useCallback(
    (id: string, values?: TranslationValues) => intl.formatMessage({ id }, values as never),
    [intl],
  );
  const formatDate = useCallback(
    (value: Parameters<IntlShape["formatDate"]>[0], options?: FormatDateOptions) =>
      intl.formatDate(value, options),
    [intl],
  );
  const formatTime = useCallback(
    (value: Parameters<IntlShape["formatTime"]>[0], options?: FormatTimeOptions) =>
      intl.formatTime(value, options),
    [intl],
  );
  const formatNumber = useCallback(
    (value: Parameters<IntlShape["formatNumber"]>[0], options?: FormatNumberOptions) =>
      intl.formatNumber(value, options),
    [intl],
  );

  return {
    ...context,
    intl,
    t,
    formatDate,
    formatTime,
    formatNumber,
  } as const;
}
