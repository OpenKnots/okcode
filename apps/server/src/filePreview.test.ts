import { describe, expect, it } from "vitest";

import { buildPreviewDataUrl, containsBinaryBytes, resolveFilePreview } from "./filePreview";

describe("resolveFilePreview", () => {
  it("treats plain text files as text-first", () => {
    expect(resolveFilePreview("/repo/notes.txt")).toEqual({
      mimeType: "text/plain",
      maxReadSizeBytes: 1_048_576,
      previewable: false,
      textLike: true,
    });
  });

  it("treats svg files as text-like and previewable", () => {
    expect(resolveFilePreview("/repo/image.svg")).toEqual({
      mimeType: "image/svg+xml",
      maxReadSizeBytes: 15_728_640,
      previewable: true,
      textLike: true,
    });
  });

  it("allows larger preview limits for binary files", () => {
    expect(resolveFilePreview("/repo/archive.bin")).toEqual({
      mimeType: "application/octet-stream",
      maxReadSizeBytes: 15_728_640,
      previewable: false,
      textLike: false,
    });
  });
});

describe("containsBinaryBytes", () => {
  it("detects null bytes", () => {
    expect(containsBinaryBytes(new Uint8Array([65, 0, 66]))).toBe(true);
  });

  it("ignores plain utf-8 text", () => {
    expect(containsBinaryBytes(new TextEncoder().encode("hello"))).toBe(false);
  });
});

describe("buildPreviewDataUrl", () => {
  it("creates previews for binary files", () => {
    expect(
      buildPreviewDataUrl({
        mimeType: "application/octet-stream",
        rawBytes: new Uint8Array([1, 2, 3]),
        containsBinaryData: true,
        previewableByMime: false,
      }),
    ).toBe("data:application/octet-stream;base64,AQID");
  });

  it("creates previews for previewable text-based formats", () => {
    expect(
      buildPreviewDataUrl({
        mimeType: "image/svg+xml",
        rawBytes: new TextEncoder().encode("<svg />"),
        containsBinaryData: false,
        previewableByMime: true,
      }),
    ).toBe("data:image/svg+xml;base64,PHN2ZyAvPg==");
  });

  it("skips previews for ordinary text files", () => {
    expect(
      buildPreviewDataUrl({
        mimeType: "text/plain",
        rawBytes: new TextEncoder().encode("hello"),
        containsBinaryData: false,
        previewableByMime: false,
      }),
    ).toBeNull();
  });
});
