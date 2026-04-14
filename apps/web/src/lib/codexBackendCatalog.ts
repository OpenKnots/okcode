import type { ServerCodexConfigSummary } from "@okcode/contracts";
import {
  CODEX_MODEL_PROVIDER_PRESETS,
  getCodexModelProviderPreset,
  requiresOpenAiLoginForCodexModelProvider,
  type CodexModelProviderPresetKind,
} from "@okcode/shared/codexModelProviders";

export type CodexBackendStatusBadge =
  | "Configured"
  | "Defined in config"
  | "Implicit default"
  | null;
export type CodexBackendGroupId = "built-in" | "curated" | "custom";

export interface CodexBackendCatalogRow {
  readonly id: string;
  readonly title: string;
  readonly group: CodexBackendGroupId;
  readonly authNote: string;
  readonly statusBadge: CodexBackendStatusBadge;
  readonly selected: boolean;
  readonly definedInConfig: boolean;
  readonly isKnownPreset: boolean;
}

export interface CodexBackendCatalog {
  readonly parseError: string | null;
  readonly selectedModelProviderId: string | null;
  readonly effectiveSelectedModelProviderId: string;
  readonly builtIn: readonly CodexBackendCatalogRow[];
  readonly curated: readonly CodexBackendCatalogRow[];
  readonly detectedCustom: readonly CodexBackendCatalogRow[];
}

const DEFAULT_CODEX_CONFIG_SUMMARY: ServerCodexConfigSummary = {
  selectedModelProviderId: null,
  entries: [],
  parseError: null,
};

function humanizeCodexBackendId(id: string): string {
  return id
    .split(/[-_.\s]+/u)
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function toAuthNote(id: string): string {
  const preset = getCodexModelProviderPreset(id);
  const authMode = preset?.authMode;
  if (authMode === "openai-login") {
    return "OpenAI login";
  }
  if (authMode === "local") {
    return "Local backend";
  }
  if (authMode === "provider-specific") {
    return "Provider-specific credentials";
  }
  return requiresOpenAiLoginForCodexModelProvider(id)
    ? "OpenAI login"
    : "Provider-specific credentials";
}

function getStatusBadge(input: {
  readonly id: string;
  readonly selectedModelProviderId: string | null;
  readonly selected: boolean;
  readonly definedInConfig: boolean;
}): CodexBackendStatusBadge {
  if (input.selected) {
    return "Configured";
  }
  if (input.selectedModelProviderId === null && input.id === "openai") {
    return "Implicit default";
  }
  if (input.definedInConfig) {
    return "Defined in config";
  }
  return null;
}

function toPresetGroup(kind: CodexModelProviderPresetKind): Exclude<CodexBackendGroupId, "custom"> {
  return kind === "built-in" ? "built-in" : "curated";
}

function toCatalogRow(input: {
  readonly id: string;
  readonly selectedModelProviderId: string | null;
  readonly selected: boolean;
  readonly definedInConfig: boolean;
  readonly isKnownPreset: boolean;
}): CodexBackendCatalogRow {
  const preset = getCodexModelProviderPreset(input.id);

  return {
    id: input.id,
    title: preset?.title ?? humanizeCodexBackendId(input.id),
    group: preset ? toPresetGroup(preset.kind) : "custom",
    authNote: toAuthNote(input.id),
    statusBadge: getStatusBadge(input),
    selected: input.selected,
    definedInConfig: input.definedInConfig,
    isKnownPreset: input.isKnownPreset,
  };
}

export function buildCodexBackendCatalog(
  summary: ServerCodexConfigSummary | null | undefined,
): CodexBackendCatalog {
  const resolvedSummary = summary ?? DEFAULT_CODEX_CONFIG_SUMMARY;
  const dynamicEntryById = new Map(
    resolvedSummary.entries.map((entry) => [entry.id, entry] as const),
  );

  const presetRows = CODEX_MODEL_PROVIDER_PRESETS.map((preset) => {
    const dynamicEntry = dynamicEntryById.get(preset.id);
    return toCatalogRow({
      id: preset.id,
      selectedModelProviderId: resolvedSummary.selectedModelProviderId,
      selected: dynamicEntry?.selected ?? false,
      definedInConfig: dynamicEntry?.definedInConfig ?? false,
      isKnownPreset: true,
    });
  });

  const detectedCustom = resolvedSummary.entries
    .filter((entry) => !entry.isKnownPreset)
    .map((entry) =>
      toCatalogRow({
        id: entry.id,
        selectedModelProviderId: resolvedSummary.selectedModelProviderId,
        selected: entry.selected,
        definedInConfig: entry.definedInConfig,
        isKnownPreset: false,
      }),
    );

  return {
    parseError: resolvedSummary.parseError,
    selectedModelProviderId: resolvedSummary.selectedModelProviderId,
    effectiveSelectedModelProviderId: resolvedSummary.selectedModelProviderId ?? "openai",
    builtIn: presetRows.filter((row) => row.group === "built-in"),
    curated: presetRows.filter((row) => row.group === "curated"),
    detectedCustom,
  };
}
