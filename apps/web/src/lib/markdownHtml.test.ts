import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  if (typeof globalThis.HTMLElement === "undefined") {
    Object.defineProperty(globalThis, "HTMLElement", {
      configurable: true,
      // oxlint-disable-next-line typescript-eslint/no-extraneous-class
      value: class HTMLElement {},
      writable: true,
    });
  }

  if (typeof globalThis.customElements === "undefined") {
    Object.defineProperty(globalThis, "customElements", {
      configurable: true,
      value: {
        define() {},
        get() {
          return undefined;
        },
      },
      writable: true,
    });
  }
});

import {
  markdownLooksLikeGitHubMarkdown,
  renderMarkdownHtml,
  resolveMarkdownPreviewTheme,
} from "./markdownHtml";

describe("resolveMarkdownPreviewTheme", () => {
  it("maps app themes to the GitHub preview themes", () => {
    expect(resolveMarkdownPreviewTheme("light")).toBe("github");
    expect(resolveMarkdownPreviewTheme("dark")).toBe("github-dark");
  });
});

describe("markdownLooksLikeGitHubMarkdown", () => {
  it("detects GitHub-flavored markdown features", () => {
    expect(markdownLooksLikeGitHubMarkdown("- [x] complete")).toBe(true);
    expect(markdownLooksLikeGitHubMarkdown("| A | B |\n| - | - |\n| 1 | 2 |")).toBe(true);
    expect(markdownLooksLikeGitHubMarkdown("Plain text only")).toBe(false);
  });
});

describe("renderMarkdownHtml", () => {
  it("renders GitHub-flavored markdown into HTML", () => {
    const { html, css } = renderMarkdownHtml(
      "# Title\n\n- [x] done\n- [ ] todo\n\n| A | B |\n| - | - |\n| 1 | 2 |",
      "github",
    );

    expect(html).toContain("<h1");
    expect(html).toContain("<table");
    expect(html).toContain("input");
    expect(css).toContain(".okc-md-");
  });

  it("renders empty markdown without inventing content", () => {
    const { html } = renderMarkdownHtml("", "github");

    expect(html).toBe("");
  });
});
