import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DEFAULT_GIT_TEXT_GENERATION_MODEL } from "@okcode/contracts";

import { DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE, useAppSettings } from "../../appSettings";
import {
  DEFAULT_CODE_FONT,
  DEFAULT_COLOR_THEME,
  DEFAULT_MESSAGE_FONT,
  useTheme,
} from "../../hooks/useTheme";
import { readNativeApi, ensureNativeApi } from "../../nativeApi";
import {
  ZOOM_CHANGE_EVENT,
  ZOOM_DEFAULT,
  clearFontOverride,
  clearFontSizeOverride,
  clearRadiusOverride,
  clearStoredCustomTheme,
  clearZoom,
  getStoredFontOverride,
  getStoredFontSizeOverride,
  getStoredRadiusOverride,
  getStoredZoom,
  removeCustomTheme,
  setStoredFontOverride,
  setStoredFontSizeOverride,
  setStoredRadiusOverride,
  setStoredZoom,
} from "../../lib/customTheme";

type ThemeState = ReturnType<typeof useTheme>;

interface SettingsRouteContextValue {
  theme: ThemeState["theme"];
  setTheme: ThemeState["setTheme"];
  colorTheme: ThemeState["colorTheme"];
  setColorTheme: ThemeState["setColorTheme"];
  messageFont: ThemeState["messageFont"];
  setMessageFont: ThemeState["setMessageFont"];
  codeFont: ThemeState["codeFont"];
  setCodeFont: ThemeState["setCodeFont"];
  settingsState: ReturnType<typeof useAppSettings>;
  radiusOverride: number | null;
  setRadiusOverride: (value: number | null) => void;
  fontOverride: string;
  setFontOverride: (value: string) => void;
  fontSizeOverride: number | null;
  setFontSizeOverride: (value: number | null) => void;
  zoom: number;
  setZoom: (value: number) => void;
  changedSettingLabels: readonly string[];
  restoreDefaults: () => Promise<void>;
}

const SettingsRouteContext = createContext<SettingsRouteContextValue | null>(null);

export function SettingsRouteContextProvider({ children }: { children: ReactNode }) {
  const {
    theme,
    setTheme,
    colorTheme,
    setColorTheme,
    messageFont,
    setMessageFont,
    codeFont,
    setCodeFont,
  } = useTheme();
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
  const [zoomState, setZoomState] = useState<number>(() => getStoredZoom());

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

  // Keep local React state in sync with storage. `setStoredZoom` also
  // clamps — we read back via `getStoredZoom` so the slider shows the clamped
  // value rather than the raw input when the user drags past the bounds.
  const setZoom = useCallback((value: number) => {
    setStoredZoom(value);
    setZoomState(getStoredZoom());
  }, []);

  // The keybinding handler in `ChatRouteGlobalShortcuts` writes zoom directly
  // to storage via `setStoredZoom`. Listen for the in-window `zoom-change`
  // event so the slider reflects keyboard-driven changes live; also listen to
  // `storage` for multi-window consistency.
  useEffect(() => {
    const refresh = () => setZoomState(getStoredZoom());
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "okcode:app-zoom") return;
      refresh();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(ZOOM_CHANGE_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(ZOOM_CHANGE_EVENT, refresh as EventListener);
    };
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
        ...(messageFont !== DEFAULT_MESSAGE_FONT ? ["Message font"] : []),
        ...(codeFont !== DEFAULT_CODE_FONT ? ["Code font"] : []),
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
        ...(settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode
          ? ["New thread mode"]
          : []),
        ...(settings.autoUpdateWorktreeBaseBranch !== defaults.autoUpdateWorktreeBaseBranch
          ? ["Worktree base refresh"]
          : []),
        ...(settings.confirmThreadDelete !== defaults.confirmThreadDelete
          ? ["Delete confirmation"]
          : []),
        ...(settings.autoDeleteMergedThreads !== defaults.autoDeleteMergedThreads
          ? ["Auto-delete merged threads"]
          : []),
        ...(settings.autoDeleteMergedThreadsDelayMinutes !==
        defaults.autoDeleteMergedThreadsDelayMinutes
          ? ["Auto-delete delay"]
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
        ...(zoomState !== ZOOM_DEFAULT ? ["App zoom"] : []),
      ] as const,
    [
      codeFont,
      colorTheme,
      defaults,
      fontOverrideState,
      fontSizeOverrideState,
      isGitTextGenerationModelDirty,
      isInstallSettingsDirty,
      isOpenClawSettingsDirty,
      messageFont,
      radiusOverrideState,
      settings,
      theme,
      zoomState,
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
    setMessageFont(DEFAULT_MESSAGE_FONT);
    setCodeFont(DEFAULT_CODE_FONT);
    resetSettings();

    clearStoredCustomTheme();
    removeCustomTheme();
    clearRadiusOverride();
    setRadiusOverrideState(null);
    clearFontOverride();
    setFontOverrideState("");
    clearFontSizeOverride();
    setFontSizeOverrideState(null);
    clearZoom();
    setZoomState(ZOOM_DEFAULT);
  }, [
    changedSettingLabels,
    resetSettings,
    setCodeFont,
    setColorTheme,
    setMessageFont,
    setTheme,
    setFontOverrideState,
    setFontSizeOverrideState,
    setRadiusOverrideState,
    setZoomState,
  ]);

  const value = useMemo<SettingsRouteContextValue>(
    () => ({
      theme,
      setTheme,
      colorTheme,
      setColorTheme,
      messageFont,
      setMessageFont,
      codeFont,
      setCodeFont,
      settingsState,
      radiusOverride: radiusOverrideState,
      setRadiusOverride,
      fontOverride: fontOverrideState,
      setFontOverride,
      fontSizeOverride: fontSizeOverrideState,
      setFontSizeOverride,
      zoom: zoomState,
      setZoom,
      changedSettingLabels,
      restoreDefaults,
    }),
    [
      changedSettingLabels,
      codeFont,
      colorTheme,
      fontOverrideState,
      fontSizeOverrideState,
      messageFont,
      radiusOverrideState,
      restoreDefaults,
      setCodeFont,
      setColorTheme,
      setFontOverride,
      setFontSizeOverride,
      setMessageFont,
      setRadiusOverride,
      setTheme,
      setZoom,
      settingsState,
      theme,
      zoomState,
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
