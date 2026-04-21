import { bundledLanguages, bundledLanguagesAlias } from "shiki";

const LANGUAGE_ID_OVERRIDES: Record<string, string> = {
  "bun.lockb": "text",
  "code-text-binary": "text",
  cfmhtml: "html",
  csharp: "c#",
  "django-html": "html",
  esphome: "yaml",
  "go.mod": "go",
  "go.work": "go",
  "json-tmlanguage": "json",
  javascriptreact: "jsx",
  "manifest-yaml": "yaml",
  plaintext: "text",
  proto3: "protobuf",
  rmd: "md",
  restructuredtext: "rst",
  swagger: "yaml",
  typescriptreact: "tsx",
  "yaml-tmlanguage": "yaml",
};

export function normalizeLanguageIdForHighlighting(languageId: string): string {
  const normalized = languageId.toLowerCase();
  if (
    Object.hasOwn(bundledLanguages, normalized) ||
    Object.hasOwn(bundledLanguagesAlias, normalized)
  ) {
    return normalized;
  }
  return LANGUAGE_ID_OVERRIDES[normalized] ?? normalized;
}
