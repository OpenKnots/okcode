import { describe, expect, it } from "vitest";
import {
  expandDiffFile,
  reconcileDiffFileReviewState,
  setDiffFileContextMode,
  toggleDiffFileAccepted,
  toggleDiffFileCollapsed,
} from "./diffFileReviewState";

describe("reconcileDiffFileReviewState", () => {
  it("preserves existing state for known files and drops removed files", () => {
    expect(
      reconcileDiffFileReviewState(["src/a.ts"], {
        "src/a.ts": { accepted: true, collapsed: true, contextMode: "full" },
        "src/b.ts": { accepted: false, collapsed: true, contextMode: "patch" },
      }),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: true, contextMode: "full" },
    });
  });

  it("initializes new files as unaccepted and collapsed", () => {
    expect(reconcileDiffFileReviewState(["src/a.ts"], undefined)).toEqual({
      "src/a.ts": { accepted: false, collapsed: true, contextMode: "patch" },
    });
  });
});

describe("toggleDiffFileAccepted", () => {
  it("marks a file accepted and collapses it", () => {
    expect(toggleDiffFileAccepted({}, "src/a.ts")).toEqual({
      "src/a.ts": { accepted: true, collapsed: true, contextMode: "patch" },
    });
  });

  it("clears acceptance and re-expands the file", () => {
    expect(
      toggleDiffFileAccepted(
        {
          "src/a.ts": { accepted: true, collapsed: true, contextMode: "full" },
        },
        "src/a.ts",
      ),
    ).toEqual({
      "src/a.ts": { accepted: false, collapsed: false, contextMode: "full" },
    });
  });
});

describe("toggleDiffFileCollapsed", () => {
  it("toggles collapsed without changing acceptance", () => {
    expect(
      toggleDiffFileCollapsed(
        {
          "src/a.ts": { accepted: true, collapsed: true, contextMode: "full" },
        },
        "src/a.ts",
      ),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: false, contextMode: "full" },
    });
  });
});

describe("setDiffFileContextMode", () => {
  it("updates the file context mode without changing other state", () => {
    expect(
      setDiffFileContextMode(
        {
          "src/a.ts": { accepted: true, collapsed: false, contextMode: "patch" },
        },
        "src/a.ts",
        "full",
      ),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: false, contextMode: "full" },
    });
  });
});

describe("expandDiffFile", () => {
  it("expands a collapsed file without clearing acceptance", () => {
    expect(
      expandDiffFile(
        {
          "src/a.ts": { accepted: true, collapsed: true, contextMode: "patch" },
        },
        "src/a.ts",
      ),
    ).toEqual({
      "src/a.ts": { accepted: true, collapsed: false, contextMode: "patch" },
    });
  });

  it("returns the same object when the file is already expanded", () => {
    const state = {
      "src/a.ts": { accepted: false, collapsed: false, contextMode: "patch" },
    };
    // File is already expanded, so the same object reference is returned.
    expect(expandDiffFile(state, "src/a.ts")).toBe(state);
  });
});
