import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProviderStatusRefreshButton } from "./ProviderStatusRefreshButton";

describe("ProviderStatusRefreshButton", () => {
  it("shows an idle refresh control without a busy indicator", () => {
    const markup = renderToStaticMarkup(
      <ProviderStatusRefreshButton refreshing={false} onRefresh={vi.fn()} />,
    );

    expect(markup).toContain("Refresh status");
    expect(markup).toContain('aria-busy="false"');
    expect(markup).not.toContain("animate-spin");
    expect(markup).not.toContain("disabled=");
  });

  it("shows an animated busy state while refresh is in flight", () => {
    const markup = renderToStaticMarkup(
      <ProviderStatusRefreshButton refreshing onRefresh={vi.fn()} />,
    );

    expect(markup).toContain("Refreshing status");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("animate-spin");
    expect(markup).not.toContain("disabled=");
  });
});
