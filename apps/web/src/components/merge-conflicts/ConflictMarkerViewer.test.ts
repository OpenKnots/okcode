import { describe, expect, it } from "vitest";
import { hasConflictMarkers, parseConflictMarkers } from "./ConflictMarkerViewer";

describe("parseConflictMarkers", () => {
  it("parses a single conflict block", () => {
    const input = [
      "line before",
      "<<<<<<< HEAD",
      "ours line 1",
      "ours line 2",
      "=======",
      "theirs line 1",
      ">>>>>>> feature-branch",
      "line after",
    ].join("\n");

    const lines = parseConflictMarkers(input);
    expect(lines).toEqual([
      { kind: "context", text: "line before", lineNumber: 1 },
      { kind: "ours-header", text: "<<<<<<< HEAD", lineNumber: 2 },
      { kind: "ours", text: "ours line 1", lineNumber: 3 },
      { kind: "ours", text: "ours line 2", lineNumber: 4 },
      { kind: "separator", text: "=======", lineNumber: 5 },
      { kind: "theirs", text: "theirs line 1", lineNumber: 6 },
      { kind: "theirs-header", text: ">>>>>>> feature-branch", lineNumber: 7 },
      { kind: "context", text: "line after", lineNumber: 8 },
    ]);
  });

  it("parses multiple conflict blocks", () => {
    const input = [
      "<<<<<<< HEAD",
      "a",
      "=======",
      "b",
      ">>>>>>> branch",
      "middle",
      "<<<<<<< HEAD",
      "c",
      "=======",
      "d",
      ">>>>>>> branch",
    ].join("\n");

    const lines = parseConflictMarkers(input);
    expect(lines.filter((l) => l.kind === "ours-header")).toHaveLength(2);
    expect(lines.filter((l) => l.kind === "theirs-header")).toHaveLength(2);
    expect(lines.filter((l) => l.kind === "context")).toHaveLength(1);
  });

  it("handles file with no conflict markers", () => {
    const input = "just a normal file\nwith two lines";
    const lines = parseConflictMarkers(input);
    expect(lines).toEqual([
      { kind: "context", text: "just a normal file", lineNumber: 1 },
      { kind: "context", text: "with two lines", lineNumber: 2 },
    ]);
  });

  it("handles trailing newline without adding an extra empty line", () => {
    const input = "line 1\nline 2\n";
    const lines = parseConflictMarkers(input);
    expect(lines).toHaveLength(2);
  });

  it("handles empty ours side", () => {
    const input = ["<<<<<<< HEAD", "=======", "theirs only", ">>>>>>> branch"].join("\n");

    const lines = parseConflictMarkers(input);
    expect(lines.filter((l) => l.kind === "ours")).toHaveLength(0);
    expect(lines.filter((l) => l.kind === "theirs")).toHaveLength(1);
  });
});

describe("hasConflictMarkers", () => {
  it("returns true when markers are present", () => {
    expect(hasConflictMarkers("<<<<<<< HEAD\nfoo\n=======\nbar\n>>>>>>> b")).toBe(true);
  });

  it("returns true when markers start at beginning of text", () => {
    expect(hasConflictMarkers("<<<<<<< HEAD")).toBe(true);
  });

  it("returns false for normal text", () => {
    expect(hasConflictMarkers("just some normal code")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasConflictMarkers("")).toBe(false);
  });
});
