import type {
  ModelCapabilities,
  ProviderKind,
  ServerProvider,
  ServerProviderModel,
} from "@okcode/contracts";

type ProviderCatalogEntry = {
  readonly slug: string;
  readonly name: string;
  readonly capabilities?: ModelCapabilities | null | undefined;
};

const noCapabilities = null;

export const BUILT_IN_PROVIDER_MODELS: Record<ProviderKind, ReadonlyArray<ProviderCatalogEntry>> = {
  codex: [
    {
      slug: "gpt-5.4",
      name: "GPT-5.4",
      capabilities: {
        reasoningEffortLevels: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High", isDefault: true },
          { value: "xhigh", label: "Extra High" },
        ],
        supportsFastMode: true,
        supportsThinkingToggle: false,
        contextWindowOptions: [],
        promptInjectedEffortLevels: [],
      },
    },
    {
      slug: "gpt-5.4-mini",
      name: "GPT-5.4 Mini",
      capabilities: {
        reasoningEffortLevels: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High", isDefault: true },
          { value: "xhigh", label: "Extra High" },
        ],
        supportsFastMode: true,
        supportsThinkingToggle: false,
        contextWindowOptions: [],
        promptInjectedEffortLevels: [],
      },
    },
    { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex", capabilities: noCapabilities },
    { slug: "gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark", capabilities: noCapabilities },
    { slug: "gpt-5.2-codex", name: "GPT-5.2 Codex", capabilities: noCapabilities },
    { slug: "gpt-5.2", name: "GPT-5.2", capabilities: noCapabilities },
  ],
  claudeAgent: [
    {
      slug: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      capabilities: {
        reasoningEffortLevels: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High", isDefault: true },
          { value: "max", label: "Max" },
          { value: "ultrathink", label: "Ultrathink" },
        ],
        supportsFastMode: true,
        supportsThinkingToggle: false,
        contextWindowOptions: [],
        promptInjectedEffortLevels: ["ultrathink"],
      },
    },
    {
      slug: "claude-sonnet-4-6",
      name: "Claude Sonnet 4.6",
      capabilities: {
        reasoningEffortLevels: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High", isDefault: true },
          { value: "ultrathink", label: "Ultrathink" },
        ],
        supportsFastMode: false,
        supportsThinkingToggle: false,
        contextWindowOptions: [],
        promptInjectedEffortLevels: ["ultrathink"],
      },
    },
    {
      slug: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      capabilities: {
        reasoningEffortLevels: [],
        supportsFastMode: false,
        supportsThinkingToggle: true,
        contextWindowOptions: [],
        promptInjectedEffortLevels: [],
      },
    },
  ],
  openclaw: [],
  copilot: [
    { slug: "gpt-5.4", name: "GPT-5.4", capabilities: noCapabilities },
    { slug: "gpt-5.4-mini", name: "GPT-5.4 Mini", capabilities: noCapabilities },
    { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex", capabilities: noCapabilities },
    { slug: "gpt-5.2-codex", name: "GPT-5.2 Codex", capabilities: noCapabilities },
    { slug: "gpt-5.2", name: "GPT-5.2", capabilities: noCapabilities },
    { slug: "gpt-5-mini", name: "GPT-5 Mini", capabilities: noCapabilities },
    { slug: "gpt-4.1", name: "GPT-4.1", capabilities: noCapabilities },
    { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", capabilities: noCapabilities },
    { slug: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", capabilities: noCapabilities },
    { slug: "claude-haiku-4-5", name: "Claude Haiku 4.5", capabilities: noCapabilities },
    { slug: "claude-opus-4-6", name: "Claude Opus 4.6", capabilities: noCapabilities },
    { slug: "claude-opus-4-5", name: "Claude Opus 4.5", capabilities: noCapabilities },
    { slug: "gemini-3.1-pro", name: "Gemini 3.1 Pro", capabilities: noCapabilities },
    { slug: "gemini-2.5-pro", name: "Gemini 2.5 Pro", capabilities: noCapabilities },
    { slug: "grok-code-fast-1", name: "Grok Code Fast 1", capabilities: noCapabilities },
  ],
  gemini: [
    { slug: "auto-gemini-3", name: "Auto (Gemini 3)", capabilities: noCapabilities },
    { slug: "auto-gemini-2.5", name: "Auto (Gemini 2.5)", capabilities: noCapabilities },
    { slug: "gemini-2.5-pro", name: "Gemini 2.5 Pro", capabilities: noCapabilities },
    { slug: "gemini-2.5-flash", name: "Gemini 2.5 Flash", capabilities: noCapabilities },
    { slug: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview", capabilities: noCapabilities },
    {
      slug: "gemini-3-flash-preview",
      name: "Gemini 3 Flash Preview",
      capabilities: noCapabilities,
    },
  ],
};

export function createServerProviderModels(
  provider: ProviderKind,
  customModels: ReadonlyArray<{ slug: string; name?: string }> = [],
): ReadonlyArray<ServerProviderModel> {
  const builtIns = BUILT_IN_PROVIDER_MODELS[provider].map((model) => ({
    slug: model.slug,
    name: model.name,
    isCustom: false,
    capabilities: model.capabilities ?? null,
  })) satisfies ReadonlyArray<ServerProviderModel>;
  const seen = new Set(builtIns.map((model) => model.slug));
  const custom = customModels.flatMap((model) => {
    if (!model.slug || seen.has(model.slug)) return [];
    return [
      {
        slug: model.slug,
        name: model.name?.trim() || model.slug,
        isCustom: true,
        capabilities: null,
      } satisfies ServerProviderModel,
    ];
  });
  return [...builtIns, ...custom];
}

export function withServerProviderModels(
  provider: Omit<ServerProvider, "models">,
  customModels?: ReadonlyArray<{ slug: string; name?: string }>,
): ServerProvider {
  return {
    ...provider,
    models: createServerProviderModels(provider.provider, customModels),
  };
}
