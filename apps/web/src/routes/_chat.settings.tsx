import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ImportIcon,
  PlusIcon,
  RotateCcwIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  type ProjectId,
  type ProviderKind,
  DEFAULT_GIT_TEXT_GENERATION_MODEL,
} from "@okcode/contracts";
import { getModelOptions, normalizeModelSlug } from "@okcode/shared/model";
import {
  getAppModelOptions,
  getCustomModelsForProvider,
  MAX_CUSTOM_MODEL_LENGTH,
  MODEL_PROVIDER_SETTINGS,
  patchCustomModels,
  useAppSettings,
} from "../appSettings";
import { APP_VERSION } from "../branding";
import { Button } from "../components/ui/button";
import { Collapsible, CollapsibleContent } from "../components/ui/collapsible";
import { EnvironmentVariablesEditor } from "../components/EnvironmentVariablesEditor";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Switch } from "../components/ui/switch";
import { SidebarInset } from "../components/ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { resolveAndPersistPreferredEditor } from "../editorPreferences";
import { isElectron } from "../env";
import { useTheme, COLOR_THEMES, FONT_FAMILIES } from "../hooks/useTheme";
import {
  environmentVariablesQueryKeys,
  globalEnvironmentVariablesQueryOptions,
  projectEnvironmentVariablesQueryOptions,
} from "../lib/environmentVariablesReactQuery";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { ensureNativeApi, readNativeApi } from "../nativeApi";
import { useStore } from "../store";

const THEME_OPTIONS = [
  {
    value: "system",
    label: "System",
    description: "Match your OS appearance setting.",
  },
  {
    value: "light",
    label: "Light",
    description: "Always use the light theme.",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use the dark theme.",
  },
] as const;

const TIMESTAMP_FORMAT_LABELS = {
  locale: "System default",
  "12-hour": "12-hour",
  "24-hour": "24-hour",
} as const;

type InstallBinarySettingsKey = "claudeBinaryPath" | "codexBinaryPath";
type InstallProviderSettings = {
  provider: ProviderKind;
  title: string;
  binaryPathKey: InstallBinarySettingsKey;
  binaryPlaceholder: string;
  binaryDescription: ReactNode;
  homePathKey?: "codexHomePath";
  homePlaceholder?: string;
  homeDescription?: ReactNode;
};

const INSTALL_PROVIDER_SETTINGS: readonly InstallProviderSettings[] = [
  {
    provider: "codex",
    title: "Codex",
    binaryPathKey: "codexBinaryPath",
    binaryPlaceholder: "Codex binary path",
    binaryDescription: (
      <>
        Leave blank to use <code>codex</code> from your PATH. Authentication normally uses{" "}
        <code>codex login</code> unless your Codex config points at a custom model provider.
      </>
    ),
    homePathKey: "codexHomePath",
    homePlaceholder: "CODEX_HOME",
    homeDescription: "Optional custom Codex home and config directory.",
  },
  {
    provider: "claudeAgent",
    title: "Anthropic",
    binaryPathKey: "claudeBinaryPath",
    binaryPlaceholder: "Claude binary path",
    binaryDescription: (
      <>
        Leave blank to use <code>claude</code> from your PATH. Authentication uses{" "}
        <code>claude auth login</code>.
      </>
    ),
  },
];

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="relative overflow-hidden rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  children,
  onClick,
}: {
  title: string;
  description: string;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5"
      data-slot="settings-row"
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          onClick && "cursor-pointer",
        )}
        onClick={onClick}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {resetAction}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {status ? <div className="pt-1 text-[11px] text-muted-foreground">{status}</div> : null}
        </div>
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function SettingResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label} to default`}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Undo2Icon className="size-3" />
          </Button>
        }
      />
      <TooltipPopup side="top">Reset to default</TooltipPopup>
    </Tooltip>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }
  return "Unknown error";
}

function SettingsRouteView() {
  const { theme, setTheme, colorTheme, setColorTheme, fontFamily, setFontFamily } = useTheme();
  const { settings, defaults, updateSettings, resetSettings } = useAppSettings();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const queryClient = useQueryClient();
  const projects = useStore((state) => state.projects);
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(
    () => projects[0]?.id ?? null,
  );
  const [isOpeningKeybindings, setIsOpeningKeybindings] = useState(false);
  const [openKeybindingsError, setOpenKeybindingsError] = useState<string | null>(null);
  const [openInstallProviders, setOpenInstallProviders] = useState<Record<ProviderKind, boolean>>({
    codex: Boolean(settings.codexBinaryPath || settings.codexHomePath),
    claudeAgent: Boolean(settings.claudeBinaryPath),
  });
  const [selectedCustomModelProvider, setSelectedCustomModelProvider] =
    useState<ProviderKind>("codex");
  const [customModelInputByProvider, setCustomModelInputByProvider] = useState<
    Record<ProviderKind, string>
  >({
    codex: "",
    claudeAgent: "",
  });
  const [customModelErrorByProvider, setCustomModelErrorByProvider] = useState<
    Partial<Record<ProviderKind, string | null>>
  >({});
  const [showAllCustomModels, setShowAllCustomModels] = useState(false);
  const [customThemeDialogOpen, setCustomThemeDialogOpen] = useState(false);
  const [radiusOverride, setRadiusOverrideState] = useState<number | null>(() =>
    getStoredRadiusOverride(),
  );
  const [fontOverride, setFontOverrideState] = useState<string>(
    () => getStoredFontOverride() ?? "",
  );
  const globalEnvironmentVariablesQuery = useQuery(globalEnvironmentVariablesQueryOptions());
  const activeProjectId = selectedProjectId ?? projects[0]?.id ?? null;
  const selectedProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const selectedProjectEnvironmentVariablesQuery = useQuery(
    projectEnvironmentVariablesQueryOptions(activeProjectId),
  );

  useEffect(() => {
    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        setSelectedProjectId(null);
      }
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id ?? null);
    }
  }, [projects, selectedProjectId]);

  const codexBinaryPath = settings.codexBinaryPath;
  const codexHomePath = settings.codexHomePath;
  const claudeBinaryPath = settings.claudeBinaryPath;
  const keybindingsConfigPath = serverConfigQuery.data?.keybindingsConfigPath ?? null;
  const availableEditors = serverConfigQuery.data?.availableEditors;

  const gitTextGenerationModelOptions = getAppModelOptions(
    "codex",
    settings.customCodexModels,
    settings.textGenerationModel,
  );
  const currentGitTextGenerationModel =
    settings.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const defaultGitTextGenerationModel =
    defaults.textGenerationModel ?? DEFAULT_GIT_TEXT_GENERATION_MODEL;
  const isGitTextGenerationModelDirty =
    currentGitTextGenerationModel !== defaultGitTextGenerationModel;
  const selectedGitTextGenerationModelLabel =
    gitTextGenerationModelOptions.find((option) => option.slug === currentGitTextGenerationModel)
      ?.name ?? currentGitTextGenerationModel;
  const selectedCustomModelProviderSettings = MODEL_PROVIDER_SETTINGS.find(
    (providerSettings) => providerSettings.provider === selectedCustomModelProvider,
  )!;
  const selectedCustomModelInput = customModelInputByProvider[selectedCustomModelProvider];
  const selectedCustomModelError = customModelErrorByProvider[selectedCustomModelProvider] ?? null;
  const totalCustomModels = settings.customCodexModels.length + settings.customClaudeModels.length;
  const activeProjectEnvironmentVariables = selectedProjectEnvironmentVariablesQuery.data?.entries;
  const savedCustomModelRows = MODEL_PROVIDER_SETTINGS.flatMap((providerSettings) =>
    getCustomModelsForProvider(settings, providerSettings.provider).map((slug) => ({
      key: `${providerSettings.provider}:${slug}`,
      provider: providerSettings.provider,
      providerTitle: providerSettings.title,
      slug,
    })),
  );
  const visibleCustomModelRows = showAllCustomModels
    ? savedCustomModelRows
    : savedCustomModelRows.slice(0, 5);
  const isInstallSettingsDirty =
    settings.claudeBinaryPath !== defaults.claudeBinaryPath ||
    settings.codexBinaryPath !== defaults.codexBinaryPath ||
    settings.codexHomePath !== defaults.codexHomePath;
  const changedSettingLabels = [
    ...(theme !== "system" ? ["Theme"] : []),
    ...(colorTheme !== "default" ? ["Color theme"] : []),
    ...(fontFamily !== "inter" ? ["Font"] : []),
    ...(settings.timestampFormat !== defaults.timestampFormat ? ["Time format"] : []),
    ...(settings.diffWordWrap !== defaults.diffWordWrap ? ["Diff line wrapping"] : []),
    ...(settings.enableAssistantStreaming !== defaults.enableAssistantStreaming
      ? ["Assistant output"]
      : []),
    ...(settings.openLinksExternally !== defaults.openLinksExternally
      ? ["Open links externally"]
      : []),
    ...(settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode ? ["New thread mode"] : []),
    ...(settings.confirmThreadDelete !== defaults.confirmThreadDelete
      ? ["Delete confirmation"]
      : []),
    ...(isGitTextGenerationModelDirty ? ["Git writing model"] : []),
    ...(settings.customCodexModels.length > 0 || settings.customClaudeModels.length > 0
      ? ["Custom models"]
      : []),
    ...(isInstallSettingsDirty ? ["Provider installs"] : []),
    ...(radiusOverride !== null ? ["Border radius"] : []),
    ...(fontOverride ? ["Font family"] : []),
  ];

  const openKeybindingsFile = useCallback(() => {
    if (!keybindingsConfigPath) return;
    setOpenKeybindingsError(null);
    setIsOpeningKeybindings(true);
    const api = ensureNativeApi();
    const editor = resolveAndPersistPreferredEditor(availableEditors ?? []);
    if (!editor) {
      setOpenKeybindingsError("No available editors found.");
      setIsOpeningKeybindings(false);
      return;
    }
    void api.shell
      .openInEditor(keybindingsConfigPath, editor)
      .catch((error) => {
        setOpenKeybindingsError(
          error instanceof Error ? error.message : "Unable to open keybindings file.",
        );
      })
      .finally(() => {
        setIsOpeningKeybindings(false);
      });
  }, [availableEditors, keybindingsConfigPath]);

  const saveGlobalEnvironmentVariables = useCallback(
    async (entries: ReadonlyArray<{ key: string; value: string }>) => {
      const api = ensureNativeApi();
      const result = await api.server.saveGlobalEnvironmentVariables({ entries });
      queryClient.setQueryData(environmentVariablesQueryKeys.global(), result);
      return result.entries;
    },
    [queryClient],
  );

  const saveProjectEnvironmentVariables = useCallback(
    async (entries: ReadonlyArray<{ key: string; value: string }>) => {
      if (!selectedProject) {
        throw new Error("Select a project before saving project variables.");
      }
      const api = ensureNativeApi();
      const result = await api.server.saveProjectEnvironmentVariables({
        projectId: selectedProject.id,
        entries,
      });
      queryClient.setQueryData(environmentVariablesQueryKeys.project(selectedProject.id), result);
      return result.entries;
    },
    [queryClient, selectedProject],
  );

  const addCustomModel = useCallback(
    (provider: ProviderKind) => {
      const customModelInput = customModelInputByProvider[provider];
      const customModels = getCustomModelsForProvider(settings, provider);
      const normalized = normalizeModelSlug(customModelInput, provider);
      if (!normalized) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "Enter a model slug.",
        }));
        return;
      }
      if (getModelOptions(provider).some((option) => option.slug === normalized)) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "That model is already built in.",
        }));
        return;
      }
      if (normalized.length > MAX_CUSTOM_MODEL_LENGTH) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: `Model slugs must be ${MAX_CUSTOM_MODEL_LENGTH} characters or less.`,
        }));
        return;
      }
      if (customModels.includes(normalized)) {
        setCustomModelErrorByProvider((existing) => ({
          ...existing,
          [provider]: "That custom model is already saved.",
        }));
        return;
      }

      updateSettings(patchCustomModels(provider, [...customModels, normalized]));
      setCustomModelInputByProvider((existing) => ({
        ...existing,
        [provider]: "",
      }));
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [customModelInputByProvider, settings, updateSettings],
  );

  const removeCustomModel = useCallback(
    (provider: ProviderKind, slug: string) => {
      const customModels = getCustomModelsForProvider(settings, provider);
      updateSettings(
        patchCustomModels(
          provider,
          customModels.filter((model) => model !== slug),
        ),
      );
      setCustomModelErrorByProvider((existing) => ({
        ...existing,
        [provider]: null,
      }));
    },
    [settings, updateSettings],
  );

  async function restoreDefaults() {
    if (changedSettingLabels.length === 0) return;

    const api = readNativeApi();
    const confirmed = await (api ?? ensureNativeApi()).dialogs.confirm(
      ["Restore default settings?", `This will reset: ${changedSettingLabels.join(", ")}.`].join(
        "\n",
      ),
    );
    if (!confirmed) return;

    setTheme("system");
    setColorTheme("default");
    setFontFamily("inter");
    resetSettings();
    setOpenInstallProviders({
      codex: false,
      claudeAgent: false,
    });
    setSelectedCustomModelProvider("codex");
    setCustomModelInputByProvider({
      codex: "",
      claudeAgent: "",
    });
    setCustomModelErrorByProvider({});

    // Reset custom theme + overrides
    clearStoredCustomTheme();
    removeCustomTheme();
    clearRadiusOverride();
    setRadiusOverrideState(null);
    clearFontOverride();
    setFontOverrideState("");
  }

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <span className="text-sm font-medium text-foreground">Settings</span>
              <div className="ms-auto flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={changedSettingLabels.length === 0}
                  onClick={() => void restoreDefaults()}
                >
                  <RotateCcwIcon className="size-3.5" />
                  Restore defaults
                </Button>
              </div>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Settings
            </span>
            <div className="ms-auto flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={changedSettingLabels.length === 0}
                onClick={() => void restoreDefaults()}
              >
                <RotateCcwIcon className="size-3.5" />
                Restore defaults
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
            <SettingsSection title="General">
              <SettingsRow
                title="Theme"
                description="Choose how OK Code looks across the app."
                resetAction={
                  theme !== "system" ? (
                    <SettingResetButton label="theme" onClick={() => setTheme("system")} />
                  ) : null
                }
                control={
                  <Select
                    value={theme}
                    onValueChange={(value) => {
                      if (value !== "system" && value !== "light" && value !== "dark") return;
                      setTheme(value);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40" aria-label="Theme preference">
                      <SelectValue>
                        {THEME_OPTIONS.find((option) => option.value === theme)?.label ?? "System"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      {THEME_OPTIONS.map((option) => (
                        <SelectItem hideIndicator key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                }
              />

              <SettingsRow
                title="Color theme"
                description="Pick a color palette for light and dark modes."
                resetAction={
                  colorTheme !== "default" ? (
                    <SettingResetButton
                      label="color theme"
                      onClick={() => {
                        setColorTheme("default");
                        clearStoredCustomTheme();
                        removeCustomTheme();
                      }}
                    />
                  ) : null
                }
                control={
                  <div className="flex items-center gap-2">
                    <Select
                      value={colorTheme}
                      onValueChange={(value) => {
                        if (value === "custom") {
                          // If no custom theme is stored, open the import dialog
                          const existing = getStoredCustomTheme();
                          if (!existing) {
                            setCustomThemeDialogOpen(true);
                            return;
                          }
                        }
                        const match = COLOR_THEMES.find((t) => t.id === value);
                        if (!match) return;
                        setColorTheme(match.id);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-40" aria-label="Color theme">
                        <SelectValue>
                          {COLOR_THEMES.find((t) => t.id === colorTheme)?.label ?? "Default"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectPopup align="end" alignItemWithTrigger={false}>
                        {COLOR_THEMES.filter(
                          (t) => t.id !== "custom" || getStoredCustomTheme(),
                        ).map((t) => (
                          <SelectItem hideIndicator key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setCustomThemeDialogOpen(true)}
                            aria-label="Import custom theme"
                          >
                            <ImportIcon className="size-3.5" />
                          </Button>
                        }
                      />
                      <TooltipPopup side="top">Import from tweakcn.com</TooltipPopup>
                    </Tooltip>
                  </div>
                }
              />

              <SettingsRow
                title="Border radius"
                description="Adjust the corner roundness of UI elements."
                resetAction={
                  radiusOverride !== null ? (
                    <SettingResetButton
                      label="border radius"
                      onClick={() => {
                        clearRadiusOverride();
                        setRadiusOverrideState(null);
                      }}
                    />
                  ) : null
                }
                control={
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.0625}
                      value={radiusOverride ?? 0.625}
                      onChange={(e) => {
                        const value = Number.parseFloat(e.target.value);
                        setRadiusOverrideState(value);
                        setStoredRadiusOverride(value);
                      }}
                      className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                      aria-label="Border radius"
                    />
                    <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                      {(radiusOverride ?? 0.625).toFixed(2)}rem
                    </span>
                  </div>
                }
              />

              <SettingsRow
                title="Font family"
                description="Override the UI font. Use any Google Font name."
                resetAction={
                  fontOverride ? (
                    <SettingResetButton
                      label="font family"
                      onClick={() => {
                        clearFontOverride();
                        setFontOverrideState("");
                      }}
                    />
                  ) : null
                }
                control={
                  <Input
                    className="w-full sm:w-48"
                    value={fontOverride}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFontOverrideState(value);
                      if (value.trim()) {
                        setStoredFontOverride(value);
                      } else {
                        clearFontOverride();
                      }
                    }}
                    placeholder="e.g. Inter, sans-serif"
                    spellCheck={false}
                    aria-label="Font family override"
                  />
                }
              />

              <CustomThemeDialog
                open={customThemeDialogOpen}
                onOpenChange={setCustomThemeDialogOpen}
                onApply={(theme: CustomThemeData) => {
                  applyCustomTheme(theme);
                  setColorTheme("custom");
                }}
              />

              <SettingsRow
                title="Font"
                description="Choose the typeface for the interface."
                resetAction={
                  fontFamily !== "inter" ? (
                    <SettingResetButton label="font" onClick={() => setFontFamily("inter")} />
                  ) : null
                }
                control={
                  <Select
                    value={fontFamily}
                    onValueChange={(value) => {
                      const match = FONT_FAMILIES.find((f) => f.id === value);
                      if (!match) return;
                      setFontFamily(match.id);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40" aria-label="Font family">
                      <SelectValue>
                        {FONT_FAMILIES.find((f) => f.id === fontFamily)?.label ?? "Inter"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      {FONT_FAMILIES.map((f) => (
                        <SelectItem hideIndicator key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                }
              />

              <SettingsRow
                title="Window opacity"
                description="Adjust the transparency of the entire application window."
                resetAction={
                  settings.windowOpacity !== defaults.windowOpacity ? (
                    <SettingResetButton
                      label="window opacity"
                      onClick={() => {
                        updateSettings({ windowOpacity: defaults.windowOpacity });
                        if (isElectron && window.desktopBridge) {
                          void window.desktopBridge.setWindowOpacity(defaults.windowOpacity);
                        }
                      }}
                    />
                  ) : null
                }
                control={
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={30}
                      max={100}
                      value={Math.round(settings.windowOpacity * 100)}
                      onChange={(e) => {
                        const value = Number(e.target.value) / 100;
                        updateSettings({ windowOpacity: value });
                        if (isElectron && window.desktopBridge) {
                          void window.desktopBridge.setWindowOpacity(value);
                        }
                      }}
                      className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                      aria-label="Window opacity"
                    />
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {Math.round(settings.windowOpacity * 100)}%
                    </span>
                  </div>
                }
              />

              <SettingsRow
                title="Sidebar opacity"
                description="Adjust the transparency of the side panel and project list."
                resetAction={
                  settings.sidebarOpacity !== defaults.sidebarOpacity ? (
                    <SettingResetButton
                      label="sidebar opacity"
                      onClick={() => updateSettings({ sidebarOpacity: defaults.sidebarOpacity })}
                    />
                  ) : null
                }
                control={
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={30}
                      max={100}
                      value={Math.round(settings.sidebarOpacity * 100)}
                      onChange={(e) => {
                        const value = Number(e.target.value) / 100;
                        updateSettings({ sidebarOpacity: value });
                      }}
                      className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                      aria-label="Sidebar opacity"
                    />
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {Math.round(settings.sidebarOpacity * 100)}%
                    </span>
                  </div>
                }
              />

              <SettingsRow
                title="Time format"
                description="System default follows your browser or OS clock preference."
                resetAction={
                  settings.timestampFormat !== defaults.timestampFormat ? (
                    <SettingResetButton
                      label="time format"
                      onClick={() =>
                        updateSettings({
                          timestampFormat: defaults.timestampFormat,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Select
                    value={settings.timestampFormat}
                    onValueChange={(value) => {
                      if (value !== "locale" && value !== "12-hour" && value !== "24-hour") {
                        return;
                      }
                      updateSettings({
                        timestampFormat: value,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40" aria-label="Timestamp format">
                      <SelectValue>{TIMESTAMP_FORMAT_LABELS[settings.timestampFormat]}</SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      <SelectItem hideIndicator value="locale">
                        {TIMESTAMP_FORMAT_LABELS.locale}
                      </SelectItem>
                      <SelectItem hideIndicator value="12-hour">
                        {TIMESTAMP_FORMAT_LABELS["12-hour"]}
                      </SelectItem>
                      <SelectItem hideIndicator value="24-hour">
                        {TIMESTAMP_FORMAT_LABELS["24-hour"]}
                      </SelectItem>
                    </SelectPopup>
                  </Select>
                }
              />

              <SettingsRow
                title="Diff line wrapping"
                description="Set the default wrap state when the diff panel opens. The in-panel wrap toggle only affects the current diff session."
                resetAction={
                  settings.diffWordWrap !== defaults.diffWordWrap ? (
                    <SettingResetButton
                      label="diff line wrapping"
                      onClick={() =>
                        updateSettings({
                          diffWordWrap: defaults.diffWordWrap,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Switch
                    checked={settings.diffWordWrap}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        diffWordWrap: Boolean(checked),
                      })
                    }
                    aria-label="Wrap diff lines by default"
                  />
                }
              />

              <SettingsRow
                title="Assistant output"
                description="Show token-by-token output while a response is in progress."
                resetAction={
                  settings.enableAssistantStreaming !== defaults.enableAssistantStreaming ? (
                    <SettingResetButton
                      label="assistant output"
                      onClick={() =>
                        updateSettings({
                          enableAssistantStreaming: defaults.enableAssistantStreaming,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Switch
                    checked={settings.enableAssistantStreaming}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        enableAssistantStreaming: Boolean(checked),
                      })
                    }
                    aria-label="Stream assistant messages"
                  />
                }
              />

              <SettingsRow
                title="Open links externally"
                description="Open terminal URLs in your default browser instead of the embedded preview panel."
                resetAction={
                  settings.openLinksExternally !== defaults.openLinksExternally ? (
                    <SettingResetButton
                      label="open links externally"
                      onClick={() =>
                        updateSettings({
                          openLinksExternally: defaults.openLinksExternally,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Switch
                    checked={settings.openLinksExternally}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        openLinksExternally: Boolean(checked),
                      })
                    }
                    aria-label="Open links externally"
                  />
                }
              />

              <SettingsRow
                title="New threads"
                description="Pick the default workspace mode for newly created draft threads."
                resetAction={
                  settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode ? (
                    <SettingResetButton
                      label="new threads"
                      onClick={() =>
                        updateSettings({
                          defaultThreadEnvMode: defaults.defaultThreadEnvMode,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Select
                    value={settings.defaultThreadEnvMode}
                    onValueChange={(value) => {
                      if (value !== "local" && value !== "worktree") return;
                      updateSettings({
                        defaultThreadEnvMode: value,
                      });
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-44" aria-label="Default thread mode">
                      <SelectValue>
                        {settings.defaultThreadEnvMode === "worktree" ? "New worktree" : "Local"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      <SelectItem hideIndicator value="local">
                        Local
                      </SelectItem>
                      <SelectItem hideIndicator value="worktree">
                        New worktree
                      </SelectItem>
                    </SelectPopup>
                  </Select>
                }
              />

              <SettingsRow
                title="Delete confirmation"
                description="Ask before deleting a thread and its chat history."
                resetAction={
                  settings.confirmThreadDelete !== defaults.confirmThreadDelete ? (
                    <SettingResetButton
                      label="delete confirmation"
                      onClick={() =>
                        updateSettings({
                          confirmThreadDelete: defaults.confirmThreadDelete,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Switch
                    checked={settings.confirmThreadDelete}
                    onCheckedChange={(checked) =>
                      updateSettings({
                        confirmThreadDelete: Boolean(checked),
                      })
                    }
                    aria-label="Confirm thread deletion"
                  />
                }
              />
            </SettingsSection>

            <SettingsSection title="Environment">
              <SettingsRow
                title="Global variables"
                description="Available to every provider session, terminal, Git command, and health check launched on this machine."
                status={
                  globalEnvironmentVariablesQuery.isError ? (
                    <span className="block text-destructive">
                      Failed to load saved variables:{" "}
                      {getErrorMessage(globalEnvironmentVariablesQuery.error)}
                    </span>
                  ) : globalEnvironmentVariablesQuery.isFetching ? (
                    <span className="block">Loading saved variables...</span>
                  ) : globalEnvironmentVariablesQuery.data?.entries.length ? (
                    <span className="block">
                      {globalEnvironmentVariablesQuery.data.entries.length} saved variables
                    </span>
                  ) : (
                    <span className="block">No global variables saved yet.</span>
                  )
                }
              >
                <EnvironmentVariablesEditor
                  description="Global values are encrypted locally and merged into every runtime environment."
                  entries={globalEnvironmentVariablesQuery.data?.entries ?? []}
                  emptyMessage={
                    globalEnvironmentVariablesQuery.isFetching
                      ? "Loading global variables..."
                      : "No global variables saved yet."
                  }
                  saveButtonLabel="Save global"
                  addButtonLabel="Add variable"
                  onSave={saveGlobalEnvironmentVariables}
                  disabled={
                    globalEnvironmentVariablesQuery.isFetching ||
                    globalEnvironmentVariablesQuery.isError
                  }
                />
              </SettingsRow>

              <SettingsRow
                title="Project variables"
                description="Saved per project and merged on top of the global set when that project launches a provider, terminal, or helper command."
                status={
                  selectedProject ? (
                    <span className="block break-all font-mono text-[11px] text-foreground">
                      {selectedProject.name} · {selectedProject.cwd}
                    </span>
                  ) : (
                    <span className="block">Open a project to edit project variables.</span>
                  )
                }
                control={
                  projects.length > 0 ? (
                    <Select
                      value={activeProjectId ?? ""}
                      onValueChange={(value) => {
                        setSelectedProjectId(value as ProjectId);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-64" aria-label="Project selector">
                        <SelectValue>
                          {selectedProject ? selectedProject.name : "Select project"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectPopup align="end" alignItemWithTrigger={false}>
                        {projects.map((project) => (
                          <SelectItem hideIndicator key={project.id} value={project.id}>
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate">{project.name}</span>
                              <span className="truncate text-[11px] text-muted-foreground">
                                {project.cwd}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground">No projects available.</span>
                  )
                }
              >
                <EnvironmentVariablesEditor
                  key={selectedProject?.id ?? "no-project"}
                  description={
                    selectedProject
                      ? `Project values override global values for ${selectedProject.name}.`
                      : "Open or create a project to edit project variables."
                  }
                  entries={activeProjectEnvironmentVariables ?? []}
                  emptyMessage={
                    selectedProjectEnvironmentVariablesQuery.isFetching
                      ? "Loading project variables..."
                      : selectedProject
                        ? "No project variables saved yet."
                        : "Open or create a project to edit project variables."
                  }
                  saveButtonLabel="Save project"
                  addButtonLabel="Add variable"
                  onSave={saveProjectEnvironmentVariables}
                  disabled={
                    !selectedProject ||
                    selectedProjectEnvironmentVariablesQuery.isFetching ||
                    selectedProjectEnvironmentVariablesQuery.isError
                  }
                />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Models">
              <SettingsRow
                title="Git writing model"
                description="Used for generated commit messages, PR titles, and branch names."
                resetAction={
                  isGitTextGenerationModelDirty ? (
                    <SettingResetButton
                      label="git writing model"
                      onClick={() =>
                        updateSettings({
                          textGenerationModel: defaults.textGenerationModel,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Select
                    value={currentGitTextGenerationModel}
                    onValueChange={(value) => {
                      if (!value) return;
                      updateSettings({
                        textGenerationModel: value,
                      });
                    }}
                  >
                    <SelectTrigger
                      className="w-full sm:w-52"
                      aria-label="Git text generation model"
                    >
                      <SelectValue>{selectedGitTextGenerationModelLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      {gitTextGenerationModelOptions.map((option) => (
                        <SelectItem hideIndicator key={option.slug} value={option.slug}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                }
              />

              <SettingsRow
                title="Custom models"
                description="Add custom model slugs for Codex or Anthropic. The chat picker groups models by provider."
                resetAction={
                  totalCustomModels > 0 ? (
                    <SettingResetButton
                      label="custom models"
                      onClick={() => {
                        updateSettings({
                          customCodexModels: defaults.customCodexModels,
                          customClaudeModels: defaults.customClaudeModels,
                        });
                        setCustomModelErrorByProvider({});
                        setShowAllCustomModels(false);
                      }}
                    />
                  ) : null
                }
              >
                <div className="mt-4 border-t border-border pt-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={selectedCustomModelProvider}
                      onValueChange={(value) => {
                        if (value !== "codex" && value !== "claudeAgent") {
                          return;
                        }
                        setSelectedCustomModelProvider(value);
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        className="w-full sm:w-40"
                        aria-label="Custom model provider"
                      >
                        <SelectValue>{selectedCustomModelProviderSettings.title}</SelectValue>
                      </SelectTrigger>
                      <SelectPopup align="start" alignItemWithTrigger={false}>
                        {MODEL_PROVIDER_SETTINGS.map((providerSettings) => (
                          <SelectItem
                            hideIndicator
                            className="min-h-7 text-sm"
                            key={providerSettings.provider}
                            value={providerSettings.provider}
                          >
                            {providerSettings.title}
                          </SelectItem>
                        ))}
                      </SelectPopup>
                    </Select>
                    <Input
                      id="custom-model-slug"
                      value={selectedCustomModelInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCustomModelInputByProvider((existing) => ({
                          ...existing,
                          [selectedCustomModelProvider]: value,
                        }));
                        if (selectedCustomModelError) {
                          setCustomModelErrorByProvider((existing) => ({
                            ...existing,
                            [selectedCustomModelProvider]: null,
                          }));
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        addCustomModel(selectedCustomModelProvider);
                      }}
                      placeholder={selectedCustomModelProviderSettings.example}
                      spellCheck={false}
                    />
                    <Button
                      className="shrink-0"
                      variant="outline"
                      onClick={() => addCustomModel(selectedCustomModelProvider)}
                    >
                      <PlusIcon className="size-3.5" />
                      Add
                    </Button>
                  </div>

                  {selectedCustomModelError ? (
                    <p className="mt-2 text-xs text-destructive">{selectedCustomModelError}</p>
                  ) : null}

                  {totalCustomModels > 0 ? (
                    <div className="mt-3">
                      <div>
                        {visibleCustomModelRows.map((row) => (
                          <div
                            key={row.key}
                            className="group grid grid-cols-[minmax(5rem,6rem)_minmax(0,1fr)_auto] items-center gap-3 border-t border-border/60 px-4 py-2 first:border-t-0"
                          >
                            <span className="truncate text-xs text-muted-foreground">
                              {row.providerTitle}
                            </span>
                            <code className="min-w-0 truncate text-sm text-foreground">
                              {row.slug}
                            </code>
                            <button
                              type="button"
                              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100"
                              aria-label={`Remove ${row.slug}`}
                              onClick={() => removeCustomModel(row.provider, row.slug)}
                            >
                              <XIcon className="size-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {savedCustomModelRows.length > 5 ? (
                        <button
                          type="button"
                          className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          onClick={() => setShowAllCustomModels((value) => !value)}
                        >
                          {showAllCustomModels
                            ? "Show less"
                            : `Show more (${savedCustomModelRows.length - 5})`}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Advanced">
              <SettingsRow
                title="Provider installs"
                description="Override the CLI binaries and auth homes used for new sessions."
                resetAction={
                  isInstallSettingsDirty ? (
                    <SettingResetButton
                      label="provider installs"
                      onClick={() => {
                        updateSettings({
                          claudeBinaryPath: defaults.claudeBinaryPath,
                          codexBinaryPath: defaults.codexBinaryPath,
                          codexHomePath: defaults.codexHomePath,
                        });
                        setOpenInstallProviders({
                          codex: false,
                          claudeAgent: false,
                        });
                      }}
                    />
                  ) : null
                }
              >
                <div className="mt-4">
                  <div className="space-y-2">
                    {INSTALL_PROVIDER_SETTINGS.map((providerSettings) => {
                      const isOpen = openInstallProviders[providerSettings.provider];
                      const isDirty =
                        providerSettings.provider === "codex"
                          ? settings.codexBinaryPath !== defaults.codexBinaryPath ||
                            settings.codexHomePath !== defaults.codexHomePath
                          : settings.claudeBinaryPath !== defaults.claudeBinaryPath;
                      const binaryPathValue =
                        providerSettings.binaryPathKey === "claudeBinaryPath"
                          ? claudeBinaryPath
                          : codexBinaryPath;

                      return (
                        <Collapsible
                          key={providerSettings.provider}
                          open={isOpen}
                          onOpenChange={(open) =>
                            setOpenInstallProviders((existing) => ({
                              ...existing,
                              [providerSettings.provider]: open,
                            }))
                          }
                        >
                          <div className="overflow-hidden rounded-xl border border-border/70">
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-3 text-left"
                              onClick={() =>
                                setOpenInstallProviders((existing) => ({
                                  ...existing,
                                  [providerSettings.provider]: !existing[providerSettings.provider],
                                }))
                              }
                            >
                              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                {providerSettings.title}
                              </span>
                              {isDirty ? (
                                <span className="text-[11px] text-muted-foreground">Custom</span>
                              ) : null}
                              <ChevronDownIcon
                                className={cn(
                                  "size-4 shrink-0 text-muted-foreground transition-transform",
                                  isOpen && "rotate-180",
                                )}
                              />
                            </button>

                            <CollapsibleContent>
                              <div className="border-t border-border/70 px-4 py-4">
                                <div className="space-y-3">
                                  <label
                                    htmlFor={`provider-install-${providerSettings.binaryPathKey}`}
                                    className="block"
                                  >
                                    <span className="block text-xs font-medium text-foreground">
                                      {providerSettings.title} binary path
                                    </span>
                                    <Input
                                      id={`provider-install-${providerSettings.binaryPathKey}`}
                                      className="mt-1"
                                      value={binaryPathValue}
                                      onChange={(event) =>
                                        updateSettings(
                                          providerSettings.binaryPathKey === "claudeBinaryPath"
                                            ? { claudeBinaryPath: event.target.value }
                                            : { codexBinaryPath: event.target.value },
                                        )
                                      }
                                      placeholder={providerSettings.binaryPlaceholder}
                                      spellCheck={false}
                                    />
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      {providerSettings.binaryDescription}
                                    </span>
                                  </label>

                                  {providerSettings.homePathKey ? (
                                    <label
                                      htmlFor={`provider-install-${providerSettings.homePathKey}`}
                                      className="block"
                                    >
                                      <span className="block text-xs font-medium text-foreground">
                                        CODEX_HOME path
                                      </span>
                                      <Input
                                        id={`provider-install-${providerSettings.homePathKey}`}
                                        className="mt-1"
                                        value={codexHomePath}
                                        onChange={(event) =>
                                          updateSettings({
                                            codexHomePath: event.target.value,
                                          })
                                        }
                                        placeholder={providerSettings.homePlaceholder}
                                        spellCheck={false}
                                      />
                                      {providerSettings.homeDescription ? (
                                        <span className="mt-1 block text-xs text-muted-foreground">
                                          {providerSettings.homeDescription}
                                        </span>
                                      ) : null}
                                    </label>
                                  ) : null}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              </SettingsRow>

              <SettingsRow
                title="Keybindings"
                description="Open the persisted `keybindings.json` file to edit advanced bindings directly."
                status={
                  <>
                    <span className="block break-all font-mono text-[11px] text-foreground">
                      {keybindingsConfigPath ?? "Resolving keybindings path..."}
                    </span>
                    {openKeybindingsError ? (
                      <span className="mt-1 block text-destructive">{openKeybindingsError}</span>
                    ) : (
                      <span className="mt-1 block">Opens in your preferred editor.</span>
                    )}
                  </>
                }
                control={
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={!keybindingsConfigPath || isOpeningKeybindings}
                    onClick={openKeybindingsFile}
                  >
                    {isOpeningKeybindings ? "Opening..." : "Open file"}
                  </Button>
                }
              />

              <SettingsRow
                title="Version"
                description="Current application version."
                control={
                  <code className="text-xs font-medium text-muted-foreground">{APP_VERSION}</code>
                }
              />
            </SettingsSection>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
