import { describe, expect, it } from "vitest";

import { buildStreamingCodePreviewMeta } from "./chatCodePreview";

describe("buildStreamingCodePreviewMeta", () => {
  it("parses the language label and marks complete non-streaming fences", () => {
    expect(
      buildStreamingCodePreviewMeta({
        className: "language-typescriptreact",
        code: "const answer = 42;\nconsole.log(answer);\n",
        isStreaming: false,
        highlightFailed: false,
      }),
    ).toMatchObject({
      language: "tsx",
      displayLanguage: "TypeScript React",
      lineCount: 2,
      charCount: 40,
      isCompleteFence: true,
      isHighlightFallback: false,
    });
  });

  it("falls back to Text and marks streaming previews as incomplete", () => {
    expect(
      buildStreamingCodePreviewMeta({
        className: undefined,
        code: "",
        isStreaming: true,
        highlightFailed: false,
      }),
    ).toMatchObject({
      language: "text",
      displayLanguage: "Text",
      lineCount: 0,
      charCount: 0,
      isCompleteFence: false,
      isHighlightFallback: false,
    });
  });

  it("marks highlight fallback without dropping metadata", () => {
    expect(
      buildStreamingCodePreviewMeta({
        className: "language-bash",
        code: "bun typecheck",
        isStreaming: false,
        highlightFailed: true,
      }),
    ).toMatchObject({
      language: "bash",
      displayLanguage: "Bash",
      lineCount: 1,
      charCount: 13,
      isCompleteFence: true,
      isHighlightFallback: true,
    });
  });
});
