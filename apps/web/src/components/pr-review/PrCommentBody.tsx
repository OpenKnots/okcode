import { PrUserHoverCard } from "./PrUserHoverCard";
import MarkdownHtml from "~/components/MarkdownHtml";
import { useTheme } from "~/hooks/useTheme";
import { markdownLooksLikeGitHubMarkdown, resolveMarkdownPreviewTheme } from "~/lib/markdownHtml";

export function PrCommentBody({ body, cwd }: { body: string; cwd: string | null }) {
  const { resolvedTheme } = useTheme();
  const theme = resolveMarkdownPreviewTheme(resolvedTheme);
  const shouldRenderMarkdown = markdownLooksLikeGitHubMarkdown(body);

  if (shouldRenderMarkdown) {
    return (
      <MarkdownHtml
        bodyClassName="markdown-preview-body text-[15px] leading-6 text-foreground/88"
        markdown={body}
        theme={theme}
      />
    );
  }

  const lines = body.split("\n");
  const lineCounts = new Map<string, number>();
  return (
    <div className="space-y-2 whitespace-pre-wrap text-sm leading-6 text-foreground/88">
      {lines.map((line) => {
        const lineOccurrence = lineCounts.get(line) ?? 0;
        lineCounts.set(line, lineOccurrence + 1);
        const segments = line.split(/(@[a-zA-Z0-9-]+)/g);
        const segmentCounts = new Map<string, number>();
        return (
          <p key={`${line}:${lineOccurrence}`}>
            {segments.map((segment) => {
              const segmentOccurrence = segmentCounts.get(segment) ?? 0;
              segmentCounts.set(segment, segmentOccurrence + 1);
              const segmentKey = `${segment}:${segmentOccurrence}`;
              if (/^@[a-zA-Z0-9-]+$/.test(segment)) {
                return (
                  <PrUserHoverCard cwd={cwd} key={segmentKey} login={segment.slice(1)}>
                    {segment}
                  </PrUserHoverCard>
                );
              }
              return <span key={segmentKey}>{segment}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
