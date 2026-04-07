import Mime from "@effect/platform-node/Mime";

const TEXT_FILE_MAX_BYTES = 1_048_576; // 1MB
const PREVIEW_FILE_MAX_BYTES = 15_728_640; // 15MB
const BINARY_SNIFF_BYTES = 8192;

export interface ResolvedFilePreview {
  readonly mimeType: string;
  readonly maxReadSizeBytes: number;
  readonly previewable: boolean;
  readonly textLike: boolean;
}

export function resolveFilePreview(pathname: string): ResolvedFilePreview {
  const mimeType = Mime.getType(pathname) ?? "application/octet-stream";
  const textLike = isTextLikeMimeType(mimeType);
  const previewable = isPreviewableMimeType(mimeType);
  return {
    mimeType,
    maxReadSizeBytes: textLike && !previewable ? TEXT_FILE_MAX_BYTES : PREVIEW_FILE_MAX_BYTES,
    previewable,
    textLike,
  };
}

export function containsBinaryBytes(rawBytes: Uint8Array): boolean {
  const checkLength = Math.min(rawBytes.length, BINARY_SNIFF_BYTES);
  for (let index = 0; index < checkLength; index += 1) {
    if (rawBytes[index] === 0) {
      return true;
    }
  }
  return false;
}

export function buildPreviewDataUrl(input: {
  mimeType: string;
  rawBytes: Uint8Array;
  containsBinaryData: boolean;
  previewableByMime: boolean;
}): string | null {
  if (!input.previewableByMime && !input.containsBinaryData) {
    return null;
  }
  const base64 = Buffer.from(input.rawBytes).toString("base64");
  return `data:${input.mimeType};base64,${base64}`;
}

function isPreviewableMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType === "application/pdf"
  );
}

function isTextLikeMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/ld+json" ||
    mimeType === "application/xml" ||
    mimeType === "application/x-sh" ||
    mimeType === "application/x-yaml" ||
    mimeType === "application/yaml" ||
    mimeType === "image/svg+xml" ||
    mimeType.endsWith("+json") ||
    mimeType.endsWith("+xml")
  );
}
