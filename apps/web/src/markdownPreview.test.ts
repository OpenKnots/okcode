import { describe, expect, it } from "vitest";

import {
  MARKDOWN_PREVIEW_CLASS_PREFIX,
  MARKDOWN_PREVIEW_WRAPPER_CLASS,
  isMarkdownPreviewFilePath,
  scopeMarkdownPreviewThemeCss,
} from "./markdownPreview";

describe("isMarkdownPreviewFilePath", () => {
  it("matches common markdown file extensions", () => {
    expect(isMarkdownPreviewFilePath("README.md")).toBe(true);
    expect(isMarkdownPreviewFilePath("docs/guide.markdown")).toBe(true);
    expect(isMarkdownPreviewFilePath("notes.mdown")).toBe(true);
    expect(isMarkdownPreviewFilePath("draft.mkd")).toBe(true);
  });

  it("does not treat non-markdown files as markdown previews", () => {
    expect(isMarkdownPreviewFilePath("src/index.ts")).toBe(false);
    expect(isMarkdownPreviewFilePath("story.mdx")).toBe(false);
    expect(isMarkdownPreviewFilePath("rules.mdc")).toBe(false);
  });
});

describe("scopeMarkdownPreviewThemeCss", () => {
  it("rewrites preview classes and scopes bare code selectors", () => {
    const css = `
.cm-preview a { color: red; }
.cm-code-block { color: blue; }
code { background: black; }
`;

    const scoped = scopeMarkdownPreviewThemeCss(css);

    expect(scoped).toContain(`.${MARKDOWN_PREVIEW_WRAPPER_CLASS} a`);
    expect(scoped).toContain(`.${MARKDOWN_PREVIEW_CLASS_PREFIX}code-block`);
    expect(scoped).toContain(`.${MARKDOWN_PREVIEW_WRAPPER_CLASS} code {`);
    expect(scoped).not.toContain("\ncode {");
  });
});
