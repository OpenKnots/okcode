import { ThreadId } from "@okcode/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComposerPendingPreviewContextChip } from "./ComposerPendingPreviewContexts";

describe("ComposerPendingPreviewContextChip", () => {
  it("renders a removable preview reference chip", () => {
    const markup = renderToStaticMarkup(
      <ComposerPendingPreviewContextChip
        context={{
          id: "preview-1",
          threadId: ThreadId.makeUnsafe("thread-1"),
          createdAt: "2026-03-28T12:00:00.000Z",
          pageUrl: "http://localhost:3000/",
          pageTitle: "Homepage",
          selector: 'button[data-testid="submit"]',
          tagName: "button",
          role: "button",
          ariaLabel: null,
          text: "Submit",
          href: null,
          name: null,
          placeholder: null,
        }}
        onRemove={() => undefined}
      />,
    );

    expect(markup).toContain("button &quot;Submit&quot;");
    expect(markup).toContain("Remove button");
    expect(markup).toContain("lucide-mouse-pointer-click");
  });
});
