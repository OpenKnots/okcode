import { AlertTriangleIcon, LoaderCircleIcon } from "lucide-react";
import { memo, type CSSProperties, useEffect, useMemo, useState } from "react";

import { MARKDOWN_PREVIEW_CLASS_PREFIX, scopeMarkdownPreviewThemeCss } from "~/markdownPreview";

interface MarkdownPreviewProps {
  contents: string;
}

interface MarkdownPreviewState {
  html: string;
  css: string;
  error: string | null;
}

const INITIAL_STATE: MarkdownPreviewState = {
  html: "",
  css: "",
  error: null,
};

export const MarkdownPreview = memo(function MarkdownPreview({ contents }: MarkdownPreviewProps) {
  const [state, setState] = useState<MarkdownPreviewState>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    setState(INITIAL_STATE);

    void (async () => {
      try {
        const preview = await import("@create-markdown/preview");
        const html = await preview.markdownToHTML(contents, {
          classPrefix: MARKDOWN_PREVIEW_CLASS_PREFIX,
          linkTarget: "_blank",
          theme: "system",
        });
        const css = scopeMarkdownPreviewThemeCss(preview.themes.system);

        if (!cancelled) {
          setState({ html, css, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            html: "",
            css: "",
            error: error instanceof Error ? error.message : "Failed to render Markdown preview.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contents]);

  const markup = useMemo(() => ({ __html: state.html }), [state.html]);

  if (state.error) {
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

  if (!state.html) {
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
        style={
          {
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
              '"SF Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          } as CSSProperties
        }
      >
        <div data-testid="markdown-preview" dangerouslySetInnerHTML={markup} />
      </div>
    </div>
  );
});
