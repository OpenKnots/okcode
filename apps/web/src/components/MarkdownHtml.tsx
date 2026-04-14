import { memo, useMemo } from "react";

import {
  type MarkdownPreviewTheme,
  renderMarkdownHtml,
  MARKDOWN_PREVIEW_CONTAINER_STYLE,
} from "~/lib/markdownHtml";

export function MarkdownHtml({
  markdown,
  theme,
  className,
  bodyClassName,
  testId,
}: {
  markdown: string;
  theme: MarkdownPreviewTheme;
  className?: string;
  bodyClassName?: string;
  testId?: string;
}) {
  const rendered = useMemo(() => renderMarkdownHtml(markdown, theme), [markdown, theme]);

  return (
    <div className={className} style={MARKDOWN_PREVIEW_CONTAINER_STYLE}>
      <style>{rendered.css}</style>
      <div
        className={bodyClassName}
        data-testid={testId}
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
    </div>
  );
}

export default memo(MarkdownHtml);
