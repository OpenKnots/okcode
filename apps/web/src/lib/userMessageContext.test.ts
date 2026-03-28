import { describe, expect, it } from "vitest";

import {
  appendUserMessageContextsToPrompt,
  deriveDisplayedUserMessageState,
} from "./userMessageContext";

describe("userMessageContext", () => {
  it("appends and extracts terminal and preview context blocks together", () => {
    const prompt = appendUserMessageContextsToPrompt("Check this button", {
      terminalContexts: [
        {
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 7,
          lineEnd: 8,
          text: "bun run dev\nready in 1.2s",
        },
      ],
      previewContexts: [
        {
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
        },
      ],
    });

    expect(prompt).toContain("<terminal_context>");
    expect(prompt).toContain("<preview_context>");

    expect(deriveDisplayedUserMessageState(prompt)).toEqual({
      visibleText: "Check this button",
      copyText: prompt,
      contextCount: 2,
      previewTitle: [
        "Terminal 1 lines 7-8",
        "7 | bun run dev",
        "8 | ready in 1.2s",
        "",
        'button "Submit"',
        "page: Homepage",
        "url: http://localhost:3000/",
        'selector: button[data-testid="submit"]',
        "tag: button",
        "role: button",
        "text: Submit",
      ].join("\n"),
      terminalContexts: [
        {
          header: "Terminal 1 lines 7-8",
          body: "7 | bun run dev\n8 | ready in 1.2s",
        },
      ],
      previewContexts: [
        {
          header: 'button "Submit"',
          body: [
            "page: Homepage",
            "url: http://localhost:3000/",
            'selector: button[data-testid="submit"]',
            "tag: button",
            "role: button",
            "text: Submit",
          ].join("\n"),
        },
      ],
    });
  });

  it("preserves plain prompt text when no hidden context blocks are present", () => {
    expect(deriveDisplayedUserMessageState("Just a normal message")).toEqual({
      visibleText: "Just a normal message",
      copyText: "Just a normal message",
      contextCount: 0,
      previewTitle: null,
      terminalContexts: [],
      previewContexts: [],
    });
  });
});
