import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CodexBackendSection } from "./CodexBackendSection";

describe("CodexBackendSection", () => {
  it("shows a parse warning while keeping the fallback-selected backend visible", () => {
    const markup = renderToStaticMarkup(
      <CodexBackendSection
        summary={{
          selectedModelProviderId: "azure",
          entries: [
            {
              id: "azure",
              selected: true,
              definedInConfig: true,
              isBuiltIn: false,
              isKnownPreset: true,
              requiresOpenAiLogin: false,
            },
          ],
          parseError: "Unexpected token",
        }}
      />,
    );
    expect(markup).toContain("Codex config parsing failed");
    expect(markup).toContain("Azure OpenAI");
    expect(markup).toContain("Configured");
  });
});
