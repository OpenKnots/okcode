import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EnvironmentVariablesEditor } from "./EnvironmentVariablesEditor";

describe("EnvironmentVariablesEditor", () => {
  it("hides saved values by default and shows an eye toggle", () => {
    const markup = renderToStaticMarkup(
      <EnvironmentVariablesEditor
        description="Project variables"
        entries={[{ key: "API_KEY", value: "secret-value" }]}
        emptyMessage="No variables"
        saveButtonLabel="Save"
        addButtonLabel="Add variable"
        onSave={async (entries) => entries}
      />,
    );

    expect(markup).toContain('aria-label="Show value"');
    expect(markup).toContain("lucide-eye");
    expect(markup).toContain("-webkit-text-security:disc");
  });
});
