import { describe, expect, it } from "vitest";

import {
  buildAttachmentPreviewModel,
  buildAttachmentPreviewTreeFiles,
  isLikelyDiffAttachment,
} from "./attachmentPreview";

describe("isLikelyDiffAttachment", () => {
  it("detects git patch attachments by file name", () => {
    expect(
      isLikelyDiffAttachment({
        name: "changes.patch",
        mimeType: "text/plain",
        text: "plain text",
      }),
    ).toBe(true);
  });

  it("detects unified diffs by content even without a patch extension", () => {
    expect(
      isLikelyDiffAttachment({
        name: "notes.txt",
        mimeType: "text/plain",
        text: "diff --git a/apps/web/src/index.ts b/apps/web/src/index.ts\n",
      }),
    ).toBe(true);
  });
});

describe("buildAttachmentPreviewModel", () => {
  it("builds a diff preview for parseable patch attachments", () => {
    const preview = buildAttachmentPreviewModel({
      name: "changes.patch",
      mimeType: "text/x-patch",
      text: [
        "diff --git a/apps/web/src/index.ts b/apps/web/src/index.ts",
        "--- a/apps/web/src/index.ts",
        "+++ b/apps/web/src/index.ts",
        "@@ -1 +1 @@",
        "-oldValue();",
        "+newValue();",
      ].join("\n"),
    });

    expect(preview.kind).toBe("diff");
    if (preview.kind !== "diff") {
      throw new Error("Expected a diff preview");
    }

    expect(preview.files).toHaveLength(1);
    expect(preview.files[0] && buildAttachmentPreviewTreeFiles(preview.files)).toEqual([
      {
        path: "apps/web/src/index.ts",
        additions: 1,
        deletions: 1,
      },
    ]);
  });

  it("falls back to a text preview for non-diff attachments", () => {
    const preview = buildAttachmentPreviewModel({
      name: "README.md",
      mimeType: "text/markdown",
      text: "# Hello\n",
    });

    expect(preview).toEqual({
      kind: "text",
      text: "# Hello\n",
      language: "markdown",
    });
  });
});
