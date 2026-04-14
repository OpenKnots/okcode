import { describe, expect, it, vi } from "vitest";
import type { NativeApi } from "@okcode/contracts";

import { normalizeProjectIconPath, resolveSuggestedProjectIconPath } from "./projectIcons";

describe("project icon helpers", () => {
  it("normalizes icon paths by trimming and treating blanks as null", () => {
    expect(normalizeProjectIconPath("  public/icon.svg  ")).toBe("public/icon.svg");
    expect(normalizeProjectIconPath("  https://cdn.example.com/icon.gif  ")).toBe(
      "https://cdn.example.com/icon.gif",
    );
    expect(normalizeProjectIconPath("   ")).toBeNull();
    expect(normalizeProjectIconPath(null)).toBeNull();
  });

  it("prefers the first well-known fallback candidate that exists in the workspace", async () => {
    const searchEntries = vi.fn(async ({ query }: { query: string }) => {
      if (query === "favicon") {
        return {
          entries: [],
          truncated: false,
        };
      }

      return {
        entries: [
          { path: "assets/logo.svg", kind: "file" },
          { path: "public/favicon.ico", kind: "file" },
        ],
        truncated: false,
      };
    });

    const api = { projects: { searchEntries } } as unknown as Pick<NativeApi, "projects">;
    const suggestion = await resolveSuggestedProjectIconPath(api, "/repo");

    expect(suggestion).toBe("public/favicon.ico");
    expect(searchEntries).toHaveBeenCalledTimes(2);
  });
});
