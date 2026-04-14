import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" as const }),
}));

import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("does not show the loading state for an empty file", () => {
    const html = renderToStaticMarkup(<MarkdownPreview contents="" />);

    expect(html).toContain('data-testid="markdown-preview"');
    expect(html).not.toContain("Rendering Markdown preview");
  });
});
