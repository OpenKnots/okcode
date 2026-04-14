import { describe, expect, it } from "vitest";

import { COLOR_THEMES } from "./themeConfig";

describe("COLOR_THEMES", () => {
  it("includes the Hot Tamale preset", () => {
    expect(COLOR_THEMES.some((theme) => theme.id === "hot-tamale")).toBe(true);
  });
});
