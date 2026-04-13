import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_OPTIONS_BY_PROVIDER,
  MODEL_SLUG_ALIASES_BY_PROVIDER,
  type ModelCapabilities,
  type ModelSelection,
  type ProviderKind,
  type ProviderModelOptions,
} from "@okcode/contracts";

type SelectableModel = {
  readonly slug: string;
  readonly capabilities?: ModelCapabilities | null | undefined;
};

const PROVIDER_MODEL_SET = {
  codex: new Set(MODEL_OPTIONS_BY_PROVIDER.codex.map((option) => option.slug)),
  claudeAgent: new Set(MODEL_OPTIONS_BY_PROVIDER.claudeAgent.map((option) => option.slug)),
  openclaw: new Set<string>(),
  copilot: new Set(MODEL_OPTIONS_BY_PROVIDER.copilot.map((option) => option.slug)),
  gemini: new Set(MODEL_OPTIONS_BY_PROVIDER.gemini.map((option) => option.slug)),
} as const satisfies Record<ProviderKind, ReadonlySet<string>>;

export function normalizeModelSelectionModel(
  provider: ProviderKind,
  model: string | null | undefined,
): string {
  const trimmed = typeof model === "string" ? model.trim() : "";
  const aliasMap = MODEL_SLUG_ALIASES_BY_PROVIDER[provider] as Record<string, string>;
  const aliased = trimmed ? (aliasMap[trimmed] ?? aliasMap[trimmed.toLowerCase()] ?? trimmed) : "";
  if (aliased && (PROVIDER_MODEL_SET[provider] as ReadonlySet<string>).has(aliased)) {
    return aliased;
  }
  return trimmed || DEFAULT_MODEL_BY_PROVIDER[provider];
}

export function toCanonicalModelSelection(
  provider: ProviderKind,
  model: string | null | undefined,
  modelOptions: ProviderModelOptions | null | undefined,
): ModelSelection {
  const normalizedModel = normalizeModelSelectionModel(provider, model);
  const providerOptions = modelOptions?.[provider];
  return providerOptions
    ? ({ provider, model: normalizedModel, options: providerOptions } as ModelSelection)
    : ({ provider, model: normalizedModel } as ModelSelection);
}

export function getModelSelectionProvider(
  selection: ModelSelection | null | undefined,
): ProviderKind {
  return selection?.provider ?? "codex";
}

export function getModelSelectionModel(selection: ModelSelection | null | undefined): string {
  const provider = selection?.provider ?? "codex";
  return selection?.model ?? DEFAULT_MODEL_BY_PROVIDER[provider];
}

export function getModelSelectionOptions(
  selection: ModelSelection | null | undefined,
): ProviderModelOptions | undefined {
  if (!selection?.options) return undefined;
  return { [selection.provider]: selection.options } as ProviderModelOptions;
}

export function modelSelectionsAreEqual(
  a: ModelSelection | null | undefined,
  b: ModelSelection | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a.provider !== b.provider || a.model !== b.model) return false;
  const aOpts = a.options ?? null;
  const bOpts = b.options ?? null;
  if (aOpts === null && bOpts === null) return true;
  if (aOpts === null || bOpts === null) return false;
  const aKeys = Object.keys(aOpts).toSorted();
  const bKeys = Object.keys(bOpts).toSorted();
  if (aKeys.join(",") !== bKeys.join(",")) return false;
  return aKeys.every(
    (k) => (aOpts as Record<string, unknown>)[k] === (bOpts as Record<string, unknown>)[k],
  );
}

export function normalizeModelSelectionWithCapabilities(
  selection: ModelSelection,
  models: ReadonlyArray<SelectableModel>,
): ModelSelection {
  const matchedModel = models.find((candidate) => candidate.slug === selection.model);
  if (!matchedModel?.capabilities) {
    return selection;
  }
  const capabilities = matchedModel.capabilities;
  const supportsFastMode = capabilities.supportsFastMode;
  const supportsThinkingToggle = capabilities.supportsThinkingToggle;
  const reasoningEffortValues = new Set(
    capabilities.reasoningEffortLevels.map((option) => option.value),
  );
  const contextWindowValues = new Set(
    capabilities.contextWindowOptions.map((option) => option.value),
  );

  if (!selection.options) {
    return selection;
  }

  switch (selection.provider) {
    case "codex":
      return {
        ...selection,
        options: {
          ...(selection.options.reasoningEffort &&
          reasoningEffortValues.has(selection.options.reasoningEffort)
            ? { reasoningEffort: selection.options.reasoningEffort }
            : {}),
          ...(supportsFastMode && selection.options.fastMode !== undefined
            ? { fastMode: selection.options.fastMode }
            : {}),
        },
      };
    case "claudeAgent":
      return {
        ...selection,
        options: {
          ...(supportsThinkingToggle && selection.options.thinking !== undefined
            ? { thinking: selection.options.thinking }
            : {}),
          ...(selection.options.effort && reasoningEffortValues.has(selection.options.effort)
            ? { effort: selection.options.effort }
            : {}),
          ...(supportsFastMode && selection.options.fastMode !== undefined
            ? { fastMode: selection.options.fastMode }
            : {}),
          ...(selection.options.contextWindow &&
          contextWindowValues.has(selection.options.contextWindow)
            ? { contextWindow: selection.options.contextWindow }
            : {}),
        },
      };
    case "openclaw":
    case "copilot":
    case "gemini":
      return selection;
  }
}
