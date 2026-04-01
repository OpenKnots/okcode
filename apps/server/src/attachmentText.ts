import { PROVIDER_SEND_TURN_MAX_INPUT_CHARS, type ChatFileAttachment } from "@okcode/contracts";

const MAX_FILE_CONTEXT_TOTAL_CHARS = 80_000;
const MAX_FILE_CONTEXT_CHARS_PER_FILE = 24_000;
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });
const TEXTUAL_MIME_SUBSTRINGS = [
  "json",
  "xml",
  "yaml",
  "toml",
  "javascript",
  "typescript",
  "markdown",
  "csv",
  "graphql",
  "sql",
  "x-sh",
  "x-shellscript",
];
const TEXTUAL_FILE_EXTENSIONS = new Set([
  "c",
  "cc",
  "cfg",
  "conf",
  "cpp",
  "cs",
  "css",
  "csv",
  "env",
  "go",
  "graphql",
  "h",
  "hpp",
  "html",
  "ini",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "log",
  "lua",
  "md",
  "mjs",
  "php",
  "pl",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "svg",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "vue",
  "xml",
  "yaml",
  "yml",
  "zsh",
]);

function attachmentExtension(fileName: string): string {
  const match = /\.([a-z0-9]{1,12})$/i.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

function looksTextLikeMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("text/")) {
    return true;
  }
  return TEXTUAL_MIME_SUBSTRINGS.some((part) => normalized.includes(part));
}

function looksTextLikeFileName(fileName: string): boolean {
  return TEXTUAL_FILE_EXTENSIONS.has(attachmentExtension(fileName));
}

function hasSuspiciousControlBytes(text: string): boolean {
  let suspiciousCount = 0;
  let visibleCount = 0;
  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.charCodeAt(index);
    if (codePoint === 0) {
      return true;
    }
    if (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13) {
      suspiciousCount += 1;
      continue;
    }
    visibleCount += 1;
  }
  if (visibleCount === 0) {
    return suspiciousCount > 0;
  }
  return suspiciousCount / Math.max(visibleCount, 1) > 0.02;
}

export function extractTextAttachmentContents(input: {
  readonly mimeType: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}): string | null {
  if (input.bytes.byteLength === 0) {
    return "";
  }
  const decoded = TEXT_DECODER.decode(input.bytes);
  if (hasSuspiciousControlBytes(decoded)) {
    return null;
  }
  const replacementCount = decoded.split("\uFFFD").length - 1;
  const replacementRatio = replacementCount / Math.max(decoded.length, 1);
  const expectedText =
    looksTextLikeMimeType(input.mimeType) || looksTextLikeFileName(input.fileName);
  if (replacementRatio > (expectedText ? 0.02 : 0.005)) {
    return null;
  }
  if (!expectedText && decoded.trim().length === 0) {
    return null;
  }
  return decoded.replace(/\r\n?/g, "\n");
}

export function buildFileAttachmentContextText(input: {
  readonly baseText: string;
  readonly attachments: ReadonlyArray<{
    readonly attachment: ChatFileAttachment;
    readonly text: string;
  }>;
  readonly maxChars?: number;
}): string {
  if (input.attachments.length === 0) {
    return input.baseText;
  }

  const maxChars = Math.max(1, Math.floor(input.maxChars ?? PROVIDER_SEND_TURN_MAX_INPUT_CHARS));
  let result = input.baseText;
  let usedFileContextChars = 0;
  let omittedCount = 0;

  const append = (chunk: string): boolean => {
    if (chunk.length === 0) {
      return true;
    }
    if (result.length + chunk.length > maxChars) {
      return false;
    }
    result += chunk;
    return true;
  };

  const header = `${result.length > 0 ? "\n\n" : ""}Attached file context:`;
  if (!append(header)) {
    return result;
  }

  for (const [index, entry] of input.attachments.entries()) {
    const openBlock =
      "\n\n<attached_file>\n" +
      `name: ${entry.attachment.name}\n` +
      `mime_type: ${entry.attachment.mimeType}\n` +
      `size_bytes: ${entry.attachment.sizeBytes}\n` +
      "content:\n";
    const closeBlock = "\n</attached_file>";
    const remainingContextBudget =
      MAX_FILE_CONTEXT_TOTAL_CHARS - usedFileContextChars - openBlock.length - closeBlock.length;
    const remainingTotalBudget = maxChars - result.length - openBlock.length - closeBlock.length;
    const maxContentChars = Math.min(
      MAX_FILE_CONTEXT_CHARS_PER_FILE,
      remainingContextBudget,
      remainingTotalBudget,
    );

    if (maxContentChars <= 0) {
      omittedCount = input.attachments.length - index;
      break;
    }

    const truncationNote = "\n[content truncated to fit input limits]";
    const needsTruncation = entry.text.length > maxContentChars;
    const availableContentChars = needsTruncation
      ? Math.max(0, maxContentChars - truncationNote.length)
      : maxContentChars;
    if (availableContentChars <= 0) {
      omittedCount = input.attachments.length - index;
      break;
    }

    const blockBody = entry.text.slice(0, availableContentChars);
    const block = `${openBlock}${blockBody}${needsTruncation ? truncationNote : ""}${closeBlock}`;
    if (!append(block)) {
      omittedCount = input.attachments.length - index;
      break;
    }
    usedFileContextChars += block.length;
  }

  if (omittedCount > 0) {
    append(`\n\n[${omittedCount} attached file(s) omitted due to input size limits.]`);
  }

  return result;
}
