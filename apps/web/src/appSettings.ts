import { useCallback, useEffect } from "react";
import { Option, Schema } from "effect";
import {
  TrimmedNonEmptyString,
  type ProviderKind,
  type ProviderStartOptions,
} from "@okcode/contracts";
import {
  getDefaultModel,
  getModelOptions,
  normalizeModelSlug,
  resolveSelectableModel,
} from "@okcode/shared/model";
import { validateHttpPreviewUrl } from "@okcode/shared/preview";
import { APP_LOCALE_PREFERENCES } from "./i18n/types";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { EnvMode } from "./components/BranchToolbar.logic";

const APP_SETTINGS_STORAGE_KEY = "okcode:app-settings:v1";
const MAX_CUSTOM_MODEL_COUNT = 32;
export const MAX_CUSTOM_MODEL_LENGTH = 256;
const BACKGROUND_IMAGE_KEY = "okcode:background-image";
const BACKGROUND_OPACITY_KEY = "okcode:background-opacity";
export const SIDEBAR_PROJECT_ROW_HEIGHT_MIN = 24;
export const SIDEBAR_PROJECT_ROW_HEIGHT_MAX = 44;
export const DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT = 28;
export const SIDEBAR_THREAD_ROW_HEIGHT_MIN = 24;
export const SIDEBAR_THREAD_ROW_HEIGHT_MAX = 44;
export const DEFAULT_SIDEBAR_THREAD_ROW_HEIGHT = 28;
export const SIDEBAR_FONT_SIZE_MIN = 10;
export const SIDEBAR_FONT_SIZE_MAX = 16;
export const DEFAULT_SIDEBAR_FONT_SIZE = 12;
export const SIDEBAR_SPACING_MIN = 4;
export const SIDEBAR_SPACING_MAX = 12;
export const DEFAULT_SIDEBAR_SPACING = 8;
export const DEFAULT_BROWSER_PREVIEW_START_PAGE_URL = "https://www.google.com/";

export const TimestampFormat = Schema.Literals(["locale", "12-hour", "24-hour"]);
export type TimestampFormat = typeof TimestampFormat.Type;
export const DEFAULT_TIMESTAMP_FORMAT: TimestampFormat = "locale";
export const AppLocale = Schema.Literals(APP_LOCALE_PREFERENCES);
export type AppLocale = typeof AppLocale.Type;
export const DEFAULT_APP_LOCALE: AppLocale = "system";
export const SidebarProjectSortOrder = Schema.Literals(["updated_at", "created_at", "manual"]);
export type SidebarProjectSortOrder = typeof SidebarProjectSortOrder.Type;
export const DEFAULT_SIDEBAR_PROJECT_SORT_ORDER: SidebarProjectSortOrder = "updated_at";
export const SidebarThreadSortOrder = Schema.Literals(["updated_at", "created_at"]);
export type SidebarThreadSortOrder = typeof SidebarThreadSortOrder.Type;
export const DEFAULT_SIDEBAR_THREAD_SORT_ORDER: SidebarThreadSortOrder = "updated_at";
export const PrReviewRequestChangesTone = Schema.Literals(["warning", "brand", "neutral"]);
export type PrReviewRequestChangesTone = typeof PrReviewRequestChangesTone.Type;
export const DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE: PrReviewRequestChangesTone = "warning";
type CustomModelSettingsKey =
  | "customCodexModels"
  | "customClaudeModels"
  | "customOpenClawModels"
  | "customCopilotModels";
export type ProviderCustomModelConfig = {
  provider: ProviderKind;
  settingsKey: CustomModelSettingsKey;
  defaultSettingsKey: CustomModelSettingsKey;
  title: string;
  description: string;
  placeholder: string;
  example: string;
};

const BUILT_IN_MODEL_SLUGS_BY_PROVIDER: Record<ProviderKind, ReadonlySet<string>> = {
  codex: new Set(getModelOptions("codex").map((option) => option.slug)),
  claudeAgent: new Set(getModelOptions("claudeAgent").map((option) => option.slug)),
  openclaw: new Set(getModelOptions("openclaw").map((option) => option.slug)),
  copilot: new Set(getModelOptions("copilot").map((option) => option.slug)),
};

const withDefaults =
  <
    S extends Schema.Top & Schema.WithoutConstructorDefault,
    D extends S["~type.make.in"] & S["Encoded"],
  >(
    fallback: () => D,
  ) =>
  (schema: S) =>
    schema.pipe(
      Schema.withConstructorDefault(() => Option.some(fallback())),
      Schema.withDecodingDefault(() => fallback()),
    );

export const AppSettingsSchema = Schema.Struct({
  claudeBinaryPath: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  copilotBinaryPath: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  copilotConfigDir: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  claudeAuthTokenHelperCommand: Schema.String.check(Schema.isMaxLength(4096)).pipe(
    withDefaults(() => ""),
  ),
  codexBinaryPath: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  codexHomePath: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  backgroundImageUrl: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  backgroundImageOpacity: Schema.Number.pipe(withDefaults(() => 0.15)),
  defaultThreadEnvMode: EnvMode.pipe(withDefaults(() => "worktree" as const satisfies EnvMode)),
  autoUpdateWorktreeBaseBranch: Schema.Boolean.pipe(withDefaults(() => false)),
  confirmThreadDelete: Schema.Boolean.pipe(withDefaults(() => true)),
  autoDeleteMergedThreads: Schema.Boolean.pipe(withDefaults(() => false)),
  autoDeleteMergedThreadsDelayMinutes: Schema.Number.pipe(withDefaults(() => 5)),
  rebaseBeforeCommit: Schema.Boolean.pipe(withDefaults(() => false)),
  enableAssistantStreaming: Schema.Boolean.pipe(withDefaults(() => false)),
  showAuthFailuresAsErrors: Schema.Boolean.pipe(withDefaults(() => true)),
  showNotificationDetails: Schema.Boolean.pipe(withDefaults(() => false)),
  includeDiagnosticsTipsInCopy: Schema.Boolean.pipe(withDefaults(() => false)),
  locale: AppLocale.pipe(withDefaults(() => DEFAULT_APP_LOCALE)),
  openLinksExternally: Schema.Boolean.pipe(withDefaults(() => false)),
  browserPreviewStartPageUrl: Schema.String.check(Schema.isMaxLength(4096)).pipe(
    withDefaults(() => ""),
  ),
  sidebarProjectSortOrder: SidebarProjectSortOrder.pipe(
    withDefaults(() => DEFAULT_SIDEBAR_PROJECT_SORT_ORDER),
  ),
  sidebarThreadSortOrder: SidebarThreadSortOrder.pipe(
    withDefaults(() => DEFAULT_SIDEBAR_THREAD_SORT_ORDER),
  ),
  timestampFormat: TimestampFormat.pipe(withDefaults(() => DEFAULT_TIMESTAMP_FORMAT)),
  sidebarOpacity: Schema.Number.pipe(withDefaults(() => 1)),
  sidebarProjectRowHeight: Schema.Number.pipe(
    withDefaults(() => DEFAULT_SIDEBAR_PROJECT_ROW_HEIGHT),
  ),
  sidebarThreadRowHeight: Schema.Number.pipe(withDefaults(() => DEFAULT_SIDEBAR_THREAD_ROW_HEIGHT)),
  sidebarFontSize: Schema.Number.pipe(withDefaults(() => DEFAULT_SIDEBAR_FONT_SIZE)),
  sidebarSpacing: Schema.Number.pipe(withDefaults(() => DEFAULT_SIDEBAR_SPACING)),
  sidebarHideFiles: Schema.Boolean.pipe(withDefaults(() => false)),
  sidebarAccentProjectNames: Schema.Boolean.pipe(withDefaults(() => true)),
  sidebarAccentColorOverride: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  sidebarAccentBgColorOverride: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
  prReviewRequestChangesTone: PrReviewRequestChangesTone.pipe(
    withDefaults(() => DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE),
  ),
  showReasoningContent: Schema.Boolean.pipe(withDefaults(() => false)),
  showStitchBorder: Schema.Boolean.pipe(withDefaults(() => true)),
  codeViewerAutosave: Schema.Boolean.pipe(withDefaults(() => false)),
  customCodexModels: Schema.Array(Schema.String).pipe(withDefaults(() => [])),
  customClaudeModels: Schema.Array(Schema.String).pipe(withDefaults(() => [])),
  customCopilotModels: Schema.Array(Schema.String).pipe(withDefaults(() => [])),
  customOpenClawModels: Schema.Array(Schema.String).pipe(withDefaults(() => [])),
  openclawGatewayUrl: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  openclawPassword: Schema.String.check(Schema.isMaxLength(4096)).pipe(withDefaults(() => "")),
  textGenerationModel: Schema.optional(TrimmedNonEmptyString),
});
export type AppSettings = typeof AppSettingsSchema.Type;
export interface AppModelOption {
  slug: string;
  name: string;
  isCustom: boolean;
}

const DEFAULT_APP_SETTINGS = AppSettingsSchema.makeUnsafe({});
const PROVIDER_CUSTOM_MODEL_CONFIG: Record<ProviderKind, ProviderCustomModelConfig> = {
  codex: {
    provider: "codex",
    settingsKey: "customCodexModels",
    defaultSettingsKey: "customCodexModels",
    title: "Codex",
    description: "Save additional Codex model slugs for the picker and `/model` command.",
    placeholder: "your-codex-model-slug",
    example: "gpt-6.7-codex-ultra-preview",
  },
  claudeAgent: {
    provider: "claudeAgent",
    settingsKey: "customClaudeModels",
    defaultSettingsKey: "customClaudeModels",
    title: "Claude Code",
    description: "Save additional Claude model slugs for the picker and `/model` command.",
    placeholder: "your-claude-model-slug",
    example: "claude-sonnet-5-0",
  },
  copilot: {
    provider: "copilot",
    settingsKey: "customCopilotModels",
    defaultSettingsKey: "customCopilotModels",
    title: "GitHub Copilot",
    description: "Save additional GitHub Copilot model slugs for the picker and `/model` command.",
    placeholder: "your-copilot-model-slug",
    example: "gpt-5",
  },
  openclaw: {
    provider: "openclaw",
    settingsKey: "customOpenClawModels",
    defaultSettingsKey: "customOpenClawModels",
    title: "OpenClaw",
    description: "Save additional OpenClaw model slugs for the picker and `/model` command.",
    placeholder: "your-openclaw-model-slug",
    example: "openclaw/my-custom-model",
  },
};
export const MODEL_PROVIDER_SETTINGS = Object.values(PROVIDER_CUSTOM_MODEL_CONFIG);

export function normalizeCustomModelSlugs(
  models: Iterable<string | null | undefined>,
  provider: ProviderKind = "codex",
): string[] {
  const normalizedModels: string[] = [];
  const seen = new Set<string>();
  const builtInModelSlugs = BUILT_IN_MODEL_SLUGS_BY_PROVIDER[provider];

  for (const candidate of models) {
    const normalized = normalizeModelSlug(candidate, provider);
    if (
      !normalized ||
      normalized.length > MAX_CUSTOM_MODEL_LENGTH ||
      builtInModelSlugs.has(normalized) ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    normalizedModels.push(normalized);
    if (normalizedModels.length >= MAX_CUSTOM_MODEL_COUNT) {
      break;
    }
  }

  return normalizedModels;
}

function clampOpacity(value: number): number {
  return Math.max(0.3, Math.min(1, value));
}

function clampBackgroundOpacity(value: number): number {
  return Math.max(0.05, Math.min(1, value));
}

function clampSidebarProjectRowHeight(value: number): number {
  return Math.round(
    Math.max(SIDEBAR_PROJECT_ROW_HEIGHT_MIN, Math.min(SIDEBAR_PROJECT_ROW_HEIGHT_MAX, value)),
  );
}

function clampSidebarThreadRowHeight(value: number): number {
  return Math.round(
    Math.max(SIDEBAR_THREAD_ROW_HEIGHT_MIN, Math.min(SIDEBAR_THREAD_ROW_HEIGHT_MAX, value)),
  );
}

function clampSidebarFontSize(value: number): number {
  return Math.round(Math.max(SIDEBAR_FONT_SIZE_MIN, Math.min(SIDEBAR_FONT_SIZE_MAX, value)));
}

function clampSidebarSpacing(value: number): number {
  return Math.round(Math.max(SIDEBAR_SPACING_MIN, Math.min(SIDEBAR_SPACING_MAX, value)));
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    backgroundImageUrl: settings.backgroundImageUrl.trim(),
    browserPreviewStartPageUrl: settings.browserPreviewStartPageUrl.trim(),
    claudeAuthTokenHelperCommand: settings.claudeAuthTokenHelperCommand.trim(),
    backgroundImageOpacity: clampBackgroundOpacity(settings.backgroundImageOpacity),
    sidebarOpacity: clampOpacity(settings.sidebarOpacity),
    sidebarProjectRowHeight: clampSidebarProjectRowHeight(settings.sidebarProjectRowHeight),
    sidebarThreadRowHeight: clampSidebarThreadRowHeight(settings.sidebarThreadRowHeight),
    sidebarFontSize: clampSidebarFontSize(settings.sidebarFontSize),
    sidebarSpacing: clampSidebarSpacing(settings.sidebarSpacing),
    customCodexModels: normalizeCustomModelSlugs(settings.customCodexModels, "codex"),
    customClaudeModels: normalizeCustomModelSlugs(settings.customClaudeModels, "claudeAgent"),
    customCopilotModels: normalizeCustomModelSlugs(settings.customCopilotModels, "copilot"),
    customOpenClawModels: normalizeCustomModelSlugs(settings.customOpenClawModels, "openclaw"),
  };
}

export function getCustomModelsForProvider(
  settings: Pick<AppSettings, CustomModelSettingsKey>,
  provider: ProviderKind,
): readonly string[] {
  return settings[PROVIDER_CUSTOM_MODEL_CONFIG[provider].settingsKey];
}

export function getDefaultCustomModelsForProvider(
  defaults: Pick<AppSettings, CustomModelSettingsKey>,
  provider: ProviderKind,
): readonly string[] {
  return defaults[PROVIDER_CUSTOM_MODEL_CONFIG[provider].defaultSettingsKey];
}

export function patchCustomModels(
  provider: ProviderKind,
  models: string[],
): Partial<Pick<AppSettings, CustomModelSettingsKey>> {
  return {
    [PROVIDER_CUSTOM_MODEL_CONFIG[provider].settingsKey]: models,
  };
}

export function getCustomModelsByProvider(
  settings: Pick<AppSettings, CustomModelSettingsKey>,
): Record<ProviderKind, readonly string[]> {
  return {
    codex: getCustomModelsForProvider(settings, "codex"),
    claudeAgent: getCustomModelsForProvider(settings, "claudeAgent"),
    copilot: getCustomModelsForProvider(settings, "copilot"),
    openclaw: getCustomModelsForProvider(settings, "openclaw"),
  };
}

export function getAppModelOptions(
  provider: ProviderKind,
  customModels: readonly string[],
  selectedModel?: string | null,
): AppModelOption[] {
  const options: AppModelOption[] = getModelOptions(provider).map(({ slug, name }) => ({
    slug,
    name,
    isCustom: false,
  }));
  const seen = new Set(options.map((option) => option.slug));
  const trimmedSelectedModel = selectedModel?.trim().toLowerCase();

  for (const slug of normalizeCustomModelSlugs(customModels, provider)) {
    if (seen.has(slug)) {
      continue;
    }

    seen.add(slug);
    options.push({
      slug,
      name: slug,
      isCustom: true,
    });
  }

  const normalizedSelectedModel = normalizeModelSlug(selectedModel, provider);
  const selectedModelMatchesExistingName =
    typeof trimmedSelectedModel === "string" &&
    options.some((option) => option.name.toLowerCase() === trimmedSelectedModel);
  if (
    normalizedSelectedModel &&
    !seen.has(normalizedSelectedModel) &&
    !selectedModelMatchesExistingName
  ) {
    options.push({
      slug: normalizedSelectedModel,
      name: normalizedSelectedModel,
      isCustom: true,
    });
  }

  return options;
}

export function resolveAppModelSelection(
  provider: ProviderKind,
  customModels: Record<ProviderKind, readonly string[]>,
  selectedModel: string | null | undefined,
): string {
  const customModelsForProvider = customModels[provider];
  const options = getAppModelOptions(provider, customModelsForProvider, selectedModel);
  return resolveSelectableModel(provider, selectedModel, options) ?? getDefaultModel(provider);
}

export function getCustomModelOptionsByProvider(
  settings: Pick<AppSettings, CustomModelSettingsKey>,
): Record<ProviderKind, ReadonlyArray<{ slug: string; name: string }>> {
  const customModelsByProvider = getCustomModelsByProvider(settings);
  return {
    codex: getAppModelOptions("codex", customModelsByProvider.codex),
    claudeAgent: getAppModelOptions("claudeAgent", customModelsByProvider.claudeAgent),
    copilot: getAppModelOptions("copilot", customModelsByProvider.copilot),
    openclaw: getAppModelOptions("openclaw", customModelsByProvider.openclaw),
  };
}

export function getProviderStartOptions(
  settings: Pick<
    AppSettings,
    | "claudeBinaryPath"
    | "copilotBinaryPath"
    | "copilotConfigDir"
    | "claudeAuthTokenHelperCommand"
    | "codexBinaryPath"
    | "codexHomePath"
    | "openclawGatewayUrl"
    | "openclawPassword"
  >,
): ProviderStartOptions | undefined {
  const providerOptions: ProviderStartOptions = {
    ...(settings.codexBinaryPath || settings.codexHomePath
      ? {
          codex: {
            ...(settings.codexBinaryPath ? { binaryPath: settings.codexBinaryPath } : {}),
            ...(settings.codexHomePath ? { homePath: settings.codexHomePath } : {}),
          },
        }
      : {}),
    ...(settings.claudeBinaryPath || settings.claudeAuthTokenHelperCommand
      ? {
          claudeAgent: {
            ...(settings.claudeBinaryPath ? { binaryPath: settings.claudeBinaryPath } : {}),
            ...(settings.claudeAuthTokenHelperCommand
              ? { authTokenHelperCommand: settings.claudeAuthTokenHelperCommand }
              : {}),
          },
        }
      : {}),
    ...(settings.copilotBinaryPath || settings.copilotConfigDir
      ? {
          copilot: {
            ...(settings.copilotBinaryPath ? { binaryPath: settings.copilotBinaryPath } : {}),
            ...(settings.copilotConfigDir ? { configDir: settings.copilotConfigDir } : {}),
          },
        }
      : {}),
    ...(settings.openclawGatewayUrl || settings.openclawPassword
      ? {
          openclaw: {
            ...(settings.openclawGatewayUrl ? { gatewayUrl: settings.openclawGatewayUrl } : {}),
            ...(settings.openclawPassword ? { password: settings.openclawPassword } : {}),
          },
        }
      : {}),
  };

  return Object.keys(providerOptions).length > 0 ? providerOptions : undefined;
}

export function resolveBrowserPreviewStartPageUrl(rawUrl: string | null | undefined): string {
  const trimmedUrl = rawUrl?.trim() ?? "";
  if (trimmedUrl.length === 0) {
    return DEFAULT_BROWSER_PREVIEW_START_PAGE_URL;
  }

  const validatedUrl = validateHttpPreviewUrl(trimmedUrl);
  return validatedUrl.ok ? validatedUrl.url : DEFAULT_BROWSER_PREVIEW_START_PAGE_URL;
}

export function useAppSettings() {
  const [settings, setSettings] = useLocalStorage(
    APP_SETTINGS_STORAGE_KEY,
    DEFAULT_APP_SETTINGS,
    AppSettingsSchema,
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => normalizeAppSettings({ ...prev, ...patch }));
    },
    [setSettings],
  );

  useEffect(() => {
    if (typeof window === "undefined" || settings.backgroundImageUrl.trim().length > 0) {
      return;
    }

    const legacyBackgroundImageUrl =
      window.localStorage.getItem(BACKGROUND_IMAGE_KEY)?.trim() ?? "";
    if (legacyBackgroundImageUrl.length === 0) {
      return;
    }

    const legacyBackgroundOpacityRaw = window.localStorage.getItem(BACKGROUND_OPACITY_KEY);
    const legacyBackgroundOpacity =
      legacyBackgroundOpacityRaw === null ? null : Number.parseFloat(legacyBackgroundOpacityRaw);

    setSettings((prev) =>
      normalizeAppSettings({
        ...prev,
        backgroundImageUrl: legacyBackgroundImageUrl,
        backgroundImageOpacity:
          typeof legacyBackgroundOpacity === "number" && Number.isFinite(legacyBackgroundOpacity)
            ? legacyBackgroundOpacity
            : prev.backgroundImageOpacity,
      }),
    );
    window.localStorage.removeItem(BACKGROUND_IMAGE_KEY);
    window.localStorage.removeItem(BACKGROUND_OPACITY_KEY);
  }, [setSettings, settings.backgroundImageUrl]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
  }, [setSettings]);

  return {
    settings,
    updateSettings,
    resetSettings,
    defaults: DEFAULT_APP_SETTINGS,
  } as const;
}
