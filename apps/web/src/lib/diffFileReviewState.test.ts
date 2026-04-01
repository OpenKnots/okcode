import { describe, expect, it } from "vitest";
import {
  acceptAllDiffFiles,
  expandDiffFile,
  reconcileDiffFileReviewState,
  toggleDiffFileAccepted,
  toggleDiffFileCollapsed,
} from "./diffFileReviewState";

describe("reconcileDiffFileReviewState", () => {
  it("preserves existing state for known files and drops removed files", () => {
    expect(
      reconcileDiffFileReviewState(["src/a.ts"], {
        "src/a.ts": { accepted: true, collapsed: true },
        "src/b.ts": { accepted: false, collapsed: true },
      }),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: true },
    });
  });

  it("initializes new files as unaccepted and collapsed", () => {
    expect(reconcileDiffFileReviewState(["src/a.ts"], undefined)).toEqual({
      "src/a.ts": { accepted: false, collapsed: true },
    });
  });
});

describe("toggleDiffFileAccepted", () => {
  it("marks a file accepted and collapses it", () => {
    expect(toggleDiffFileAccepted({}, "src/a.ts")).toEqual({
      "src/a.ts": { accepted: true, collapsed: true },
    });
  });

  it("clears acceptance and re-expands the file", () => {
    expect(
      toggleDiffFileAccepted(
        {
          "src/a.ts": { accepted: true, collapsed: true },
        },
        "src/a.ts",
      ),
    ).toEqual({
      "src/a.ts": { accepted: false, collapsed: false },
    });
  });
});

describe("acceptAllDiffFiles", () => {
  it("marks every listed file accepted and collapsed", () => {
    expect(
      acceptAllDiffFiles(
        {
          "src/a.ts": { accepted: false, collapsed: false, contextMode: "full" },
        },
        ["src/a.ts", "src/b.ts"],
      ),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: true, contextMode: "full" },
      "src/b.ts": { accepted: true, collapsed: true, contextMode: "patch" },
    });
  });

  it("returns the same object when every listed file is already accepted", () => {
    const state = {
      "src/a.ts": { accepted: true, collapsed: true, contextMode: "patch" as const },
      "src/b.ts": { accepted: true, collapsed: true, contextMode: "full" as const },
    };

    expect(acceptAllDiffFiles(state, ["src/a.ts", "src/b.ts"])).toBe(state);
  });
});

describe("toggleDiffFileCollapsed", () => {
  it("toggles collapsed without changing acceptance", () => {
    expect(
      toggleDiffFileCollapsed(
        {
          "src/a.ts": { accepted: true, collapsed: true },
        },
        "src/a.ts",
      ),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: false },
    });
  });
});

describe("expandDiffFile", () => {
  it("expands a collapsed file without clearing acceptance", () => {
    expect(
      expandDiffFile(
        {
          "src/a.ts": { accepted: true, collapsed: true },
        },
        "src/a.ts",
      ),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: false },
    });
  });

  it("returns the same object when the file is already expanded", () => {
    const state = {
      "src/a.ts": { accepted: false, collapsed: false },
    } satisfies Record<string, { accepted: boolean; collapsed: boolean }>;
    // File is already expanded, so the same object reference is returned.
    expect(expandDiffFile(state, "src/a.ts")).toBe(state);
  });
});
