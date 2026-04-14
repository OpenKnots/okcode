import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";
import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";

import { useTheme } from "~/hooks/useTheme";

interface MarkdownPreviewProps {
  contents: string;
}

interface MarkdownPreviewState {
  status: "loading" | "ready" | "error";
  html: string;
  css: string;
  error: string | null;
}

function createLoadingState(): MarkdownPreviewState {
  return {
    status: "loading",
    html: "",
    css: "",
    error: null,
  };
}

function createReadyState(html: string, css: string): MarkdownPreviewState {
  return {
    status: "ready",
    html,
    css,
    error: null,
  };
}

function createErrorState(error: unknown): MarkdownPreviewState {
  return {
    status: "error",
    html: "",
    css: "",
    error: error instanceof Error ? error.message : "Failed to render Markdown preview.",
  };
}

const MARKDOWN_PREVIEW_CONTAINER_STYLE = {
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
  "--cm-mono": '"SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
} as CSSProperties;

export const MarkdownPreview = memo(function MarkdownPreview({ contents }: MarkdownPreviewProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "github-dark" : "github";
  const [state, setState] = useState<MarkdownPreviewState>(() => {
    if (contents.trim().length === 0) {
      return createReadyState("", "");
    }
    return createLoadingState();
  });

  useEffect(() => {
    let cancelled = false;
    if (contents.trim().length === 0) {
      setState(createReadyState("", ""));
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const { renderMarkdownHtml } = await import("../lib/markdownHtml");
        const { html, css } = renderMarkdownHtml(contents, theme);

        if (!cancelled) {
          setState(createReadyState(html, css));
        }
      } catch (error) {
        if (!cancelled) {
          setState(createErrorState(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contents, theme]);

  const markup = useMemo(() => ({ __html: state.html }), [state.html]);

  if (state.status === "error") {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-5 text-center">
        <div className="flex max-w-md flex-col items-center gap-2 text-destructive/80">
          <AlertTriangleIcon className="size-5" />
          <p className="text-sm font-medium text-foreground">Markdown preview failed</p>
          <p className="text-xs">{state.error}</p>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-5 text-muted-foreground/70">
        <div className="flex items-center gap-2 text-xs">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Rendering Markdown preview...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto">
      <style>{state.css}</style>
      <div
        className="mx-auto min-h-full max-w-4xl px-6 py-5"
        style={MARKDOWN_PREVIEW_CONTAINER_STYLE}
      >
        <div data-testid="markdown-preview" dangerouslySetInnerHTML={markup} />
      </div>
    </div>
  );
});
