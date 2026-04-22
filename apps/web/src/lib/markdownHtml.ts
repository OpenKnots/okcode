import type { CSSProperties } from "react";

import { parse } from "@create-markdown/core";
import { blocksToHTML, themes } from "@create-markdown/preview";

import { MARKDOWN_PREVIEW_CLASS_PREFIX, scopeMarkdownPreviewThemeCss } from "~/markdownPreview";

export type MarkdownPreviewTheme = "github" | "github-dark";

export const MARKDOWN_PREVIEW_CONTAINER_STYLE: CSSProperties = {
  "--cm-bg": "transparent",
  "--cm-text": "var(--foreground)",
  "--cm-border": "var(--border)",
  "--cm-muted": "var(--muted-foreground)",
  "--cm-link": "var(--primary)",
  "--cm-code-bg": "var(--secondary)",
  "--cm-inline-code-bg": "var(--secondary)",
  "--cm-table-header-bg": "var(--secondary)",
  "--cm-table-stripe-bg": "var(--accent)",
  "--cm-callout-bg": "var(--secondary)",
  "--cm-radius": "12px",
  "--cm-font":
    'var(--font-ui, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif)',
  "--cm-mono":
    'var(--font-code, var(--font-mono, ui-monospace, "SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace))',
} as CSSProperties;

function getThemeCss(theme: MarkdownPreviewTheme): string {
  const themeCss = theme === "github" ? themes.github : themes.githubDark;
  if (typeof themeCss !== "string") {
    throw new Error(`Unsupported markdown preview theme: ${theme}`);
  }

  return scopeMarkdownPreviewThemeCss(themeCss);
}

export function resolveMarkdownPreviewTheme(resolvedTheme: "light" | "dark"): MarkdownPreviewTheme {
  return resolvedTheme === "dark" ? "github-dark" : "github";
}

export function markdownLooksLikeGitHubMarkdown(markdown: string): boolean {
  return (
    /^#{1,6}\s/m.test(markdown) ||
    /^>\s/m.test(markdown) ||
    /^(-|\*|\+)\s/m.test(markdown) ||
    /^\d+\.\s/m.test(markdown) ||
    /^\s*[-*+]\s+\[[ xX]\]\s/m.test(markdown) ||
    /\|.+\|/m.test(markdown) ||
    /```[\s\S]*```/.test(markdown) ||
    /`[^`]+`/.test(markdown) ||
    /\[[^\]]+\]\([^)]+\)/.test(markdown) ||
    /\*\*[^*]+\*\*/.test(markdown) ||
    /\*[^*\n]+\*/.test(markdown)
  );
}

export function renderMarkdownHtml(
  markdown: string,
  theme: MarkdownPreviewTheme,
): { html: string; css: string } {
  if (markdown.trim().length === 0) {
    return {
      html: "",
      css: getThemeCss(theme),
    };
  }

  const blocks = parse(markdown);
  const html = blocksToHTML(blocks, {
    classPrefix: MARKDOWN_PREVIEW_CLASS_PREFIX,
    linkTarget: "_blank",
    sanitize: true,
    theme,
  });

  return {
    html,
    css: getThemeCss(theme),
  };
}
