import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildStreamingCodePreviewMeta } from "~/lib/chatCodePreview";

import { ChatCodePreviewCard } from "./ChatCodePreviewCard";

function renderCard(element: ReactElement) {
  return renderToStaticMarkup(element);
}

describe("ChatCodePreviewCard", () => {
  it("renders a live status line for streaming previews", () => {
    const meta = buildStreamingCodePreviewMeta({
      className: "language-typescript",
      code: "export const answer = 42;\n",
      isStreaming: true,
      highlightFailed: false,
    });

    const markup = renderCard(
      <ChatCodePreviewCard code="export const answer = 42;\n" meta={meta} isStreaming>
        <pre>
          <code>export const answer = 42;</code>
        </pre>
      </ChatCodePreviewCard>,
    );

    expect(markup).toContain("Streaming code preview");
    expect(markup).toContain("TypeScript");
    expect(markup).toContain("1 line");
    expect(markup).toContain("Live");
    expect(markup).toContain("Copy code");
  });

  it("renders fallback status when highlighting is unavailable", () => {
    const meta = buildStreamingCodePreviewMeta({
      className: "language-bash",
      code: "bun typecheck",
      isStreaming: false,
      highlightFailed: true,
    });

    const markup = renderCard(
      <ChatCodePreviewCard code="bun typecheck" meta={meta} isStreaming={false}>
        <pre>
          <code>bun typecheck</code>
        </pre>
      </ChatCodePreviewCard>,
    );

    expect(markup).toContain("Preview unavailable, showing plain code");
    expect(markup).toContain("Bash");
    expect(markup).toContain("1 line");
    expect(markup).toContain("bun typecheck");
  });
});
