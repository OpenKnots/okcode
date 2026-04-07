import { DiffsHighlighter, getSharedHighlighter, SupportedLanguages } from "@pierre/diffs";

import { LRUCache } from "./lruCache";
import { fnv1a32, resolveDiffThemeName, type DiffThemeName } from "./diffRendering";

const CODE_FENCE_LANGUAGE_REGEX = /(?:^|\s)language-([^\s]+)/;
const MAX_HIGHLIGHT_CACHE_ENTRIES = 500;
const MAX_HIGHLIGHT_CACHE_MEMORY_BYTES = 50 * 1024 * 1024;
const highlightedCodeCache = new LRUCache<string>(
  MAX_HIGHLIGHT_CACHE_ENTRIES,
  MAX_HIGHLIGHT_CACHE_MEMORY_BYTES,
);
const highlighterPromiseCache = new Map<string, Promise<DiffsHighlighter>>();

export function extractFenceLanguage(className: string | undefined): string {
  const match = className?.match(CODE_FENCE_LANGUAGE_REGEX);
  const raw = match?.[1] ?? "text";
  // Shiki doesn't bundle a gitignore grammar; ini is a close match (#685)
  return raw === "gitignore" ? "ini" : raw;
}

export function extractHighlightedCodeInnerHtml(html: string): string {
  const match = html.match(/<pre[^>]*>\s*<code[^>]*>([\s\S]*)<\/code>\s*<\/pre>/i);
  return match?.[1] ?? html;
}

function estimateHighlightedSize(html: string, code: string): number {
  return Math.max(html.length * 2, code.length * 3);
}

function createHighlightCacheKey(
  code: string,
  language: string,
  themeName: DiffThemeName,
  scope: string,
): string {
  return `${scope}:${code.length}:${fnv1a32(code).toString(36)}:${language}:${themeName}`;
}

export function getCachedHighlightedHtml(
  code: string,
  language: string,
  themeName: DiffThemeName,
  scope: string,
): string | null {
  return highlightedCodeCache.get(createHighlightCacheKey(code, language, themeName, scope));
}

export function setCachedHighlightedHtml(
  code: string,
  language: string,
  themeName: DiffThemeName,
  scope: string,
  html: string,
): void {
  highlightedCodeCache.set(
    createHighlightCacheKey(code, language, themeName, scope),
    html,
    estimateHighlightedSize(html, code),
  );
}

export function getHighlighterPromise(language: string): Promise<DiffsHighlighter> {
  const cached = highlighterPromiseCache.get(language);
  if (cached) return cached;

  const promise = getSharedHighlighter({
    themes: [resolveDiffThemeName("dark"), resolveDiffThemeName("light")],
    langs: [language as SupportedLanguages],
    preferredHighlighter: "shiki-js",
  }).catch((err) => {
    highlighterPromiseCache.delete(language);
    if (language === "text") {
      // "text" itself failed — Shiki cannot initialize at all, surface the error
      throw err;
    }
    // Language not supported by Shiki — fall back to "text"
    return getHighlighterPromise("text");
  });

  highlighterPromiseCache.set(language, promise);
  return promise;
}

export function renderHighlightedCodeHtml(
  highlighter: DiffsHighlighter,
  code: string,
  language: string,
  themeName: DiffThemeName,
): string {
  try {
    return highlighter.codeToHtml(code, { lang: language, theme: themeName });
  } catch (error) {
    // Log highlighting failures for debugging while falling back to plain text
    console.warn(
      `Code highlighting failed for language "${language}", falling back to plain text.`,
      error instanceof Error ? error.message : error,
    );
    return highlighter.codeToHtml(code, { lang: "text", theme: themeName });
  }
}
