export type CodexModelProviderPresetKind = "built-in" | "curated";
export type CodexModelProviderAuthMode = "openai-login" | "local" | "provider-specific";

export interface CodexModelProviderPreset {
  readonly id: string;
  readonly title: string;
  readonly kind: CodexModelProviderPresetKind;
  readonly authMode: CodexModelProviderAuthMode;
  readonly description: string;
}

export const CODEX_MODEL_PROVIDER_PRESETS = [
  {
    id: "openai",
    title: "OpenAI",
    kind: "built-in",
    authMode: "openai-login",
    description: "Codex's default hosted backend using OpenAI account or API-key auth.",
  },
  {
    id: "ollama",
    title: "Ollama",
    kind: "built-in",
    authMode: "local",
    description: "Built-in local backend for models served through Ollama.",
  },
  {
    id: "lmstudio",
    title: "LM Studio",
    kind: "built-in",
    authMode: "local",
    description: "Built-in local backend for models served through LM Studio.",
  },
  {
    id: "azure",
    title: "Azure OpenAI",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Azure-hosted OpenAI-compatible deployments.",
  },
  {
    id: "cerebras",
    title: "Cerebras",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Cerebras-hosted inference endpoints.",
  },
  {
    id: "deepseek",
    title: "DeepSeek",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for DeepSeek-compatible hosted APIs.",
  },
  {
    id: "fireworks",
    title: "Fireworks AI",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Fireworks AI hosted inference.",
  },
  {
    id: "groq",
    title: "Groq",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Groq-hosted compatible APIs.",
  },
  {
    id: "mistral",
    title: "Mistral",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Mistral hosted APIs.",
  },
  {
    id: "openrouter",
    title: "OpenRouter",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for OpenRouter's OpenAI-compatible gateway.",
  },
  {
    id: "perplexity",
    title: "Perplexity",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Perplexity-hosted APIs.",
  },
  {
    id: "portkey",
    title: "Portkey",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Portkey proxy and gateway setups.",
  },
  {
    id: "together",
    title: "Together AI",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for Together AI hosted APIs.",
  },
  {
    id: "xai",
    title: "xAI",
    kind: "curated",
    authMode: "provider-specific",
    description: "Curated preset for xAI-hosted compatible APIs.",
  },
] as const satisfies readonly CodexModelProviderPreset[];

export const CODEX_BUILT_IN_MODEL_PROVIDER_IDS = CODEX_MODEL_PROVIDER_PRESETS.filter(
  (preset) => preset.kind === "built-in",
).map((preset) => preset.id);

const CODEX_MODEL_PROVIDER_PRESET_BY_ID = new Map<string, CodexModelProviderPreset>(
  CODEX_MODEL_PROVIDER_PRESETS.map((preset) => [preset.id, preset] as const),
);
const CODEX_BUILT_IN_MODEL_PROVIDER_ID_SET = new Set<string>(CODEX_BUILT_IN_MODEL_PROVIDER_IDS);

export function getCodexModelProviderPreset(id: string): CodexModelProviderPreset | undefined {
  return CODEX_MODEL_PROVIDER_PRESET_BY_ID.get(id);
}

export function isCodexBuiltInModelProvider(id: string): boolean {
  return CODEX_BUILT_IN_MODEL_PROVIDER_ID_SET.has(id);
}

export function requiresOpenAiLoginForCodexModelProvider(id: string): boolean {
  return id === "openai";
}
