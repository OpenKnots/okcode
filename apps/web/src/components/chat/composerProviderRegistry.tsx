import {
  type ModelSlug,
  type ProviderKind,
  type ProviderModelOptions,
  type ThreadId,
} from "@okcode/contracts";
import {
  getDefaultReasoningEffort,
  getReasoningEffortOptions,
  isClaudeUltrathinkPrompt,
  normalizeClaudeModelOptions,
  normalizeCodexModelOptions,
  resolveReasoningEffortForProvider,
  supportsClaudeUltrathinkKeyword,
} from "@okcode/shared/model";
import type { ReactNode } from "react";
import { ClaudeTraitsMenuContent, ClaudeTraitsPicker } from "./ClaudeTraitsPicker";
import { CodexTraitsMenuContent, CodexTraitsPicker } from "./CodexTraitsPicker";

export type ComposerProviderStateInput = {
  provider: ProviderKind;
  model: ModelSlug;
  prompt: string;
  modelOptions: ProviderModelOptions | null | undefined;
  codexBackendId?: string | null | undefined;
};

export type ComposerProviderState = {
  provider: ProviderKind;
  promptEffort: string | null;
  modelOptionsForDispatch: ProviderModelOptions | undefined;
  composerFrameClassName?: string;
  composerSurfaceClassName?: string;
  modelPickerIconClassName?: string;
};

export type RenderTraitsInput = {
  threadId: ThreadId;
  model: ModelSlug;
  onPromptChange: (prompt: string) => void;
  codexBackendId?: string | null | undefined;
};

type ProviderRegistryEntry = {
  getState: (input: ComposerProviderStateInput) => ComposerProviderState;
  renderTraitsMenuContent: (input: RenderTraitsInput) => ReactNode;
  renderTraitsPicker: (input: RenderTraitsInput) => ReactNode;
};

const composerProviderRegistry: Record<ProviderKind, ProviderRegistryEntry> = {
  codex: {
    getState: ({ model, modelOptions, codexBackendId }) => {
      const promptEffort =
        resolveReasoningEffortForProvider("codex", modelOptions?.codex?.reasoningEffort) ??
        getDefaultReasoningEffort("codex");
      const normalizedCodexOptions = normalizeCodexModelOptions(modelOptions?.codex, {
        model,
        backendId: codexBackendId,
      });

      return {
        provider: "codex",
        promptEffort,
        modelOptionsForDispatch: normalizedCodexOptions
          ? { codex: normalizedCodexOptions }
          : undefined,
      };
    },
    renderTraitsMenuContent: ({ threadId, model, codexBackendId }) => (
      <CodexTraitsMenuContent
        threadId={threadId}
        model={model}
        backendId={codexBackendId ?? null}
      />
    ),
    renderTraitsPicker: ({ threadId, model, codexBackendId }) => (
      <CodexTraitsPicker threadId={threadId} model={model} backendId={codexBackendId ?? null} />
    ),
  },
  claudeAgent: {
    getState: ({ model, prompt, modelOptions }) => {
      const reasoningOptions = getReasoningEffortOptions("claudeAgent", model);
      const draftEffort = resolveReasoningEffortForProvider(
        "claudeAgent",
        modelOptions?.claudeAgent?.effort,
      );
      const defaultEffort = getDefaultReasoningEffort("claudeAgent");
      const promptEffort =
        draftEffort && draftEffort !== "ultrathink" && reasoningOptions.includes(draftEffort)
          ? draftEffort
          : reasoningOptions.includes(defaultEffort)
            ? defaultEffort
            : null;
      const normalizedClaudeOptions = normalizeClaudeModelOptions(model, modelOptions?.claudeAgent);
      const ultrathinkActive =
        supportsClaudeUltrathinkKeyword(model) && isClaudeUltrathinkPrompt(prompt);

      return {
        provider: "claudeAgent",
        promptEffort,
        modelOptionsForDispatch: normalizedClaudeOptions
          ? { claudeAgent: normalizedClaudeOptions }
          : undefined,
        ...(ultrathinkActive ? { composerFrameClassName: "ultrathink-frame" } : {}),
        ...(ultrathinkActive
          ? { composerSurfaceClassName: "shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]" }
          : {}),
        ...(ultrathinkActive ? { modelPickerIconClassName: "ultrathink-chroma" } : {}),
      };
    },
    renderTraitsMenuContent: ({ threadId, model, onPromptChange }) => (
      <ClaudeTraitsMenuContent threadId={threadId} model={model} onPromptChange={onPromptChange} />
    ),
    renderTraitsPicker: ({ threadId, model, onPromptChange }) => (
      <ClaudeTraitsPicker threadId={threadId} model={model} onPromptChange={onPromptChange} />
    ),
  },
  openclaw: {
    getState: ({ modelOptions }) => {
      const promptEffort =
        resolveReasoningEffortForProvider("openclaw", modelOptions?.openclaw?.reasoningEffort) ??
        getDefaultReasoningEffort("openclaw");
      return {
        provider: "openclaw",
        promptEffort,
        modelOptionsForDispatch: modelOptions?.openclaw?.reasoningEffort
          ? { openclaw: { reasoningEffort: modelOptions.openclaw.reasoningEffort } }
          : undefined,
      };
    },
    renderTraitsMenuContent: () => null,
    renderTraitsPicker: () => null,
  },
  copilot: {
    getState: ({ modelOptions }) => {
      const defaultPromptEffort = getDefaultReasoningEffort("copilot");
      const promptEffort =
        resolveReasoningEffortForProvider("copilot", modelOptions?.copilot?.reasoningEffort) ??
        defaultPromptEffort;

      return {
        provider: "copilot",
        promptEffort,
        modelOptionsForDispatch:
          promptEffort !== defaultPromptEffort
            ? { copilot: { reasoningEffort: promptEffort } }
            : undefined,
      };
    },
    renderTraitsMenuContent: () => null,
    renderTraitsPicker: () => null,
  },
  gemini: {
    getState: () => ({
      provider: "gemini",
      promptEffort: null,
      modelOptionsForDispatch: undefined,
    }),
    renderTraitsMenuContent: () => null,
    renderTraitsPicker: () => null,
  },
};

export function getComposerProviderState(input: ComposerProviderStateInput): ComposerProviderState {
  return composerProviderRegistry[input.provider].getState(input);
}

export function renderProviderTraitsMenuContent(input: {
  provider: ProviderKind;
  threadId: ThreadId;
  model: ModelSlug;
  onPromptChange: (prompt: string) => void;
  codexBackendId?: string | null | undefined;
}): ReactNode {
  return composerProviderRegistry[input.provider].renderTraitsMenuContent({
    threadId: input.threadId,
    model: input.model,
    onPromptChange: input.onPromptChange,
    codexBackendId: input.codexBackendId ?? null,
  });
}

export function renderProviderTraitsPicker(input: {
  provider: ProviderKind;
  threadId: ThreadId;
  model: ModelSlug;
  onPromptChange: (prompt: string) => void;
  codexBackendId?: string | null | undefined;
}): ReactNode {
  return composerProviderRegistry[input.provider].renderTraitsPicker({
    threadId: input.threadId,
    model: input.model,
    onPromptChange: input.onPromptChange,
    codexBackendId: input.codexBackendId ?? null,
  });
}
