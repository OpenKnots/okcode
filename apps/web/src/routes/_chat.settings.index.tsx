import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
  SkipForwardIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { TestOpenclawGatewayHostKind, TestOpenclawGatewayResult } from "@okcode/contracts";
import {
  type BuildMetadata,
  type KeybindingCommand,
  type KeybindingRule,
  type ProjectId,
  type ProviderKind,
  DEFAULT_GIT_TEXT_GENERATION_MODEL,
} from "@okcode/contracts";
import { getModelOptions, normalizeModelSlug } from "@okcode/shared/model";
import { validateHttpPreviewUrl } from "@okcode/shared/preview";
import {
  DEFAULT_BROWSER_PREVIEW_START_PAGE_URL,
  DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE,
  getAppModelOptions,
  getCustomModelsForProvider,
  MAX_CUSTOM_MODEL_LENGTH,
  MODEL_PROVIDER_SETTINGS,
  patchCustomModels,
  PrReviewRequestChangesTone,
  resolveBrowserPreviewStartPageUrl,
} from "../appSettings";
import { APP_BUILD_INFO } from "../branding";
import { Button } from "../components/ui/button";
import { Collapsible, CollapsibleContent } from "../components/ui/collapsible";
import { EnvironmentVariablesEditor } from "../components/EnvironmentVariablesEditor";
import { HotkeysSettingsSection } from "../components/settings/HotkeysSettingsSection";
import { ProviderCapabilityMatrix } from "../components/settings/ProviderCapabilityMatrix";
import { ProviderStatusRefreshButton } from "../components/settings/ProviderStatusRefreshButton";
import { SettingsShell, type SettingsSectionId } from "../components/settings/SettingsShell";
import { useSettingsRouteContext } from "../components/settings/SettingsRouteContext";
import {
  SettingResetButton,
  SettingsRow,
  SettingsSection,
} from "../components/settings/SettingsUi";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { resolveAndPersistPreferredEditor } from "../editorPreferences";
import { isMobileShell } from "../env";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import {
  environmentVariablesQueryKeys,
  globalEnvironmentVariablesQueryOptions,
  projectEnvironmentVariablesQueryOptions,
} from "../lib/environmentVariablesReactQuery";
import { normalizeProjectIconPath } from "../lib/projectIcons";
import { useProjectIconFilePicker } from "../hooks/useProjectIconFilePicker";
import { updateProjectIconOverride } from "../lib/projectMeta";
import { getSelectableThreadProviders } from "../lib/providerAvailability";
import { serverConfigQueryOptions, serverQueryKeys } from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { ensureNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { PairingLink } from "../components/mobile/PairingLink";
import { ProjectIcon } from "../components/ProjectIcon";
import { CodexBackendSection } from "../components/settings/CodexBackendSection";
import { INSTALL_PROVIDER_SETTINGS } from "../lib/settingsProviderMetadata";
import { APP_LOCALE_PREFERENCES } from "../i18n/types";
import { useT } from "../i18n/useI18n";

const TIMESTAMP_FORMAT_OPTIONS = [
  { value: "locale", labelKey: "settings.general.timeFormat.option.locale" },
  { value: "12-hour", labelKey: "settings.general.timeFormat.option.12Hour" },
  { value: "24-hour", labelKey: "settings.general.timeFormat.option.24Hour" },
] as const;

const LANGUAGE_OPTIONS = APP_LOCALE_PREFERENCES.map((value) => ({
  value,
  labelKey: `settings.general.language.option.${value}` as const,
}));

const PR_REVIEW_REQUEST_CHANGES_TONE_OPTIONS: ReadonlyArray<{
  value: PrReviewRequestChangesTone;
  label: string;
}> = [
  { value: "warning", label: "Warning" },
  { value: "neutral", label: "Neutral" },
  { value: "brand", label: "Brand" },
];

function describeOpenclawGatewayHostKind(hostKind: TestOpenclawGatewayHostKind): string {
  switch (hostKind) {
    case "loopback":
      return "Loopback / same machine";
    case "tailscale":
      return "Tailscale / tailnet";
    case "private":
      return "Private LAN";
    case "public":
      return "Public / internet-routable";
    case "unknown":
      return "Unknown";
  }
}

function describeOpenclawGatewayHealthStatus(result: TestOpenclawGatewayResult): string | null {
  const diagnostics = result.diagnostics;
  if (!diagnostics) return null;
  switch (diagnostics.healthStatus) {
    case "pass":
      return diagnostics.healthDetail ? `Reachable (${diagnostics.healthDetail})` : "Reachable";
    case "fail":
      return diagnostics.healthDetail ? `Failed (${diagnostics.healthDetail})` : "Failed";
    case "skip":
      return diagnostics.healthDetail ?? "Skipped";
  }
}

function formatOpenclawGatewayDebugReport(result: TestOpenclawGatewayResult): string {
  const lines = [
    `OpenClaw gateway connection test: ${result.success ? "success" : "failed"}`,
    `Total duration: ${result.totalDurationMs}ms`,
  ];

  if (result.error) {
    lines.push(`Error: ${result.error}`);
  }

  lines.push("");
  lines.push("Steps:");
  for (const step of result.steps) {
    lines.push(
      `- ${step.name}: ${step.status} (${step.durationMs}ms)${
        step.detail ? ` — ${step.detail}` : ""
      }`,
    );
  }

  if (result.serverInfo) {
    lines.push("");
    lines.push("Server info:");
    if (result.serverInfo.version) {
      lines.push(`- Version: ${result.serverInfo.version}`);
    }
    if (result.serverInfo.sessionId) {
      lines.push(`- Session: ${result.serverInfo.sessionId}`);
    }
  }

  if (result.diagnostics) {
    const diagnostics = result.diagnostics;
    lines.push("");
    lines.push("Diagnostics:");
    if (diagnostics.normalizedUrl) {
      lines.push(`- Endpoint: ${diagnostics.normalizedUrl}`);
    }
    if (diagnostics.hostKind) {
      lines.push(`- Host type: ${describeOpenclawGatewayHostKind(diagnostics.hostKind)}`);
    }
    if (diagnostics.resolvedAddresses.length > 0) {
      lines.push(`- Resolved: ${diagnostics.resolvedAddresses.join(", ")}`);
    }
    const healthStatus = describeOpenclawGatewayHealthStatus(result);
    if (healthStatus) {
      lines.push(
        `- Health probe: ${healthStatus}${
          diagnostics.healthUrl ? ` at ${diagnostics.healthUrl}` : ""
        }`,
      );
    }
    if (diagnostics.socketCloseCode !== undefined) {
      lines.push(
        `- Socket close: ${diagnostics.socketCloseCode}${
          diagnostics.socketCloseReason ? ` (${diagnostics.socketCloseReason})` : ""
        }`,
      );
    }
    if (diagnostics.socketError) {
      lines.push(`- Socket error: ${diagnostics.socketError}`);
    }
    if (diagnostics.gatewayErrorCode) {
      lines.push(`- Gateway error code: ${diagnostics.gatewayErrorCode}`);
    }
    if (diagnostics.gatewayErrorDetailCode) {
      lines.push(`- Gateway detail code: ${diagnostics.gatewayErrorDetailCode}`);
    }
    if (diagnostics.gatewayErrorDetailReason) {
      lines.push(`- Gateway detail reason: ${diagnostics.gatewayErrorDetailReason}`);
    }
    if (diagnostics.gatewayRecommendedNextStep) {
      lines.push(`- Gateway next step: ${diagnostics.gatewayRecommendedNextStep}`);
    }
    if (diagnostics.gatewayCanRetryWithDeviceToken !== undefined) {
      lines.push(
        `- Device-token retry available: ${diagnostics.gatewayCanRetryWithDeviceToken ? "yes" : "no"}`,
      );
    }
    if (diagnostics.observedNotifications.length > 0) {
      lines.push(`- Gateway events: ${diagnostics.observedNotifications.join(", ")}`);
    }
    if (diagnostics.hints.length > 0) {
      lines.push("");
      lines.push("Troubleshooting:");
      for (const hint of diagnostics.hints) {
        lines.push(`- ${hint}`);
      }
    }
  }

  return lines.join("\n");
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

function BuildInfoBlock({ label, buildInfo }: { label: string; buildInfo: BuildMetadata }) {
  return (
    <dl className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 space-y-1 text-[11px] leading-5 text-muted-foreground">
        <div className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-0.5 font-mono">
          <span className="font-medium text-foreground">{buildInfo.version}</span>
          <span aria-hidden="true">·</span>
          <span>{buildInfo.surface}</span>
          <span aria-hidden="true">·</span>
          <span>
            {buildInfo.platform}/{buildInfo.arch}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-0.5 font-mono">
          <span>{buildInfo.channel}</span>
          <span aria-hidden="true">·</span>
          <span className="break-words">{buildInfo.commitHash ?? "unknown"}</span>
          <span aria-hidden="true">·</span>
          <span className="break-words">{buildInfo.buildTimestamp}</span>
        </div>
      </dd>
    </dl>
  );
}

function SettingsRouteView() {
  const { t } = useT();
  const navigate = useNavigate();
  const {
    settingsState: { settings, defaults, updateSettings },
    changedSettingLabels,
    restoreDefaults,
  } = useSettingsRouteContext();
  const search = Route.useSearch();
  const activeSection = search.section ?? "general";
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const queryClient = useQueryClient();
  const trimmedBrowserPreviewStartPageUrl = settings.browserPreviewStartPageUrl.trim();
  const browserPreviewStartPageValidation =
    trimmedBrowserPreviewStartPageUrl.length > 0
      ? validateHttpPreviewUrl(trimmedBrowserPreviewStartPageUrl)
      : null;
  const effectiveBrowserPreviewStartPageUrl = resolveBrowserPreviewStartPageUrl(
    settings.browserPreviewStartPageUrl,
  );
  const projects = useStore((state) => state.projects);
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId | null>(
    () => projects[0]?.id ?? null,
  );
  const [isOpeningKeybindings, setIsOpeningKeybindings] = useState(false);
  const [openKeybindingsError, setOpenKeybindingsError] = useState<string | null>(null);
  const [openInstallProviders, setOpenInstallProviders] = useState<Record<ProviderKind, boolean>>({
    codex: Boolean(settings.codexBinaryPath || settings.codexHomePath),
    claudeAgent: Boolean(settings.claudeBinaryPath),
    gemini: false,
    copilot: Boolean(settings.copilotBinaryPath || settings.copilotConfigDir),
    openclaw: Boolean(settings.openclawGatewayUrl || settings.openclawPassword),
  });
  const [selectedCustomModelProvider, setSelectedCustomModelProvider] =
    useState<ProviderKind>("codex");
  const [customModelInputByProvider, setCustomModelInputByProvider] = useState<
    Record<ProviderKind, string>
  >({
    codex: "",
    claudeAgent: "",
    gemini: "",
    copilot: "",
    openclaw: "",
  });
  const [customModelErrorByProvider, setCustomModelErrorByProvider] = useState<
    Partial<Record<ProviderKind, string | null>>
  >({});
  const [showAllCustomModels, setShowAllCustomModels] = useState(false);
  const [openclawTestResult, setOpenclawTestResult] = useState<TestOpenclawGatewayResult | null>(
    null,
  );
  const [openclawTestLoading, setOpenclawTestLoading] = useState(false);
  const { copyToClipboard: copyOpenclawDebugReport, isCopied: openclawDebugReportCopied } =
    useCopyToClipboard();

  const globalEnvironmentVariablesQuery = useQuery(globalEnvironmentVariablesQueryOptions());
  const activeProjectId = selectedProjectId ?? projects[0]?.id ?? null;
  const selectedProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const [projectIconDraft, setProjectIconDraft] = useState("");
  const { fileInputRef, openFilePicker, handleFileChange } = useProjectIconFilePicker({
    onFileSelected: (dataUrl) => {
      setProjectIconDraft(dataUrl);
    },
  });
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

  useEffect(() => {
    setProjectIconDraft(selectedProject?.iconPath ?? "");
  }, [selectedProject?.iconPath, selectedProject?.id]);

  const codexBinaryPath = settings.codexBinaryPath;
  const codexHomePath = settings.codexHomePath;
  const claudeBinaryPath = settings.claudeBinaryPath;
  const keybindingsConfigPath = serverConfigQuery.data?.keybindingsConfigPath ?? null;
  const availableEditors = serverConfigQuery.data?.availableEditors;
  const providerStatuses = serverConfigQuery.data?.providers ?? [];
  const isRefreshingProviderStatuses = serverConfigQuery.isFetching;
  const selectableProviders = getSelectableThreadProviders({
    statuses: providerStatuses,
    openclawGatewayUrl: settings.openclawGatewayUrl,
  });

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
  const totalCustomModels =
    settings.customCodexModels.length +
    settings.customClaudeModels.length +
    settings.customCopilotModels.length +
    settings.customGeminiModels.length +
    settings.customOpenClawModels.length;
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
    settings.copilotBinaryPath !== defaults.copilotBinaryPath ||
    settings.copilotConfigDir !== defaults.copilotConfigDir ||
    settings.codexBinaryPath !== defaults.codexBinaryPath ||
    settings.codexHomePath !== defaults.codexHomePath;
  const isOpenClawSettingsDirty =
    settings.openclawGatewayUrl !== defaults.openclawGatewayUrl ||
    settings.openclawPassword !== defaults.openclawPassword;

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

  const replaceKeybindingRules = useCallback(
    async (command: KeybindingCommand, rules: readonly KeybindingRule[]) => {
      const api = ensureNativeApi();
      await api.server.replaceKeybindingRules({ command, rules: [...rules] });
      await queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
    },
    [queryClient],
  );

  const refreshProviderStatuses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });
  }, [queryClient]);

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

  const saveProjectIconOverride = useCallback(async () => {
    if (!selectedProject) {
      throw new Error("Select a project before saving the project icon.");
    }
    const nextIconPath = normalizeProjectIconPath(projectIconDraft);
    const currentIconPath = normalizeProjectIconPath(selectedProject.iconPath);
    if (nextIconPath === currentIconPath) {
      return;
    }

    const api = ensureNativeApi();
    await updateProjectIconOverride(api, selectedProject.id, nextIconPath);
  }, [projectIconDraft, selectedProject]);

  const testOpenclawGateway = useCallback(async () => {
    if (openclawTestLoading) return;
    setOpenclawTestLoading(true);
    setOpenclawTestResult(null);
    try {
      const api = ensureNativeApi();
      const result = await api.server.testOpenclawGateway({
        gatewayUrl: settings.openclawGatewayUrl,
        password: settings.openclawPassword || undefined,
      });
      setOpenclawTestResult(result);
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: serverQueryKeys.config() });
      }
    } catch (err) {
      setOpenclawTestResult({
        success: false,
        steps: [],
        totalDurationMs: 0,
        error: err instanceof Error ? err.message : "Unexpected error during test.",
      });
    } finally {
      setOpenclawTestLoading(false);
    }
  }, [openclawTestLoading, queryClient, settings.openclawGatewayUrl, settings.openclawPassword]);

  const handleCopyOpenclawDebugReport = useCallback(() => {
    if (!openclawTestResult) return;
    copyOpenclawDebugReport(formatOpenclawGatewayDebugReport(openclawTestResult), undefined);
  }, [copyOpenclawDebugReport, openclawTestResult]);

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

  const languageOptionLabel = (value: (typeof APP_LOCALE_PREFERENCES)[number]) =>
    t(`settings.general.language.option.${value}`);

  const timestampFormatOptionLabel = (value: (typeof TIMESTAMP_FORMAT_OPTIONS)[number]["value"]) =>
    t(
      TIMESTAMP_FORMAT_OPTIONS.find((option) => option.value === value)?.labelKey ??
        "settings.general.timeFormat.option.locale",
    );

  return (
    <SettingsShell
      activeItem={activeSection}
      changedSettingLabels={changedSettingLabels}
      onRestoreDefaults={restoreDefaults}
    >
      <div className="space-y-10">
        {activeSection === "general" && (
          <SettingsSection
            title="General"
            description="Workflow, output, and app behavior preferences."
          >
            <SettingsRow
              title="Style"
              description="Theme, typography, sidebar density, and background treatment live on a dedicated page."
              onClick={() => void navigate({ to: "/settings/style" })}
              control={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void navigate({ to: "/settings/style" })}
                >
                  Open style settings
                </Button>
              }
            />

            <SettingsRow
              title={t("settings.general.language.title")}
              description={t("settings.general.language.description")}
              resetAction={
                settings.locale !== defaults.locale ? (
                  <SettingResetButton
                    label="language"
                    onClick={() =>
                      updateSettings({
                        locale: defaults.locale,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Select
                  value={settings.locale}
                  onValueChange={(value) => {
                    if (!LANGUAGE_OPTIONS.some((option) => option.value === value)) {
                      return;
                    }
                    updateSettings({
                      locale: value as (typeof APP_LOCALE_PREFERENCES)[number],
                    });
                  }}
                >
                  <SelectTrigger
                    className="w-full sm:w-40"
                    aria-label={t("settings.general.language.aria")}
                  >
                    <SelectValue>{languageOptionLabel(settings.locale)}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem hideIndicator key={option.value} value={option.value}>
                        {languageOptionLabel(option.value)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              }
            />

            <SettingsRow
              title="PR request changes button"
              description="Choose how prominent the Request changes action looks in pull request review."
              resetAction={
                settings.prReviewRequestChangesTone !== DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE ? (
                  <SettingResetButton
                    label="PR request changes button"
                    onClick={() =>
                      updateSettings({
                        prReviewRequestChangesTone: DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Select
                  value={settings.prReviewRequestChangesTone}
                  onValueChange={(value) => {
                    if (value !== "warning" && value !== "neutral" && value !== "brand") {
                      return;
                    }
                    updateSettings({
                      prReviewRequestChangesTone: value,
                    });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40" aria-label="PR request changes button">
                    <SelectValue>
                      {PR_REVIEW_REQUEST_CHANGES_TONE_OPTIONS.find(
                        (option) => option.value === settings.prReviewRequestChangesTone,
                      )?.label ?? "Warning"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {PR_REVIEW_REQUEST_CHANGES_TONE_OPTIONS.map((option) => (
                      <SelectItem hideIndicator key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
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
                    if (!TIMESTAMP_FORMAT_OPTIONS.some((option) => option.value === value)) {
                      return;
                    }
                    updateSettings({
                      timestampFormat: value as (typeof TIMESTAMP_FORMAT_OPTIONS)[number]["value"],
                    });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-40" aria-label="Timestamp format">
                    <SelectValue>
                      {timestampFormatOptionLabel(settings.timestampFormat)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {TIMESTAMP_FORMAT_OPTIONS.map((option) => (
                      <SelectItem hideIndicator key={option.value} value={option.value}>
                        {timestampFormatOptionLabel(option.value)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
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
              title="Reasoning content"
              description="Show reasoning/thinking content in the work log instead of just showing 'Reasoning update'."
              resetAction={
                settings.showReasoningContent !== defaults.showReasoningContent ? (
                  <SettingResetButton
                    label="reasoning content"
                    onClick={() =>
                      updateSettings({
                        showReasoningContent: defaults.showReasoningContent,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.showReasoningContent}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      showReasoningContent: Boolean(checked),
                    })
                  }
                  aria-label="Show reasoning content in work log"
                />
              }
            />

            <SettingsRow
              title="Auth failure errors"
              description="Show provider authentication failures in the thread error banner. Turn this off to keep login issues out of the main error state."
              resetAction={
                settings.showAuthFailuresAsErrors !== defaults.showAuthFailuresAsErrors ? (
                  <SettingResetButton
                    label="auth failure errors"
                    onClick={() =>
                      updateSettings({
                        showAuthFailuresAsErrors: defaults.showAuthFailuresAsErrors,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.showAuthFailuresAsErrors}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      showAuthFailuresAsErrors: Boolean(checked),
                    })
                  }
                  aria-label="Show authentication failures as thread errors"
                />
              }
            />

            <SettingsRow
              title="Notification details"
              description="Open the chat notification bar expanded by default so the error text is visible without an extra click."
              resetAction={
                settings.showNotificationDetails !== defaults.showNotificationDetails ? (
                  <SettingResetButton
                    label="notification details"
                    onClick={() =>
                      updateSettings({
                        showNotificationDetails: defaults.showNotificationDetails,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.showNotificationDetails}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      showNotificationDetails: Boolean(checked),
                    })
                  }
                  aria-label="Show notification details by default"
                />
              }
            />

            <SettingsRow
              title="Diagnostics copy tips"
              description="Include short troubleshooting tips when copying notification diagnostics. Leave this off to keep copied text smaller."
              resetAction={
                settings.includeDiagnosticsTipsInCopy !== defaults.includeDiagnosticsTipsInCopy ? (
                  <SettingResetButton
                    label="diagnostics copy tips"
                    onClick={() =>
                      updateSettings({
                        includeDiagnosticsTipsInCopy: defaults.includeDiagnosticsTipsInCopy,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.includeDiagnosticsTipsInCopy}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      includeDiagnosticsTipsInCopy: Boolean(checked),
                    })
                  }
                  aria-label="Include diagnostics tips in copied text"
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
              title="Browser preview start page"
              description="Used when opening a new browser preview tab without typing a URL first."
              status={
                trimmedBrowserPreviewStartPageUrl.length === 0 ? (
                  <>
                    Blank uses the default start page:{" "}
                    <code>{DEFAULT_BROWSER_PREVIEW_START_PAGE_URL}</code>
                  </>
                ) : browserPreviewStartPageValidation?.ok ? (
                  <>
                    New blank preview tabs will open at{" "}
                    <code>{browserPreviewStartPageValidation.url}</code>.
                  </>
                ) : (
                  <>
                    <span className="text-destructive">
                      Invalid URL. Falling back to{" "}
                      <code>{DEFAULT_BROWSER_PREVIEW_START_PAGE_URL}</code>.
                    </span>
                    <span className="mt-1 block break-all">
                      Effective start page: <code>{effectiveBrowserPreviewStartPageUrl}</code>
                    </span>
                  </>
                )
              }
              resetAction={
                settings.browserPreviewStartPageUrl !== defaults.browserPreviewStartPageUrl ? (
                  <SettingResetButton
                    label="browser preview start page"
                    onClick={() =>
                      updateSettings({
                        browserPreviewStartPageUrl: defaults.browserPreviewStartPageUrl,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Input
                  value={settings.browserPreviewStartPageUrl}
                  onChange={(event) =>
                    updateSettings({
                      browserPreviewStartPageUrl: event.target.value,
                    })
                  }
                  placeholder={DEFAULT_BROWSER_PREVIEW_START_PAGE_URL}
                  aria-label="Browser preview start page"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full sm:w-72"
                />
              }
            />

            <SettingsRow
              title="Code Preview Autosave"
              description="Automatically save edits made in the built-in code preview after a short delay."
              resetAction={
                settings.codeViewerAutosave !== defaults.codeViewerAutosave ? (
                  <SettingResetButton
                    label="code preview autosave"
                    onClick={() =>
                      updateSettings({
                        codeViewerAutosave: defaults.codeViewerAutosave,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.codeViewerAutosave}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      codeViewerAutosave: Boolean(checked),
                    })
                  }
                  aria-label="Enable code preview autosave"
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
              title="New worktree base"
              description="Refresh the selected base branch from its tracked remote before creating a new worktree, without changing your current checkout."
              resetAction={
                settings.autoUpdateWorktreeBaseBranch !== defaults.autoUpdateWorktreeBaseBranch ? (
                  <SettingResetButton
                    label="new worktree base"
                    onClick={() =>
                      updateSettings({
                        autoUpdateWorktreeBaseBranch: defaults.autoUpdateWorktreeBaseBranch,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.autoUpdateWorktreeBaseBranch}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      autoUpdateWorktreeBaseBranch: Boolean(checked),
                    })
                  }
                  aria-label="Refresh base branch before creating new worktrees"
                />
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

            <SettingsRow
              title="Auto-delete after merge"
              description="Automatically delete a thread after its associated PR is merged."
              resetAction={
                settings.autoDeleteMergedThreads !== defaults.autoDeleteMergedThreads ? (
                  <SettingResetButton
                    label="auto-delete merged threads"
                    onClick={() =>
                      updateSettings({
                        autoDeleteMergedThreads: defaults.autoDeleteMergedThreads,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.autoDeleteMergedThreads}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      autoDeleteMergedThreads: Boolean(checked),
                    })
                  }
                  aria-label="Auto-delete merged threads"
                />
              }
            />

            {settings.autoDeleteMergedThreads ? (
              <SettingsRow
                title="Auto-delete delay"
                description="How long to wait after a PR merge before deleting the thread."
                resetAction={
                  settings.autoDeleteMergedThreadsDelayMinutes !==
                  defaults.autoDeleteMergedThreadsDelayMinutes ? (
                    <SettingResetButton
                      label="auto-delete delay"
                      onClick={() =>
                        updateSettings({
                          autoDeleteMergedThreadsDelayMinutes:
                            defaults.autoDeleteMergedThreadsDelayMinutes,
                        })
                      }
                    />
                  ) : null
                }
                control={
                  <Select
                    value={String(settings.autoDeleteMergedThreadsDelayMinutes)}
                    onValueChange={(value) =>
                      updateSettings({
                        autoDeleteMergedThreadsDelayMinutes: Number(value),
                      })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      <SelectItem hideIndicator value="1">
                        1 minute
                      </SelectItem>
                      <SelectItem hideIndicator value="2">
                        2 minutes
                      </SelectItem>
                      <SelectItem hideIndicator value="5">
                        5 minutes
                      </SelectItem>
                      <SelectItem hideIndicator value="10">
                        10 minutes
                      </SelectItem>
                      <SelectItem hideIndicator value="15">
                        15 minutes
                      </SelectItem>
                      <SelectItem hideIndicator value="30">
                        30 minutes
                      </SelectItem>
                      <SelectItem hideIndicator value="60">
                        1 hour
                      </SelectItem>
                    </SelectPopup>
                  </Select>
                }
              />
            ) : null}
          </SettingsSection>
        )}

        {activeSection === "authentication" && (
          <SettingsSection
            title="Authentication"
            description="Only providers that are ready and authenticated enough to run will appear in the new-thread provider picker. Existing threads remain pinned to their current provider."
            actions={
              <ProviderStatusRefreshButton
                refreshing={isRefreshingProviderStatuses}
                onRefresh={() => void refreshProviderStatuses()}
              />
            }
          >
            <SettingsRow
              title="Provider matrix"
              description="One shared chat architecture, one shared capability contract, and only a few provider-specific differences where they materially change setup or behavior."
              status={`${selectableProviders.length} provider${selectableProviders.length === 1 ? "" : "s"} currently selectable`}
            >
              <div className="mt-4">
                <ProviderCapabilityMatrix
                  statuses={providerStatuses}
                  openclawGatewayUrl={settings.openclawGatewayUrl}
                />
              </div>
            </SettingsRow>

            <SettingsRow
              title="Provider installs"
              description="Override the CLI binaries and auth homes used for new sessions."
              status="These paths apply when OK Code starts a fresh provider session."
              resetAction={
                isInstallSettingsDirty ? (
                  <SettingResetButton
                    label="provider installs"
                    onClick={() => {
                      updateSettings({
                        claudeBinaryPath: defaults.claudeBinaryPath,
                        codexBinaryPath: defaults.codexBinaryPath,
                        codexHomePath: defaults.codexHomePath,
                        copilotBinaryPath: defaults.copilotBinaryPath,
                        copilotConfigDir: defaults.copilotConfigDir,
                      });
                      setOpenInstallProviders({
                        codex: false,
                        claudeAgent: false,
                        gemini: false,
                        copilot: false,
                        openclaw: false,
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
                        : providerSettings.provider === "claudeAgent"
                          ? settings.claudeBinaryPath !== defaults.claudeBinaryPath
                          : settings.copilotBinaryPath !== defaults.copilotBinaryPath ||
                            settings.copilotConfigDir !== defaults.copilotConfigDir;
                    const binaryPathValue =
                      providerSettings.provider === "claudeAgent"
                        ? claudeBinaryPath
                        : providerSettings.provider === "copilot"
                          ? settings.copilotBinaryPath
                          : codexBinaryPath;
                    const homePathKey =
                      "homePathKey" in providerSettings ? providerSettings.homePathKey : undefined;
                    const homePlaceholder =
                      "homePlaceholder" in providerSettings
                        ? providerSettings.homePlaceholder
                        : undefined;
                    const homeDescription =
                      "homeDescription" in providerSettings
                        ? providerSettings.homeDescription
                        : undefined;

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
                                          : providerSettings.binaryPathKey === "copilotBinaryPath"
                                            ? { copilotBinaryPath: event.target.value }
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

                                {homePathKey ? (
                                  <label
                                    htmlFor={`provider-install-${homePathKey}`}
                                    className="block"
                                  >
                                    <span className="block text-xs font-medium text-foreground">
                                      {homePathKey === "codexHomePath"
                                        ? "CODEX_HOME path"
                                        : "Copilot config directory"}
                                    </span>
                                    <Input
                                      id={`provider-install-${homePathKey}`}
                                      className="mt-1"
                                      value={
                                        homePathKey === "codexHomePath"
                                          ? codexHomePath
                                          : settings.copilotConfigDir
                                      }
                                      onChange={(event) =>
                                        updateSettings(
                                          homePathKey === "codexHomePath"
                                            ? { codexHomePath: event.target.value }
                                            : { copilotConfigDir: event.target.value },
                                        )
                                      }
                                      placeholder={homePlaceholder}
                                      spellCheck={false}
                                    />
                                    {homeDescription ? (
                                      <span className="mt-1 block text-xs text-muted-foreground">
                                        {homeDescription}
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
              title="OpenClaw gateway"
              description="Connect to an OpenClaw gateway for remote agent sessions."
              status={
                settings.openclawGatewayUrl.trim().length > 0
                  ? `Configured for ${settings.openclawGatewayUrl}`
                  : "Not configured"
              }
              resetAction={
                isOpenClawSettingsDirty ? (
                  <SettingResetButton
                    label="OpenClaw gateway"
                    onClick={() =>
                      updateSettings({
                        openclawGatewayUrl: defaults.openclawGatewayUrl,
                        openclawPassword: defaults.openclawPassword,
                      })
                    }
                  />
                ) : null
              }
            >
              <div className="mt-4 space-y-3">
                <label htmlFor="openclaw-gateway-url" className="block">
                  <span className="block text-xs font-medium text-foreground">Gateway URL</span>
                  <Input
                    id="openclaw-gateway-url"
                    className="mt-1"
                    value={settings.openclawGatewayUrl}
                    onChange={(event) => {
                      updateSettings({ openclawGatewayUrl: event.target.value });
                      setOpenclawTestResult(null);
                    }}
                    placeholder="ws://localhost:8080"
                    spellCheck={false}
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    WebSocket URL of the OpenClaw gateway. Leave blank when not using OpenClaw.
                  </span>
                </label>
                <label htmlFor="openclaw-password" className="block">
                  <span className="block text-xs font-medium text-foreground">
                    Shared Secret / Token
                  </span>
                  <Input
                    id="openclaw-password"
                    className="mt-1"
                    type="password"
                    value={settings.openclawPassword}
                    onChange={(event) => {
                      updateSettings({ openclawPassword: event.target.value });
                      setOpenclawTestResult(null);
                    }}
                    placeholder="Shared secret"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Shared secret used to authenticate with the gateway. This is the recommended
                    default for remote and Tailscale gateways.
                  </span>
                </label>

                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!settings.openclawGatewayUrl || openclawTestLoading}
                    onClick={testOpenclawGateway}
                  >
                    {openclawTestLoading ? (
                      <>
                        <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                        Testing…
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                </div>

                {openclawTestResult ? (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      {openclawTestResult.success ? (
                        <CheckCircle2Icon className="size-4 text-emerald-500" />
                      ) : (
                        <XCircleIcon className="size-4 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          openclawTestResult.success ? "text-emerald-500" : "text-red-500",
                        )}
                      >
                        {openclawTestResult.success ? "Connection successful" : "Connection failed"}
                      </span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        {openclawTestResult.totalDurationMs}ms total
                      </span>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-[10px]"
                        onClick={handleCopyOpenclawDebugReport}
                      >
                        {openclawDebugReportCopied ? "Copied!" : "Copy debug report"}
                      </Button>
                    </div>

                    {openclawTestResult.steps.length > 0 ? (
                      <div className="mt-2.5 space-y-1.5">
                        {openclawTestResult.steps.map((step) => (
                          <div
                            key={`${step.name}-${step.status}-${step.durationMs}`}
                            className="flex items-start gap-2 text-xs"
                          >
                            {step.status === "pass" ? (
                              <CheckCircle2Icon className="mt-px size-3.5 shrink-0 text-emerald-500" />
                            ) : null}
                            {step.status === "fail" ? (
                              <XCircleIcon className="mt-px size-3.5 shrink-0 text-red-500" />
                            ) : null}
                            {step.status === "skip" ? (
                              <SkipForwardIcon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                            ) : null}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="font-medium text-foreground">{step.name}</span>
                                <span className="text-[10px] tabular-nums text-muted-foreground">
                                  {step.durationMs}ms
                                </span>
                              </div>
                              {step.detail ? (
                                <span className="block break-all text-muted-foreground">
                                  {step.detail}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {openclawTestResult.error &&
                    !openclawTestResult.steps.some((step) => step.status === "fail") ? (
                      <div className="mt-2 text-xs text-red-500">{openclawTestResult.error}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </SettingsRow>
          </SettingsSection>
        )}

        {activeSection === "hotkeys" && (
          <HotkeysSettingsSection
            keybindings={serverConfigQuery.data?.keybindings ?? []}
            issues={serverConfigQuery.data?.issues ?? []}
            keybindingsConfigPath={keybindingsConfigPath}
            isOpeningKeybindings={isOpeningKeybindings}
            openKeybindingsError={openKeybindingsError}
            onOpenKeybindingsFile={openKeybindingsFile}
            onReplaceKeybindingRules={replaceKeybindingRules}
          />
        )}

        {activeSection === "environment" && (
          <SettingsSection
            title="Environment"
            description="Global and per-project environment variables for sessions."
          >
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
          </SettingsSection>
        )}

        {activeSection === "projects" && (
          <SettingsSection
            title="Projects"
            description="Per-project variables and sidebar icon overrides."
          >
            <SettingsRow
              title="Project"
              description="Choose the project you want to configure."
              status={
                selectedProject ? (
                  <span className="block break-all font-mono text-[11px] text-foreground">
                    {selectedProject.name} · {selectedProject.cwd}
                  </span>
                ) : (
                  <span className="block">Open a project to edit project settings.</span>
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
                          <div className="flex min-w-0 items-center gap-2">
                            <ProjectIcon
                              cwd={project.cwd}
                              iconPath={project.iconPath ?? null}
                              className="size-4"
                            />
                            <div className="flex min-w-0 flex-col">
                              <span className="truncate">{project.name}</span>
                              <span className="truncate text-[11px] text-muted-foreground">
                                {project.cwd}
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">No projects available.</span>
                )
              }
            />

            <SettingsRow
              title="Project variables"
              description="Saved per project and merged on top of the global set when that project launches a provider, terminal, or helper command."
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

            <SettingsRow
              title="Project icon"
              description="Override the icon shown next to this project in the sidebar. Use a path relative to the project root or an absolute image URL, such as `public/icon.svg` or `https://example.com/icon.png`."
              status={
                selectedProject ? (
                  <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                    <ProjectIcon
                      cwd={selectedProject.cwd}
                      iconPath={projectIconDraft.trim() || selectedProject.iconPath || null}
                      className="size-4"
                    />
                    {projectIconDraft.trim().length > 0
                      ? projectIconDraft.trim()
                      : (selectedProject.iconPath ?? "Using the project favicon")}
                  </span>
                ) : (
                  <span className="block">Open or create a project to edit the icon.</span>
                )
              }
              control={
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  <Input
                    value={projectIconDraft}
                    onChange={(event) => setProjectIconDraft(event.target.value)}
                    onBlur={() => {
                      void saveProjectIconOverride();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveProjectIconOverride();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        setProjectIconDraft(selectedProject?.iconPath ?? "");
                      }
                    }}
                    placeholder="public/icon.svg or https://example.com/icon.png"
                    className="w-full sm:w-64"
                    aria-label="Project icon path"
                    disabled={!selectedProject}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleFileChange(event);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedProject}
                    onClick={openFilePicker}
                  >
                    Choose image
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !selectedProject ||
                      projectIconDraft.trim() === (selectedProject?.iconPath ?? "")
                    }
                    onClick={() => {
                      void saveProjectIconOverride();
                    }}
                  >
                    Save
                  </Button>
                </div>
              }
            />
          </SettingsSection>
        )}

        {activeSection === "git" && (
          <SettingsSection
            title="Git"
            description="Version control behavior and commit preferences."
          >
            <SettingsRow
              title="Rebase before commit"
              description="Before commit actions run, rebase the current branch onto the repository default branch, usually main. OK Code uses autostash so your local edits can be restored after the rebase."
              resetAction={
                settings.rebaseBeforeCommit !== defaults.rebaseBeforeCommit ? (
                  <SettingResetButton
                    label="rebase before commit"
                    onClick={() =>
                      updateSettings({
                        rebaseBeforeCommit: defaults.rebaseBeforeCommit,
                      })
                    }
                  />
                ) : null
              }
              control={
                <Switch
                  checked={settings.rebaseBeforeCommit}
                  onCheckedChange={(checked) =>
                    updateSettings({
                      rebaseBeforeCommit: Boolean(checked),
                    })
                  }
                  aria-label="Rebase onto the default branch before committing"
                />
              }
            />
          </SettingsSection>
        )}

        {activeSection === "models" && (
          <SettingsSection
            title="Models"
            description="Configure AI model providers and custom model slugs."
          >
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
                  <SelectTrigger className="w-full sm:w-52" aria-label="Git text generation model">
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
              description="Add custom model slugs for Codex, Claude Code, Gemini CLI, GitHub Copilot, or OpenClaw. The chat picker groups models by provider."
              resetAction={
                totalCustomModels > 0 ? (
                  <SettingResetButton
                    label="custom models"
                    onClick={() => {
                      updateSettings({
                        customCodexModels: defaults.customCodexModels,
                        customClaudeModels: defaults.customClaudeModels,
                        customCopilotModels: defaults.customCopilotModels,
                        customGeminiModels: defaults.customGeminiModels,
                        customOpenClawModels: defaults.customOpenClawModels,
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
                      setSelectedCustomModelProvider(value as ProviderKind);
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

            <SettingsRow
              title="Codex backends"
              description="Read-only guidance for the Codex `model_provider` backend catalog detected from your local Codex config."
            >
              <div className="mt-4">
                <CodexBackendSection summary={serverConfigQuery.data?.codexConfig} />
              </div>
            </SettingsRow>
          </SettingsSection>
        )}

        {activeSection === "mobile" && !isMobileShell && (
          <SettingsSection
            title="Mobile Companion"
            description="Pair your phone with the OK Code mobile app."
          >
            <SettingsRow
              title="Pair mobile device"
              description="Copy this pairing link and open it in the OK Code mobile app to pair your phone."
            >
              <div className="mt-4 flex justify-center">
                <PairingLink />
              </div>
            </SettingsRow>
          </SettingsSection>
        )}

        {activeSection === "advanced" && (
          <SettingsSection title="Advanced" description="Build metadata and low-level diagnostics.">
            <SettingsRow
              title="Build"
              description="Current app-shell and server build metadata."
              control={
                <div className="grid w-full gap-3 text-left sm:max-w-xl sm:grid-cols-2 sm:gap-5">
                  <BuildInfoBlock label="App" buildInfo={APP_BUILD_INFO} />
                  {serverConfigQuery.data?.buildInfo ? (
                    <BuildInfoBlock label="Server" buildInfo={serverConfigQuery.data.buildInfo} />
                  ) : null}
                </div>
              }
            />
          </SettingsSection>
        )}
      </div>
    </SettingsShell>
  );
}

export const Route = createFileRoute("/_chat/settings/")({
  validateSearch: (search: Record<string, unknown>): { section?: SettingsSectionId } => {
    const section = search.section;
    if (
      section === "general" ||
      section === "authentication" ||
      section === "hotkeys" ||
      section === "environment" ||
      section === "projects" ||
      section === "git" ||
      section === "models" ||
      section === "mobile" ||
      section === "advanced"
    ) {
      return section === "general" ? {} : { section };
    }
    return {};
  },
  component: SettingsRouteView,
});
