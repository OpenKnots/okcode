import { describe, expect, it } from "vitest";

import { joinRemoteFolderPath, relativeRemoteFolderPath } from "./remoteFolderPicker";

describe("remoteFolderPicker", () => {
  it("derives relative paths correctly for Windows roots", () => {
    expect(
      relativeRemoteFolderPath("C:\\Users\\wilfred\\workspace\\okcode", "C:\\Users\\wilfred"),
    ).toBe("workspace/okcode");
  });

  it("joins Windows paths using native separators", () => {
    expect(joinRemoteFolderPath("C:\\Users\\wilfred", "workspace/okcode")).toBe(
      "C:\\Users\\wilfred\\workspace\\okcode",
    );
  });
});
