import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExpandableSummary } from "./ExpandableSummary";

describe("ExpandableSummary", () => {
  it("renders inline text by default when no children are provided", () => {
    const html = renderToStaticMarkup(
      <ExpandableSummary text="This is an AI summary that is long enough to be expandable and interesting." />,
    );
    expect(html).toContain(
      "This is an AI summary that is long enough to be expandable and interesting.",
    );
  });

  it("renders custom children when provided", () => {
    const html = renderToStaticMarkup(
      <ExpandableSummary text="Raw text here">
        <span className="custom">Custom inline render</span>
      </ExpandableSummary>,
    );
    expect(html).toContain("Custom inline render");
    expect(html).toContain("custom");
  });

  it("shows the expand button for text longer than 40 characters", () => {
    const html = renderToStaticMarkup(
      <ExpandableSummary text="This is definitely long enough to warrant an expand button for the user." />,
    );
    expect(html).toContain("Expand summary");
  });

  it("hides the expand button for very short text", () => {
    const html = renderToStaticMarkup(<ExpandableSummary text="Short." />);
    expect(html).not.toContain("Expand summary");
  });

  it("hides the expand button for whitespace-only text", () => {
    const html = renderToStaticMarkup(<ExpandableSummary text="                              " />);
    expect(html).not.toContain("Expand summary");
  });

  it("applies the group/expand class for hover interaction", () => {
    const html = renderToStaticMarkup(
      <ExpandableSummary text="A sufficiently long expandable AI response summary text." />,
    );
    expect(html).toContain("group/expand");
  });

  it("passes className to the wrapper div", () => {
    const html = renderToStaticMarkup(
      <ExpandableSummary
        className="mt-3"
        text="Another long expandable text for testing className."
      />,
    );
    expect(html).toContain("mt-3");
  });
});
