import {
  appendTerminalContextsToPrompt,
  extractTrailingTerminalContexts,
  type ParsedTerminalContextEntry,
  type TerminalContextSelection,
} from "./terminalContext";
import {
  appendPreviewContextsToPrompt,
  extractTrailingPreviewContexts,
  type ParsedPreviewContextEntry,
  type PreviewContextSelection,
} from "./previewContext";

export interface DisplayedUserMessageState {
  visibleText: string;
  copyText: string;
  contextCount: number;
  previewTitle: string | null;
  terminalContexts: ParsedTerminalContextEntry[];
  previewContexts: ParsedPreviewContextEntry[];
}

export function appendUserMessageContextsToPrompt(
  prompt: string,
  contexts: {
    terminalContexts?: ReadonlyArray<TerminalContextSelection>;
    previewContexts?: ReadonlyArray<PreviewContextSelection>;
  },
): string {
  const withTerminalContexts = appendTerminalContextsToPrompt(
    prompt,
    contexts.terminalContexts ?? [],
  );
  return appendPreviewContextsToPrompt(withTerminalContexts, contexts.previewContexts ?? []);
}

export function deriveDisplayedUserMessageState(prompt: string): DisplayedUserMessageState {
  const extractedPreviewContexts = extractTrailingPreviewContexts(prompt);
  const extractedTerminalContexts = extractTrailingTerminalContexts(
    extractedPreviewContexts.promptText,
  );

  const previewTitle = [
    extractedTerminalContexts.previewTitle,
    extractedPreviewContexts.previewTitle,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n\n");

  return {
    visibleText: extractedTerminalContexts.promptText,
    copyText: prompt,
    contextCount: extractedTerminalContexts.contextCount + extractedPreviewContexts.contextCount,
    previewTitle: previewTitle.length > 0 ? previewTitle : null,
    terminalContexts: extractedTerminalContexts.contexts,
    previewContexts: extractedPreviewContexts.contexts,
  };
}
