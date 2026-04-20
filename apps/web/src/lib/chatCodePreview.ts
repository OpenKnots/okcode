import { extractFenceLanguage } from "./syntaxHighlighting";

export interface StreamingCodePreviewMeta {
  language: string;
  displayLanguage: string;
  lineCount: number;
  charCount: number;
  isCompleteFence: boolean;
  isHighlightFallback: boolean;
}

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  bash: "Bash",
  css: "CSS",
  html: "HTML",
  ini: "INI",
  javascriptreact: "JavaScript React",
  javascript: "JavaScript",
  json: "JSON",
  js: "JavaScript",
  jsx: "JavaScript React",
  markdown: "Markdown",
  md: "Markdown",
  shell: "Shell",
  sh: "Shell",
  sql: "SQL",
  text: "Text",
  ts: "TypeScript",
  tsx: "TypeScript React",
  typescript: "TypeScript",
  typescriptreact: "TypeScript React",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

const NORMALIZED_LANGUAGE_IDS: Record<string, string> = {
  javascriptreact: "jsx",
  typescript: "ts",
  typescriptreact: "tsx",
};

function displayLanguageLabel(language: string): string {
  const normalized = language.trim().toLowerCase();
  const exact = LANGUAGE_DISPLAY_NAMES[normalized];
  if (exact) return exact;

  return normalized
    .split(/[-_]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function countPreviewLines(code: string): number {
  if (code.length === 0) return 0;
  const lines = code.endsWith("\n") ? code.slice(0, -1).split("\n") : code.split("\n");
  return lines.length;
}

export function buildStreamingCodePreviewMeta(input: {
  className: string | undefined;
  code: string;
  isStreaming: boolean;
  highlightFailed: boolean;
}): StreamingCodePreviewMeta {
  const language = extractFenceLanguage(input.className);
  const normalizedLanguage = NORMALIZED_LANGUAGE_IDS[language] ?? language;
  const lineCount = countPreviewLines(input.code);

  return {
    language: normalizedLanguage,
    displayLanguage: displayLanguageLabel(language),
    lineCount,
    charCount: input.code.length,
    isCompleteFence: !input.isStreaming || input.code.trim().length > 0,
    isHighlightFallback: input.highlightFailed,
  };
}
