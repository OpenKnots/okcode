import { describe, expect, it, vi } from "vitest";
import {
  openFileReference,
  resolveCodeViewerRelativePath,
  splitFileTargetPosition,
} from "./fileOpen";

describe("splitFileTargetPosition", () => {
  it("extracts line and column suffixes", () => {
    expect(splitFileTargetPosition("/Users/julius/project/src/main.ts:42:7")).toEqual({
      path: "/Users/julius/project/src/main.ts",
      line: 42,
      column: 7,
    });
  });

  it("leaves plain paths unchanged", () => {
    expect(splitFileTargetPosition("/Users/julius/project/README.md")).toEqual({
      path: "/Users/julius/project/README.md",
      line: null,
      column: null,
    });
  });
});

describe("resolveCodeViewerRelativePath", () => {
  it("maps an absolute target under cwd into a relative code viewer path", () => {
    expect(
      resolveCodeViewerRelativePath(
        "/Users/julius/project/src/components/ChatMarkdown.tsx:42",
        "/Users/julius/project",
      ),
    ).toBe("src/components/ChatMarkdown.tsx");
  });

  it("returns null for targets outside cwd", () => {
    expect(
      resolveCodeViewerRelativePath("/Users/julius/other/file.ts:1", "/Users/julius/project"),
    ).toBeNull();
  });
});

describe("openFileReference", () => {
  it("opens files in the code viewer when external editors are not preferred", async () => {
    const openInViewer = vi.fn();

    await openFileReference({
      api: {} as never,
      cwd: "/Users/julius/project",
      targetPath: "/Users/julius/project/src/main.ts:12:4",
      preferExternal: false,
      openInViewer,
    });

    expect(openInViewer).toHaveBeenCalledWith("/Users/julius/project", "src/main.ts");
  });
});
