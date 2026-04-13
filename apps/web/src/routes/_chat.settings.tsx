import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CpuIcon,
  GitBranchIcon,
  ImportIcon,
  Loader2Icon,
  PaletteIcon,
  PlusIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  SmartphoneIcon,
  Undo2Icon,
  VariableIcon,
  WrenchIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { TestOpenclawGatewayHostKind, TestOpenclawGatewayResult } from "@okcode/contracts";
import {
  type BuildMetadata,
  type ProjectId,
  type ProviderKind,
  DEFAULT_GIT_TEXT_GENERATION_MODEL,
} from "@okcode/contracts";
import { getModelOptions, normalizeModelSlug } from "@okcode/shared/model";
import {
  DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE,
  getAppModelOptions,
  getCustomModelsForProvider,
  MAX_CUSTOM_MODEL_LENGTH,
  MODEL_PROVIDER_SETTINGS,
  patchCustomModels,
  PrReviewRequestChangesTone,
  useAppSettings,
} from "../appSettings";
import { APP_BUILD_INFO } from "../branding";
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
import { CustomThemeDialog } from "../components/CustomThemeDialog";
import { resolveAndPersistPreferredEditor } from "../editorPreferences";
import { isElectron, isMobileShell } from "../env";
import { useTheme, COLOR_THEMES, DEFAULT_COLOR_THEME, FONT_FAMILIES } from "../hooks/useTheme";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import {
  environmentVariablesQueryKeys,
  globalEnvironmentVariablesQueryOptions,
  projectEnvironmentVariablesQueryOptions,
} from "../lib/environmentVariablesReactQuery";
import {
  applyCustomTheme,
  clearFontOverride,
  clearFontSizeOverride,
  clearRadiusOverride,
  clearStoredCustomTheme,
  getStoredCustomTheme,
  getStoredFontOverride,
  getStoredFontSizeOverride,
  getStoredRadiusOverride,
  removeCustomTheme,
  setStoredFontOverride,
  setStoredFontSizeOverride,
  setStoredRadiusOverride,
  type CustomThemeData,
} from "../lib/customTheme";
import {
  openclawGatewayConfigQueryOptions,
  serverConfigQueryOptions,
  serverQueryKeys,
} from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { ensureNativeApi, readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { PairingLink } from "../components/mobile/PairingLink";

// ---------------------------------------------------------------------------
// Settings navigation sections
// ---------------------------------------------------------------------------
type SettingsSectionId = "general" | "environment" | "git" | "models" | "mobile" | "advanced";

interface SettingsNavItem {
  id: SettingsSectionId;
  label: string;
  icon: ReactNode;
  hidden?: boolean;
}

function useSettingsNavItems(): SettingsNavItem[] {
  return [
    { id: "general", label: "General", icon: <PaletteIcon className="size-4" /> },
    { id: "environment", label: "Environment", icon: <VariableIcon className="size-4" /> },
    { id: "git", label: "Git", icon: <GitBranchIcon className="size-4" /> },
    { id: "models", label: "Models", icon: <CpuIcon className="size-4" /> },
    {
      id: "mobile",
      label: "Mobile Companion",
      icon: <SmartphoneIcon className="size-4" />,
      hidden: isMobileShell,
    },
    { id: "advanced", label: "Advanced", icon: <WrenchIcon className="size-4" /> },
  ];
}

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

function SettingsSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground">
        {children}
      </div>
    </section>
  );
}

function SettingsNavSidebar({
  items,
  activeSection,
  onSelect,
}: {
  items: SettingsNavItem[];
  activeSection: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <nav className="flex w-52 shrink-0 flex-col gap-0.5 py-1" aria-label="Settings navigation">
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              activeSection === item.id
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
            onClick={() => onSelect(item.id)}
            aria-current={activeSection === item.id ? "page" : undefined}
          >
            <span className="flex size-5 items-center justify-center opacity-70">{item.icon}</span>
            {item.label}
          </button>
        ))}
    </nav>
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

function BackgroundImageSettings({
  backgroundImageUrl,
  backgroundImageOpacity,
  defaultBackgroundImageUrl,
  defaultBackgroundImageOpacity,
  updateSettings,
}: {
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
  defaultBackgroundImageUrl: string;
  defaultBackgroundImageOpacity: number;
  updateSettings: (patch: { backgroundImageOpacity?: number; backgroundImageUrl?: string }) => void;
}) {
  const hasBackground = backgroundImageUrl.trim().length > 0;

  const handleUrlChange = useCallback(
    (value: string) => {
      updateSettings({
        backgroundImageUrl: value,
      });
    },
    [updateSettings],
  );

  const handleOpacityChange = useCallback(
    (value: number) => {
      updateSettings({ backgroundImageOpacity: value });
    },
    [updateSettings],
  );

  const handleReset = useCallback(() => {
    updateSettings({
      backgroundImageUrl: defaultBackgroundImageUrl,
      backgroundImageOpacity: defaultBackgroundImageOpacity,
    });
  }, [defaultBackgroundImageOpacity, defaultBackgroundImageUrl, updateSettings]);

  return (
    <>
      <SettingsRow
        title="Background image"
        description="Set a custom background image URL. Supports any image URL."
        resetAction={
          hasBackground ? (
            <SettingResetButton label="background image" onClick={handleReset} />
          ) : null
        }
        control={
          <Input
            value={backgroundImageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full sm:w-56"
            aria-label="Background image URL"
          />
        }
      />
      {hasBackground && (
        <SettingsRow
          title="Background opacity"
          description="Adjust the visibility of the custom background image."
          control={
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(backgroundImageOpacity * 100)}
                onChange={(e) => {
                  const value = Number(e.target.value) / 100;
                  handleOpacityChange(value);
                }}
                className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                aria-label="Background opacity"
              />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(backgroundImageOpacity * 100)}%
              </span>
            </div>
          }
        />
      )}
    </>
  );
}

function SettingsRouteView() {
  const { theme, setTheme, colorTheme, setColorTheme, fontFamily, setFontFamily } = useTheme();
  const { settings, defaults, updateSettings, resetSettings } = useAppSettings();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const openclawGatewayConfigQuery = useQuery(openclawGatewayConfigQueryOptions());
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
    openclaw: Boolean(settings.openclawGatewayUrl || settings.openclawPassword),
  });
  const [selectedCustomModelProvider, setSelectedCustomModelProvider] =
    useState<ProviderKind>("codex");
  const [customModelInputByProvider, setCustomModelInputByProvider] = useState<
    Record<ProviderKind, string>
  >({
    codex: "",
    claudeAgent: "",
    openclaw: "",
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
  const [fontSizeOverride, setFontSizeOverrideState] = useState<number | null>(() =>
    getStoredFontSizeOverride(),
  );
  const [openclawTestResult, setOpenclawTestResult] = useState<TestOpenclawGatewayResult | null>(
    null,
  );
  const [openclawTestLoading, setOpenclawTestLoading] = useState(false);
  const [openclawGatewayDraft, setOpenclawGatewayDraft] = useState<string | null>(null);
  const [openclawSharedSecretDraft, setOpenclawSharedSecretDraft] = useState("");
  const [openclawSaveLoading, setOpenclawSaveLoading] = useState(false);
  const [openclawResetLoading, setOpenclawResetLoading] = useState<"token" | "identity" | null>(
    null,
  );
  const { copyToClipboard: copyOpenclawDebugReport, isCopied: openclawDebugReportCopied } =
    useCopyToClipboard();

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
  const savedOpenclawGatewayUrl = openclawGatewayConfigQuery.data?.gatewayUrl ?? "";
  const savedOpenclawHasSharedSecret = openclawGatewayConfigQuery.data?.hasSharedSecret ?? false;
  const effectiveOpenclawGatewayUrl = openclawGatewayDraft ?? savedOpenclawGatewayUrl;
  const isOpenClawSettingsDirty =
    (openclawGatewayDraft !== null && openclawGatewayDraft !== savedOpenclawGatewayUrl) ||
    openclawSharedSecretDraft.length > 0;
  const canImportLegacyOpenclawSettings =
    openclawGatewayConfigQuery.isSuccess &&
    !savedOpenclawGatewayUrl &&
    Boolean(settings.openclawGatewayUrl?.trim());
  const changedSettingLabels = [
    ...(theme !== "system" ? ["Theme"] : []),
    ...(colorTheme !== DEFAULT_COLOR_THEME ? ["Color theme"] : []),
    ...(fontFamily !== "inter" ? ["Font"] : []),
    ...(settings.prReviewRequestChangesTone !== DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE
      ? ["PR request changes button"]
      : []),
    ...(settings.timestampFormat !== defaults.timestampFormat ? ["Time format"] : []),
    ...(settings.showStitchBorder !== defaults.showStitchBorder ? ["Stitch border"] : []),
    ...(settings.enableAssistantStreaming !== defaults.enableAssistantStreaming
      ? ["Assistant output"]
      : []),
    ...(settings.showReasoningContent !== defaults.showReasoningContent
      ? ["Reasoning content"]
      : []),
    ...(settings.showAuthFailuresAsErrors !== defaults.showAuthFailuresAsErrors
      ? ["Auth failure errors"]
      : []),
    ...(settings.openLinksExternally !== defaults.openLinksExternally
      ? ["Open links externally"]
      : []),
    ...(settings.codeViewerAutosave !== defaults.codeViewerAutosave
      ? ["Code preview autosave"]
      : []),
    ...(settings.defaultThreadEnvMode !== defaults.defaultThreadEnvMode ? ["New thread mode"] : []),
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
    settings.customOpenClawModels.length > 0
      ? ["Custom models"]
      : []),
    ...(isInstallSettingsDirty ? ["Provider installs"] : []),
    ...(isOpenClawSettingsDirty ? ["OpenClaw gateway"] : []),
    ...(settings.backgroundImageUrl !== defaults.backgroundImageUrl ? ["Background image"] : []),
    ...(settings.backgroundImageOpacity !== defaults.backgroundImageOpacity
      ? ["Background opacity"]
      : []),
    ...(radiusOverride !== null ? ["Border radius"] : []),
    ...(fontOverride ? ["Font family"] : []),
    ...(fontSizeOverride !== null ? ["Font size"] : []),
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

  const testOpenclawGateway = useCallback(async () => {
    if (openclawTestLoading) return;
    setOpenclawTestLoading(true);
    setOpenclawTestResult(null);
    try {
      const api = ensureNativeApi();
      const gatewayUrl = effectiveOpenclawGatewayUrl.trim();
      const sharedSecret = openclawSharedSecretDraft.trim();
      const result = await api.server.testOpenclawGateway({
        ...(gatewayUrl ? { gatewayUrl } : {}),
        ...(sharedSecret ? { password: sharedSecret } : {}),
      });
      setOpenclawTestResult(result);
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
  }, [effectiveOpenclawGatewayUrl, openclawSharedSecretDraft, openclawTestLoading]);

  const handleCopyOpenclawDebugReport = useCallback(() => {
    if (!openclawTestResult) return;
    copyOpenclawDebugReport(formatOpenclawGatewayDebugReport(openclawTestResult), undefined);
  }, [copyOpenclawDebugReport, openclawTestResult]);

  const saveOpenclawGatewayConfig = useCallback(async () => {
    if (openclawSaveLoading) return;
    const gatewayUrl = effectiveOpenclawGatewayUrl.trim();
    if (!gatewayUrl) {
      throw new Error("Gateway URL is required.");
    }
    setOpenclawSaveLoading(true);
    try {
      const api = ensureNativeApi();
      const sharedSecret = openclawSharedSecretDraft.trim();
      const summary = await api.server.saveOpenclawGatewayConfig({
        gatewayUrl,
        ...(sharedSecret ? { sharedSecret } : {}),
      });
      queryClient.setQueryData(serverQueryKeys.openclawGatewayConfig(), summary);
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
      setOpenclawGatewayDraft(null);
      setOpenclawSharedSecretDraft("");
      setOpenclawTestResult(null);
    } finally {
      setOpenclawSaveLoading(false);
    }
  }, [effectiveOpenclawGatewayUrl, openclawSaveLoading, openclawSharedSecretDraft, queryClient]);

  const clearSavedOpenclawSharedSecret = useCallback(async () => {
    const gatewayUrl = effectiveOpenclawGatewayUrl.trim();
    if (!gatewayUrl) {
      throw new Error("Gateway URL is required.");
    }
    setOpenclawSaveLoading(true);
    try {
      const api = ensureNativeApi();
      const summary = await api.server.saveOpenclawGatewayConfig({
        gatewayUrl,
        clearSharedSecret: true,
      });
      queryClient.setQueryData(serverQueryKeys.openclawGatewayConfig(), summary);
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
      setOpenclawSharedSecretDraft("");
      setOpenclawTestResult(null);
    } finally {
      setOpenclawSaveLoading(false);
    }
  }, [effectiveOpenclawGatewayUrl, queryClient]);

  const resetOpenclawDeviceState = useCallback(
    async (regenerateIdentity: boolean) => {
      if (openclawResetLoading) return;
      setOpenclawResetLoading(regenerateIdentity ? "identity" : "token");
      try {
        const api = ensureNativeApi();
        const summary = await api.server.resetOpenclawGatewayDeviceState({
          regenerateIdentity,
        });
        queryClient.setQueryData(serverQueryKeys.openclawGatewayConfig(), summary);
        void queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
        setOpenclawTestResult(null);
      } finally {
        setOpenclawResetLoading(null);
      }
    },
    [openclawResetLoading, queryClient],
  );

  const importLegacyOpenclawSettings = useCallback(async () => {
    const gatewayUrl = settings.openclawGatewayUrl.trim();
    if (!gatewayUrl) {
      throw new Error("Legacy OpenClaw settings do not contain a gateway URL.");
    }
    setOpenclawSaveLoading(true);
    try {
      const api = ensureNativeApi();
      const sharedSecret = settings.openclawPassword.trim();
      const summary = await api.server.saveOpenclawGatewayConfig({
        gatewayUrl,
        ...(sharedSecret ? { sharedSecret } : {}),
      });
      queryClient.setQueryData(serverQueryKeys.openclawGatewayConfig(), summary);
      void queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
      updateSettings({
        openclawGatewayUrl: defaults.openclawGatewayUrl,
        openclawPassword: defaults.openclawPassword,
      });
      setOpenclawGatewayDraft(null);
      setOpenclawSharedSecretDraft("");
      setOpenclawTestResult(null);
    } finally {
      setOpenclawSaveLoading(false);
    }
  }, [
    defaults.openclawGatewayUrl,
    defaults.openclawPassword,
    queryClient,
    settings.openclawGatewayUrl,
    settings.openclawPassword,
    updateSettings,
  ]);

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
    setColorTheme(DEFAULT_COLOR_THEME);
    setFontFamily("inter");
    resetSettings();
    setOpenInstallProviders({
      codex: false,
      claudeAgent: false,
      openclaw: false,
    });
    setSelectedCustomModelProvider("codex");
    setCustomModelInputByProvider({
      codex: "",
      claudeAgent: "",
      openclaw: "",
    });
    setCustomModelErrorByProvider({});

    // Reset custom theme + overrides
    clearStoredCustomTheme();
    removeCustomTheme();
    clearRadiusOverride();
    setRadiusOverrideState(null);
    clearFontOverride();
    setFontOverrideState("");
    clearFontSizeOverride();
    setFontSizeOverrideState(null);
  }

  const navItems = useSettingsNavItems();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const activeSectionLabel = navItems.find((item) => item.id === activeSection)?.label ?? "General";

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {/* Header */}
        {!isElectron && (
          <header className="border-b border-border/60 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="size-7 shrink-0" />
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-medium text-foreground">Settings</span>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-muted-foreground">{activeSectionLabel}</span>
              </div>
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
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border/60 px-5">
            <div className="flex items-center gap-1.5 text-xs font-medium tracking-wide">
              <span className="text-muted-foreground/70">Settings</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-muted-foreground/70">{activeSectionLabel}</span>
            </div>
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

        {/* Body: sidebar + content */}
        <div className="flex min-h-0 flex-1">
          {/* Settings sidebar navigation */}
          <aside className="hidden w-56 shrink-0 border-r border-border/60 px-3 py-4 md:block overflow-y-auto">
            <SettingsNavSidebar
              items={navItems}
              activeSection={activeSection}
              onSelect={setActiveSection}
            />
          </aside>

          {/* Main content area */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Mobile section selector (visible on small screens) */}
            <div className="border-b border-border/60 px-4 py-2 md:hidden">
              <Select
                value={activeSection}
                onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
              >
                <SelectTrigger className="w-full" aria-label="Settings section">
                  <SelectValue>{activeSectionLabel}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {navItems
                    .filter((item) => !item.hidden)
                    .map((item) => (
                      <SelectItem hideIndicator key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                </SelectPopup>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl p-6 sm:p-8">
                {activeSection === "general" && (
                  <SettingsSection
                    title="General"
                    description="Appearance, behavior, and UI preferences."
                  >
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
                              {THEME_OPTIONS.find((option) => option.value === theme)?.label ??
                                "System"}
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
                        colorTheme !== DEFAULT_COLOR_THEME ? (
                          <SettingResetButton
                            label="color theme"
                            onClick={() => {
                              setColorTheme(DEFAULT_COLOR_THEME);
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
                      title="Font size"
                      description="Adjust the font size for code editors and terminal."
                      resetAction={
                        fontSizeOverride !== null ? (
                          <SettingResetButton
                            label="font size"
                            onClick={() => {
                              clearFontSizeOverride();
                              setFontSizeOverrideState(null);
                            }}
                          />
                        ) : null
                      }
                      control={
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={10}
                            max={20}
                            step={1}
                            value={fontSizeOverride ?? 12}
                            onChange={(e) => {
                              const value = Number.parseFloat(e.target.value);
                              setFontSizeOverrideState(value);
                              setStoredFontSizeOverride(value);
                            }}
                            className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                            aria-label="Font size"
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                            {fontSizeOverride ?? 12}px
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
                      title="Sidebar opacity"
                      description="Adjust the transparency of the side panel and project list."
                      resetAction={
                        settings.sidebarOpacity !== defaults.sidebarOpacity ? (
                          <SettingResetButton
                            label="sidebar opacity"
                            onClick={() =>
                              updateSettings({ sidebarOpacity: defaults.sidebarOpacity })
                            }
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

                    <BackgroundImageSettings
                      backgroundImageOpacity={settings.backgroundImageOpacity}
                      backgroundImageUrl={settings.backgroundImageUrl}
                      defaultBackgroundImageOpacity={defaults.backgroundImageOpacity}
                      defaultBackgroundImageUrl={defaults.backgroundImageUrl}
                      updateSettings={updateSettings}
                    />

                    <SettingsRow
                      title="Accent project names"
                      description="Use the theme's accent color for project names in the sidebar."
                      resetAction={
                        settings.sidebarAccentProjectNames !==
                        defaults.sidebarAccentProjectNames ? (
                          <SettingResetButton
                            label="accent project names"
                            onClick={() =>
                              updateSettings({
                                sidebarAccentProjectNames: defaults.sidebarAccentProjectNames,
                              })
                            }
                          />
                        ) : null
                      }
                      control={
                        <Switch
                          checked={settings.sidebarAccentProjectNames}
                          onCheckedChange={(checked) =>
                            updateSettings({
                              sidebarAccentProjectNames: Boolean(checked),
                            })
                          }
                          aria-label="Accent project names"
                        />
                      }
                    />

                    <SettingsRow
                      title="Accent color override"
                      description="Set a custom color for accented project names instead of the theme default."
                      resetAction={
                        settings.sidebarAccentColorOverride ? (
                          <SettingResetButton
                            label="accent color override"
                            onClick={() =>
                              updateSettings({
                                sidebarAccentColorOverride: undefined,
                              })
                            }
                          />
                        ) : null
                      }
                      control={
                        <div className="flex items-center gap-2">
                          <label
                            className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
                            style={{
                              backgroundColor:
                                settings.sidebarAccentColorOverride || "var(--accent-foreground)",
                            }}
                          >
                            <input
                              type="color"
                              value={settings.sidebarAccentColorOverride || "#000000"}
                              onChange={(e) =>
                                updateSettings({
                                  sidebarAccentColorOverride: e.target.value,
                                })
                              }
                              className="absolute inset-0 cursor-pointer opacity-0"
                              aria-label="Accent color picker"
                            />
                          </label>
                          <input
                            type="text"
                            value={settings.sidebarAccentColorOverride ?? ""}
                            placeholder="Theme default"
                            onChange={(e) => {
                              const value = e.target.value.trim();
                              updateSettings({
                                sidebarAccentColorOverride: value || undefined,
                              });
                            }}
                            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring sm:w-32"
                            aria-label="Accent color value"
                          />
                        </div>
                      }
                    />

                    <SettingsRow
                      title="Accent background override"
                      description="Set a custom background color for project headers instead of the theme default."
                      resetAction={
                        settings.sidebarAccentBgColorOverride ? (
                          <SettingResetButton
                            label="accent background override"
                            onClick={() =>
                              updateSettings({
                                sidebarAccentBgColorOverride: undefined,
                              })
                            }
                          />
                        ) : null
                      }
                      control={
                        <div className="flex items-center gap-2">
                          <label
                            className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
                            style={{
                              backgroundColor:
                                settings.sidebarAccentBgColorOverride || "var(--accent)",
                            }}
                          >
                            <input
                              type="color"
                              value={settings.sidebarAccentBgColorOverride || "#000000"}
                              onChange={(e) =>
                                updateSettings({
                                  sidebarAccentBgColorOverride: e.target.value,
                                })
                              }
                              className="absolute inset-0 cursor-pointer opacity-0"
                              aria-label="Accent background color picker"
                            />
                          </label>
                          <input
                            type="text"
                            value={settings.sidebarAccentBgColorOverride ?? ""}
                            placeholder="Theme default"
                            onChange={(e) => {
                              const value = e.target.value.trim();
                              updateSettings({
                                sidebarAccentBgColorOverride: value || undefined,
                              });
                            }}
                            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring sm:w-32"
                            aria-label="Accent background color value"
                          />
                        </div>
                      }
                    />

                    <SettingsRow
                      title="PR request changes button"
                      description="Choose how prominent the Request changes action looks in pull request review."
                      resetAction={
                        settings.prReviewRequestChangesTone !==
                        DEFAULT_PR_REVIEW_REQUEST_CHANGES_TONE ? (
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
                          <SelectTrigger
                            className="w-full sm:w-40"
                            aria-label="PR request changes button"
                          >
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
                            if (value !== "locale" && value !== "12-hour" && value !== "24-hour") {
                              return;
                            }
                            updateSettings({
                              timestampFormat: value,
                            });
                          }}
                        >
                          <SelectTrigger className="w-full sm:w-40" aria-label="Timestamp format">
                            <SelectValue>
                              {TIMESTAMP_FORMAT_LABELS[settings.timestampFormat]}
                            </SelectValue>
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
                      title="Stitch border"
                      description="Show the decorative stitch border around the viewport."
                      resetAction={
                        settings.showStitchBorder !== defaults.showStitchBorder ? (
                          <SettingResetButton
                            label="stitch border"
                            onClick={() =>
                              updateSettings({
                                showStitchBorder: defaults.showStitchBorder,
                              })
                            }
                          />
                        ) : null
                      }
                      control={
                        <Switch
                          checked={settings.showStitchBorder}
                          onCheckedChange={(checked) =>
                            updateSettings({
                              showStitchBorder: Boolean(checked),
                            })
                          }
                          aria-label="Show stitch border"
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
                          <SelectTrigger
                            className="w-full sm:w-44"
                            aria-label="Default thread mode"
                          >
                            <SelectValue>
                              {settings.defaultThreadEnvMode === "worktree"
                                ? "New worktree"
                                : "Local"}
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
                        settings.autoUpdateWorktreeBaseBranch !==
                        defaults.autoUpdateWorktreeBaseBranch ? (
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
                          <span className="text-xs text-muted-foreground">
                            No projects available.
                          </span>
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
                          <p className="mt-2 text-xs text-destructive">
                            {selectedCustomModelError}
                          </p>
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
                  <SettingsSection
                    title="Advanced"
                    description="Provider paths, keybindings, and build info."
                  >
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
                                        [providerSettings.provider]:
                                          !existing[providerSettings.provider],
                                      }))
                                    }
                                  >
                                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                                      {providerSettings.title}
                                    </span>
                                    {isDirty ? (
                                      <span className="text-[11px] text-muted-foreground">
                                        Custom
                                      </span>
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
                                                providerSettings.binaryPathKey ===
                                                  "claudeBinaryPath"
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
                      title="OpenClaw gateway"
                      description="Connect to an OpenClaw gateway for remote agent sessions."
                      resetAction={
                        isOpenClawSettingsDirty ? (
                          <SettingResetButton
                            label="OpenClaw gateway"
                            onClick={() => {
                              setOpenclawGatewayDraft(null);
                              setOpenclawSharedSecretDraft("");
                              setOpenclawTestResult(null);
                            }}
                          />
                        ) : null
                      }
                    >
                      <div className="mt-4 space-y-3">
                        {canImportLegacyOpenclawSettings ? (
                          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <span>
                                Legacy browser-local OpenClaw settings were found. Import them to
                                the server to make them active.
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={openclawSaveLoading}
                                onClick={() => {
                                  void importLegacyOpenclawSettings();
                                }}
                              >
                                <ImportIcon className="mr-1.5 size-3.5" />
                                Import legacy settings
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        <label htmlFor="openclaw-gateway-url" className="block">
                          <span className="block text-xs font-medium text-foreground">
                            Gateway URL
                          </span>
                          <Input
                            id="openclaw-gateway-url"
                            className="mt-1"
                            value={effectiveOpenclawGatewayUrl}
                            onChange={(event) => {
                              setOpenclawGatewayDraft(event.target.value);
                              setOpenclawTestResult(null);
                            }}
                            placeholder="ws://localhost:8080"
                            spellCheck={false}
                          />
                          <span className="mt-1 block text-xs text-muted-foreground">
                            WebSocket URL of the OpenClaw gateway. Leave blank when not using
                            OpenClaw.
                          </span>
                        </label>
                        <label htmlFor="openclaw-password" className="block">
                          <span className="block text-xs font-medium text-foreground">
                            Shared secret
                          </span>
                          <Input
                            id="openclaw-password"
                            className="mt-1"
                            type="password"
                            value={openclawSharedSecretDraft}
                            onChange={(event) => {
                              setOpenclawSharedSecretDraft(event.target.value);
                              setOpenclawTestResult(null);
                            }}
                            placeholder={
                              savedOpenclawHasSharedSecret
                                ? "Leave blank to keep existing secret"
                                : "Shared secret"
                            }
                            spellCheck={false}
                            autoComplete="off"
                          />
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Shared secret used for gateway auth. Leave blank to keep the saved
                            secret unchanged.
                          </span>
                        </label>

                        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                          <div>
                            Saved URL:{" "}
                            <span className="font-mono text-foreground">
                              {openclawGatewayConfigQuery.data?.gatewayUrl ?? "Not saved"}
                            </span>
                          </div>
                          <div>
                            Saved shared secret:{" "}
                            <span className="text-foreground">
                              {savedOpenclawHasSharedSecret ? "Configured" : "Not configured"}
                            </span>
                          </div>
                          <div>
                            Device fingerprint:{" "}
                            <span className="font-mono text-foreground">
                              {openclawGatewayConfigQuery.data?.deviceFingerprint ?? "Not created"}
                            </span>
                          </div>
                          <div>
                            Cached device token:{" "}
                            <span className="text-foreground">
                              {openclawGatewayConfigQuery.data?.hasDeviceToken
                                ? "Present"
                                : "Not cached"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            variant="default"
                            size="sm"
                            disabled={!effectiveOpenclawGatewayUrl.trim() || openclawSaveLoading}
                            onClick={() => {
                              void saveOpenclawGatewayConfig();
                            }}
                          >
                            {openclawSaveLoading ? (
                              <>
                                <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                                Saving…
                              </>
                            ) : (
                              "Save gateway config"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              (!effectiveOpenclawGatewayUrl.trim() &&
                                !openclawGatewayConfigQuery.data?.gatewayUrl) ||
                              openclawTestLoading
                            }
                            onClick={() => {
                              void testOpenclawGateway();
                            }}
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
                          {savedOpenclawHasSharedSecret ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!effectiveOpenclawGatewayUrl.trim() || openclawSaveLoading}
                              onClick={() => {
                                void clearSavedOpenclawSharedSecret();
                              }}
                            >
                              Clear saved secret
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              !openclawGatewayConfigQuery.data?.gatewayUrl ||
                              Boolean(openclawResetLoading)
                            }
                            onClick={() => {
                              void resetOpenclawDeviceState(false);
                            }}
                          >
                            {openclawResetLoading === "token" ? "Resetting token…" : "Reset token"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              !openclawGatewayConfigQuery.data?.gatewayUrl ||
                              Boolean(openclawResetLoading)
                            }
                            onClick={() => {
                              void resetOpenclawDeviceState(true);
                            }}
                          >
                            {openclawResetLoading === "identity"
                              ? "Regenerating identity…"
                              : "Regenerate identity"}
                          </Button>
                        </div>

                        {/* Debug / Results Panel */}
                        {openclawTestResult && (
                          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
                            {/* Overall status header */}
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
                                {openclawTestResult.success
                                  ? "Connection successful"
                                  : "Connection failed"}
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

                            {/* Step-by-step results */}
                            {openclawTestResult.steps.length > 0 && (
                              <div className="mt-2.5 space-y-1.5">
                                {openclawTestResult.steps.map((step) => (
                                  <div
                                    key={`${step.name}-${step.status}-${step.durationMs}`}
                                    className="flex items-start gap-2 text-xs"
                                  >
                                    {step.status === "pass" && (
                                      <CheckCircle2Icon className="mt-px size-3.5 shrink-0 text-emerald-500" />
                                    )}
                                    {step.status === "fail" && (
                                      <XCircleIcon className="mt-px size-3.5 shrink-0 text-red-500" />
                                    )}
                                    {step.status === "skip" && (
                                      <SkipForwardIcon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-baseline gap-2">
                                        <span className="font-medium text-foreground">
                                          {step.name}
                                        </span>
                                        <span className="tabular-nums text-muted-foreground text-[10px]">
                                          {step.durationMs}ms
                                        </span>
                                      </div>
                                      {step.detail && (
                                        <span className="block break-all text-muted-foreground">
                                          {step.detail}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Server info */}
                            {openclawTestResult.serverInfo && (
                              <div className="mt-2.5 border-t border-border pt-2">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                  Server Info
                                </span>
                                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {openclawTestResult.serverInfo.version && (
                                    <div>
                                      Version:{" "}
                                      <span className="font-mono text-foreground">
                                        {openclawTestResult.serverInfo.version}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.serverInfo.sessionId && (
                                    <div>
                                      Session:{" "}
                                      <span className="font-mono text-foreground">
                                        {openclawTestResult.serverInfo.sessionId}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {openclawTestResult.diagnostics && (
                              <div className="mt-2.5 border-t border-border pt-2">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                  Debugging Context
                                </span>
                                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {openclawTestResult.diagnostics.normalizedUrl && (
                                    <div>
                                      Endpoint:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.normalizedUrl}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.hostKind && (
                                    <div>
                                      Host type:{" "}
                                      <span className="text-foreground">
                                        {describeOpenclawGatewayHostKind(
                                          openclawTestResult.diagnostics.hostKind,
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.resolvedAddresses.length > 0 && (
                                    <div>
                                      Resolved:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.resolvedAddresses.join(
                                          ", ",
                                        )}
                                      </span>
                                    </div>
                                  )}
                                  {describeOpenclawGatewayHealthStatus(openclawTestResult) && (
                                    <div>
                                      Health probe:{" "}
                                      <span className="text-foreground">
                                        {describeOpenclawGatewayHealthStatus(openclawTestResult)}
                                      </span>
                                      {openclawTestResult.diagnostics.healthUrl && (
                                        <>
                                          {" "}
                                          at{" "}
                                          <span className="break-all font-mono text-foreground">
                                            {openclawTestResult.diagnostics.healthUrl}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.socketCloseCode !== undefined && (
                                    <div>
                                      Socket close:{" "}
                                      <span className="text-foreground">
                                        {openclawTestResult.diagnostics.socketCloseCode}
                                        {openclawTestResult.diagnostics.socketCloseReason
                                          ? ` (${openclawTestResult.diagnostics.socketCloseReason})`
                                          : ""}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.socketError && (
                                    <div>
                                      Socket error:{" "}
                                      <span className="break-all text-foreground">
                                        {openclawTestResult.diagnostics.socketError}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.gatewayErrorCode && (
                                    <div>
                                      Gateway error code:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.gatewayErrorCode}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.gatewayErrorDetailCode && (
                                    <div>
                                      Gateway detail code:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.gatewayErrorDetailCode}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.gatewayErrorDetailReason && (
                                    <div>
                                      Gateway detail reason:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.gatewayErrorDetailReason}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.gatewayRecommendedNextStep && (
                                    <div>
                                      Gateway next step:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.gatewayRecommendedNextStep}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.gatewayCanRetryWithDeviceToken !==
                                    undefined && (
                                    <div>
                                      Device-token retry available:{" "}
                                      <span className="text-foreground">
                                        {openclawTestResult.diagnostics
                                          .gatewayCanRetryWithDeviceToken
                                          ? "Yes"
                                          : "No"}
                                      </span>
                                    </div>
                                  )}
                                  {openclawTestResult.diagnostics.observedNotifications.length >
                                    0 && (
                                    <div>
                                      Gateway events:{" "}
                                      <span className="break-all font-mono text-foreground">
                                        {openclawTestResult.diagnostics.observedNotifications.join(
                                          ", ",
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {openclawTestResult.diagnostics &&
                              openclawTestResult.diagnostics.hints.length > 0 && (
                                <div className="mt-2.5 border-t border-border pt-2">
                                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                    Troubleshooting
                                  </span>
                                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                                    {openclawTestResult.diagnostics.hints.map((hint) => (
                                      <li key={hint} className="flex gap-2">
                                        <span className="mt-[6px] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                                        <span>{hint}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                            {/* Error summary */}
                            {openclawTestResult.error &&
                              !openclawTestResult.steps.some((s) => s.status === "fail") && (
                                <div className="mt-2 text-xs text-red-500">
                                  {openclawTestResult.error}
                                </div>
                              )}
                          </div>
                        )}
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
                            <span className="mt-1 block text-destructive">
                              {openKeybindingsError}
                            </span>
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
                      title="Build"
                      description="Current app-shell and server build metadata."
                      control={
                        <div className="grid w-full gap-3 text-left sm:max-w-xl sm:grid-cols-2 sm:gap-5">
                          <BuildInfoBlock label="App" buildInfo={APP_BUILD_INFO} />
                          {serverConfigQuery.data?.buildInfo ? (
                            <BuildInfoBlock
                              label="Server"
                              buildInfo={serverConfigQuery.data.buildInfo}
                            />
                          ) : null}
                        </div>
                      }
                    />
                  </SettingsSection>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/settings")({
  component: SettingsRouteView,
});
