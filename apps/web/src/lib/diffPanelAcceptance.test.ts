import { describe, expect, it } from "vitest";

import { buildAcceptedDiffFileKey, filterAcceptedDiffFiles } from "./diffPanelAcceptance";

describe("diffPanelAcceptance", () => {
  it("prefers the parser cache key when present", () => {
    expect(
      buildAcceptedDiffFileKey({
        cacheKey: "cache:file-a",
        name: "b/src/file-a.ts",
      } as never),
    ).toBe("cache:file-a");
  });

  it("falls back to a stable path pair when the parser cache key is unavailable", () => {
    expect(
      buildAcceptedDiffFileKey({
        prevName: "a/src/file-a.ts",
        name: "b/src/file-a.ts",
      } as never),
    ).toBe("a/src/file-a.ts:b/src/file-a.ts");
  });

  it("filters accepted files out of the rendered diff list", () => {
    const first = {
      cacheKey: "cache:first",
      name: "b/src/first.ts",
    } as never;
    const second = {
      cacheKey: "cache:second",
      name: "b/src/second.ts",
    } as never;

    expect(filterAcceptedDiffFiles([first, second], new Set(["cache:first"]))).toEqual([second]);
  });
});
