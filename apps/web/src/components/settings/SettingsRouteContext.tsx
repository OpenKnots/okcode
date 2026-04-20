import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";

import { DEFAULT_GIT_TEXT_GENERATION_MODEL } from "@okcode/contracts";

import { DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE, useAppSettings } from "../../appSettings";
import { DEFAULT_COLOR_THEME, useTheme } from "../../hooks/useTheme";
import { readNativeApi, ensureNativeApi } from "../../nativeApi";
import {
  clearFontOverride,
  clearFontSizeOverride,
  clearRadiusOverride,
  clearStoredCustomTheme,
  getStoredFontOverride,
  getStoredFontSizeOverride,
  getStoredRadiusOverride,
  removeCustomTheme,
  setStoredFontOverride,
  setStoredFontSizeOverride,
  setStoredRadiusOverride,
} from "../../lib/customTheme";

type ThemeState = ReturnType<typeof useTheme>;

interface SettingsRouteContextValue {
  theme: ThemeState["theme"];
  setTheme: ThemeState["setTheme"];
  colorTheme: ThemeState["colorTheme"];
  setColorTheme: ThemeState["setColorTheme"];
  fontFamily: ThemeState["fontFamily"];
  setFontFamily: ThemeState["setFontFamily"];
  settingsState: ReturnType<typeof useAppSettings>;
  radiusOverride: number | null;
  setRadiusOverride: (value: number | null) => void;
  fontOverride: string;
  setFontOverride: (value: string) => void;
  fontSizeOverride: number | null;
  setFontSizeOverride: (value: number | null) => void;
  changedSettingLabels: readonly string[];
  restoreDefaults: () => Promise<void>;
}

const SettingsRouteContext = createContext<SettingsRouteContextValue | null>(null);

export function SettingsRouteContextProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, colorTheme, setColorTheme, fontFamily, setFontFamily } = useTheme();
  const settingsState = useAppSettings();
  const { settings, defaults, resetSettings } = settingsState;
  const [radiusOverrideState, setRadiusOverrideState] = useState<number | null>(() =>
    getStoredRadiusOverride(),
  );
  const [fontOverrideState, setFontOverrideState] = useState<string>(
    () => getStoredFontOverride() ?? "",
  );
  const [fontSizeOverrideState, setFontSizeOverrideState] = useState<number | null>(() =>
    getStoredFontSizeOverride(),
  );

  const setRadiusOverride = useCallback((value: number | null) => {
    setRadiusOverrideState(value);
    if (value === null) {
      clearRadiusOverride();
      return;
    }
    setStoredRadiusOverride(value);
  }, []);

  const setFontOverride = useCallback((value: string) => {
    setFontOverrideState(value);
    if (value.trim()) {
      setStoredFontOverride(value);
      return;
    }
    clearFontOverride();
  }, []);

  const setFontSizeOverride = useCallback((value: number | null) => {
    setFontSizeOverrideState(value);
    if (value === null) {
      clearFontSizeOverride();
      return;
    }
    setStoredFontSizeOverride(value);
  }, []);

  const currentGitTextGenerationModel =
    settings.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const defaultGitTextGenerationModel =
    defaults.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const isGitTextGenerationModelDirty =
    currentGitTextGenerationModel !== defaultGitTextGenerationModel;
  const isInstallSettingsDirty =
    settings.claudeBinaryPath !== defaults.claudeBinaryPath ||
    settings.copilotBinaryPath !== defaults.copilotBinaryPath ||
    settings.copilotConfigDir !== defaults.copilotConfigDir ||
    settings.codexBinaryPath !== defaults.codexBinaryPath ||
    settings.codexHomePath !== defaults.codexHomePath;
  const isOpenClawSettingsDirty =
    settings.openclawGatewayUrl !== defaults.openclawGatewayUrl ||
    settings.openclawPassword !== defaults.openclawPassword;

  const changedSettingLabels = useMemo(
    () =>
      [
        ...(theme !== "system" ? ["Theme"] : []),
        ...(colorTheme !== DEFAULT_COLOR_THEME ? ["Color theme"] : []),
        ...(fontFamily !== "inter" ? ["Font"] : []),
        ...(settings.prReviewRequestChangesTone !== DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE
          ? ["PR request changes button"]
          : []),
        ...(settings.timestampFormat !== defaults.timestampFormat ? ["Time format"] : []),
        ...(settings.locale !== defaults.locale ? ["Language"] : []),
        ...(settings.enableAssistantStreaming !== defaults.enableAssistantStreaming
          ? ["Assistant output"]
          : []),
        ...(settings.showReasoningContent !== defaults.showReasoningContent
          ? ["Reasoning content"]
          : []),
        ...(settings.showAuthFailuresAsErrors !== defaults.showAuthFailuresAsErrors
          ? ["Auth failure errors"]
          : []),
        ...(settings.showNotificationDetails !== defaults.showNotificationDetails
          ? ["Notification details"]
          : []),
        ...(settings.includeDiagnosticsTipsInCopy !== defaults.includeDiagnosticsTipsInCopy
          ? ["Diagnostics copy tips"]
          : []),
        ...(settings.openLinksExternally !== defaults.openLinksExternally
          ? ["Open links externally"]
          : []),
        ...(settings.codeViewerAutosave !== defaults.codeViewerAutosave
          ? ["Code preview autosave"]
          : []),
        ...(settings.autoUpdateWorktreeBaseBranch !== defaults.autoUpdateWorktreeBaseBranch
          ? ["Worktree base refresh"]
          : []),
        ...(settings.rebaseBeforeCommit !== defaults.rebaseBeforeCommit
          ? ["Rebase before commit"]
          : []),
        ...(isGitTextGenerationModelDirty ? ["Git writing model"] : []),
        ...(settings.customCodexModels.length > 0 ||
        settings.customClaudeModels.length > 0 ||
        settings.customCopilotModels.length > 0 ||
        settings.customGeminiModels.length > 0 ||
        settings.customOpenClawModels.length > 0
          ? ["Custom models"]
          : []),
        ...(isInstallSettingsDirty ? ["Provider installs"] : []),
        ...(isOpenClawSettingsDirty ? ["OpenClaw gateway"] : []),
        ...(settings.backgroundImageUrl !== defaults.backgroundImageUrl
          ? ["Background image"]
          : []),
        ...(settings.backgroundImageOpacity !== defaults.backgroundImageOpacity
          ? ["Background opacity"]
          : []),
        ...(settings.sidebarOpacity !== defaults.sidebarOpacity ? ["Sidebar opacity"] : []),
        ...(settings.sidebarProjectRowHeight !== defaults.sidebarProjectRowHeight
          ? ["Project height"]
          : []),
        ...(settings.sidebarThreadRowHeight !== defaults.sidebarThreadRowHeight
          ? ["Thread height"]
          : []),
        ...(settings.sidebarFontSize !== defaults.sidebarFontSize ? ["Sidebar font size"] : []),
        ...(settings.sidebarSpacing !== defaults.sidebarSpacing ? ["Sidebar spacing"] : []),
        ...(radiusOverrideState !== null ? ["Border radius"] : []),
        ...(fontOverrideState ? ["Font family"] : []),
        ...(fontSizeOverrideState !== null ? ["Code font size"] : []),
      ] as const,
    [
      colorTheme,
      defaults,
      fontFamily,
      fontOverrideState,
      fontSizeOverrideState,
      isGitTextGenerationModelDirty,
      isInstallSettingsDirty,
      isOpenClawSettingsDirty,
      radiusOverrideState,
      settings,
      theme,
    ],
  );

  const restoreDefaults = useCallback(async () => {
    if (changedSettingLabels.length === 0) return;

    const api = readNativeApi();
    const confirmed = await (api ?? ensureNativeApi()).dialogs.confirm(
      ["Restore default settings?", `This will reset: ${changedSettingLabels.join(", ")}.`].join(
        "\n",
      ),
    );
    if (!confirmed) return;

    setTheme("system");
    setColorTheme(DEFAULT_COLOR_THEME);
    setFontFamily("inter");
    resetSettings();

    clearStoredCustomTheme();
    removeCustomTheme();
    clearRadiusOverride();
    setRadiusOverrideState(null);
    clearFontOverride();
    setFontOverrideState("");
    clearFontSizeOverride();
    setFontSizeOverrideState(null);
  }, [
    changedSettingLabels,
    resetSettings,
    setColorTheme,
    setFontFamily,
    setTheme,
    setFontOverrideState,
    setFontSizeOverrideState,
    setRadiusOverrideState,
  ]);

  const value = useMemo<SettingsRouteContextValue>(
    () => ({
      theme,
      setTheme,
      colorTheme,
      setColorTheme,
      fontFamily,
      setFontFamily,
      settingsState,
      radiusOverride: radiusOverrideState,
      setRadiusOverride,
      fontOverride: fontOverrideState,
      setFontOverride,
      fontSizeOverride: fontSizeOverrideState,
      setFontSizeOverride,
      changedSettingLabels,
      restoreDefaults,
    }),
    [
      changedSettingLabels,
      colorTheme,
      fontFamily,
      fontOverrideState,
      fontSizeOverrideState,
      radiusOverrideState,
      restoreDefaults,
      setColorTheme,
      setFontFamily,
      setFontOverride,
      setFontSizeOverride,
      setRadiusOverride,
      setTheme,
      settingsState,
      theme,
    ],
  );

  return <SettingsRouteContext.Provider value={value}>{children}</SettingsRouteContext.Provider>;
}

export function useSettingsRouteContext() {
  const value = useContext(SettingsRouteContext);
  if (!value) {
    throw new Error("useSettingsRouteContext must be used within SettingsRouteContextProvider.");
  }
  return value;
}
