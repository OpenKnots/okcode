import { describe, expect, it } from "vitest";

describe("PreviewPanel", () => {
  it("exports the component", async () => {
    const mod = await import("./PreviewPanel");
    expect(mod.PreviewPanel).toBeDefined();
  });
});
