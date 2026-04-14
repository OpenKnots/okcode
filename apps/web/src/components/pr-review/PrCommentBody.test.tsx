import { renderToStaticMarkup } from "react-dom/server";
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

vi.mock("~/hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" as const }),
}));

import { PrCommentBody } from "./PrCommentBody";

describe("PrCommentBody", () => {
  it("renders GitHub-flavored markdown when the body contains markdown syntax", () => {
    const html = renderToStaticMarkup(
      <PrCommentBody
        body={[
          "# Review notes",
          "",
          "- [x] done",
          "- [ ] todo",
          "",
          "| A | B |",
          "| - | - |",
          "| 1 | 2 |",
        ].join("\n")}
        cwd="/repo"
      />,
    );

    expect(html).toContain("<h1");
    expect(html).toContain("<table");
    expect(html).toContain("input");
  });
});
