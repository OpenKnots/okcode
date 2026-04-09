import { Schema } from "effect";
import type { ProviderKind } from "./orchestration";

export const CODEX_REASONING_EFFORT_OPTIONS = ["xhigh", "high", "medium", "low"] as const;
export type CodexReasoningEffort = (typeof CODEX_REASONING_EFFORT_OPTIONS)[number];
export const CLAUDE_CODE_EFFORT_OPTIONS = ["low", "medium", "high", "max", "ultrathink"] as const;
export type ClaudeCodeEffort = (typeof CLAUDE_CODE_EFFORT_OPTIONS)[number];
export const OPENCLAW_REASONING_EFFORT_OPTIONS = ["low", "medium", "high"] as const;
export type OpenClawReasoningEffort = (typeof OPENCLAW_REASONING_EFFORT_OPTIONS)[number];
export const COPILOT_REASONING_EFFORT_OPTIONS = ["low", "medium", "high", "xhigh"] as const;
export type CopilotReasoningEffort = (typeof COPILOT_REASONING_EFFORT_OPTIONS)[number];
export type ProviderReasoningEffort =
  | CodexReasoningEffort
  | ClaudeCodeEffort
  | OpenClawReasoningEffort
  | CopilotReasoningEffort;

export const CodexModelOptions = Schema.Struct({
  reasoningEffort: Schema.optional(Schema.Literals(CODEX_REASONING_EFFORT_OPTIONS)),
  fastMode: Schema.optional(Schema.Boolean),
});
export type CodexModelOptions = typeof CodexModelOptions.Type;

export const ClaudeModelOptions = Schema.Struct({
  thinking: Schema.optional(Schema.Boolean),
  effort: Schema.optional(Schema.Literals(CLAUDE_CODE_EFFORT_OPTIONS)),
  fastMode: Schema.optional(Schema.Boolean),
});
export type ClaudeModelOptions = typeof ClaudeModelOptions.Type;

export const OpenClawModelOptions = Schema.Struct({
  reasoningEffort: Schema.optional(Schema.Literals(OPENCLAW_REASONING_EFFORT_OPTIONS)),
});
export type OpenClawModelOptions = typeof OpenClawModelOptions.Type;

export const CopilotModelOptions = Schema.Struct({
  reasoningEffort: Schema.optional(Schema.Literals(COPILOT_REASONING_EFFORT_OPTIONS)),
});
export type CopilotModelOptions = typeof CopilotModelOptions.Type;

export const ProviderModelOptions = Schema.Struct({
  codex: Schema.optional(CodexModelOptions),
  claudeAgent: Schema.optional(ClaudeModelOptions),
  openclaw: Schema.optional(OpenClawModelOptions),
  copilot: Schema.optional(CopilotModelOptions),
});
export type ProviderModelOptions = typeof ProviderModelOptions.Type;

type ModelOption = {
  readonly slug: string;
  readonly name: string;
};

export const MODEL_OPTIONS_BY_PROVIDER = {
  codex: [
    { slug: "gpt-5.4", name: "GPT-5.4" },
    { slug: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
    { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
    { slug: "gpt-5.3-codex-spark", name: "GPT-5.3 Codex Spark" },
    { slug: "gpt-5.2-codex", name: "GPT-5.2 Codex" },
    { slug: "gpt-5.2", name: "GPT-5.2" },
  ],
  claudeAgent: [
    { slug: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { slug: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ],
  openclaw: [],
  copilot: [
    { slug: "gpt-5.4", name: "GPT-5.4" },
    { slug: "gpt-5.4-mini", name: "GPT-5.4 mini" },
    { slug: "gpt-5.3-codex", name: "GPT-5.3-Codex" },
    { slug: "gpt-5.2-codex", name: "GPT-5.2-Codex" },
    { slug: "gpt-5.2", name: "GPT-5.2" },
    { slug: "gpt-5-mini", name: "GPT-5 mini" },
    { slug: "gpt-4.1", name: "GPT-4.1" },
    { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { slug: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { slug: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
    { slug: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { slug: "claude-opus-4-5", name: "Claude Opus 4.5" },
    { slug: "gemini-3.1-pro", name: "Gemini 3.1 Pro" },
    { slug: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { slug: "grok-code-fast-1", name: "Grok Code Fast 1" },
  ],
} as const satisfies Record<ProviderKind, readonly ModelOption[]>;
export type ModelOptionsByProvider = typeof MODEL_OPTIONS_BY_PROVIDER;

type BuiltInModelSlug = (typeof MODEL_OPTIONS_BY_PROVIDER)[ProviderKind][number]["slug"];
export type ModelSlug = BuiltInModelSlug | (string & {});

export const DEFAULT_MODEL_BY_PROVIDER: Record<ProviderKind, ModelSlug> = {
  codex: "gpt-5.4",
  claudeAgent: "claude-sonnet-4-6",
  openclaw: "default",
  copilot: "gpt-5.3-codex",
};

// Backward compatibility for existing Codex-only call sites.
export const MODEL_OPTIONS = MODEL_OPTIONS_BY_PROVIDER.codex;
export const DEFAULT_MODEL = DEFAULT_MODEL_BY_PROVIDER.codex;
export const DEFAULT_GIT_TEXT_GENERATION_MODEL = "gpt-5.4-mini" as const;

export const MODEL_SLUG_ALIASES_BY_PROVIDER: Record<ProviderKind, Record<string, ModelSlug>> = {
  codex: {
    "5.4": "gpt-5.4",
    "5.3": "gpt-5.3-codex",
    "gpt-5.3": "gpt-5.3-codex",
    "5.3-spark": "gpt-5.3-codex-spark",
    "gpt-5.3-spark": "gpt-5.3-codex-spark",
  },
  claudeAgent: {
    opus: "claude-opus-4-6",
    "opus-4.6": "claude-opus-4-6",
    "claude-opus-4.6": "claude-opus-4-6",
    "claude-opus-4-6-20251117": "claude-opus-4-6",
    sonnet: "claude-sonnet-4-6",
    "sonnet-4.6": "claude-sonnet-4-6",
    "claude-sonnet-4.6": "claude-sonnet-4-6",
    "claude-sonnet-4-6-20251117": "claude-sonnet-4-6",
    haiku: "claude-haiku-4-5",
    "haiku-4.5": "claude-haiku-4-5",
    "claude-haiku-4.5": "claude-haiku-4-5",
    "claude-haiku-4-5-20251001": "claude-haiku-4-5",
  },
  openclaw: {},
  copilot: {
    "4.1": "gpt-4.1",
    "gpt-4.1": "gpt-4.1",
    "5-mini": "gpt-5-mini",
    "gpt-5-mini": "gpt-5-mini",
    "5.2": "gpt-5.2",
    "gpt-5.2": "gpt-5.2",
    "5.2-codex": "gpt-5.2-codex",
    "gpt-5.2-codex": "gpt-5.2-codex",
    "5.3-codex": "gpt-5.3-codex",
    "gpt-5.3-codex": "gpt-5.3-codex",
    "5.4": "gpt-5.4",
    "gpt-5.4": "gpt-5.4",
    "5.4-mini": "gpt-5.4-mini",
    "gpt-5.4-mini": "gpt-5.4-mini",
    "claude-sonnet-4.5": "claude-sonnet-4.5",
    "claude sonnet 4.5": "claude-sonnet-4.5",
    "claude-sonnet-4-5": "claude-sonnet-4-5",
    "claude sonnet 4.6": "claude-sonnet-4-6",
    "claude-sonnet-4.6": "claude-sonnet-4-6",
    "claude-sonnet-4-6": "claude-sonnet-4-6",
    "claude haiku 4.5": "claude-haiku-4-5",
    "claude-haiku-4.5": "claude-haiku-4-5",
    "claude-haiku-4-5": "claude-haiku-4-5",
    "claude opus 4.5": "claude-opus-4-5",
    "claude-opus-4.5": "claude-opus-4-5",
    "claude-opus-4-5": "claude-opus-4-5",
    "claude opus 4.6": "claude-opus-4-6",
    "claude-opus-4.6": "claude-opus-4-6",
    "claude-opus-4-6": "claude-opus-4-6",
    "gemini 2.5 pro": "gemini-2.5-pro",
    "gemini-2.5-pro": "gemini-2.5-pro",
    "gemini 3.1 pro": "gemini-3.1-pro",
    "gemini-3.1-pro": "gemini-3.1-pro",
    "grok code fast 1": "grok-code-fast-1",
    "grok-code-fast-1": "grok-code-fast-1",
  },
};

export const REASONING_EFFORT_OPTIONS_BY_PROVIDER = {
  codex: CODEX_REASONING_EFFORT_OPTIONS,
  claudeAgent: CLAUDE_CODE_EFFORT_OPTIONS,
  openclaw: OPENCLAW_REASONING_EFFORT_OPTIONS,
  copilot: COPILOT_REASONING_EFFORT_OPTIONS,
} as const satisfies Record<ProviderKind, readonly ProviderReasoningEffort[]>;

export const DEFAULT_REASONING_EFFORT_BY_PROVIDER = {
  codex: "high",
  claudeAgent: "high",
  openclaw: "high",
  copilot: "high",
} as const satisfies Record<ProviderKind, ProviderReasoningEffort>;
