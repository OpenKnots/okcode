import { type DesktopPreviewElementSelection, type ThreadId } from "@okcode/contracts";

export interface PreviewContextSelection extends DesktopPreviewElementSelection {}

export interface PreviewContextDraft extends PreviewContextSelection {
  id: string;
  threadId: ThreadId;
  createdAt: string;
}

export interface ParsedPreviewContextEntry {
  header: string;
  body: string;
}

export interface ExtractedPreviewContexts {
  promptText: string;
  contextCount: number;
  previewTitle: string | null;
  contexts: ParsedPreviewContextEntry[];
}

const TRAILING_PREVIEW_CONTEXT_BLOCK_PATTERN =
  /\n*<preview_context>\n([\s\S]*?)\n<\/preview_context>\s*$/;

function normalizePreviewContextField(value: string | null | undefined, maxLength = 180): string {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

export function buildPreviewContextDedupKey(context: {
  pageUrl: string;
  selector: string;
}): string {
  return `${context.pageUrl}\u0000${context.selector}`;
}

export function normalizePreviewContextSelection(
  selection: PreviewContextSelection,
): PreviewContextSelection | null {
  const pageUrl = normalizePreviewContextField(selection.pageUrl, 400);
  const selector = normalizePreviewContextField(selection.selector, 240);
  const tagName = normalizePreviewContextField(selection.tagName, 40).toLowerCase();
  if (pageUrl.length === 0 || selector.length === 0 || tagName.length === 0) {
    return null;
  }

  return {
    pageUrl,
    pageTitle: normalizePreviewContextField(selection.pageTitle, 180) || null,
    selector,
    tagName,
    role: normalizePreviewContextField(selection.role, 80) || null,
    ariaLabel: normalizePreviewContextField(selection.ariaLabel, 120) || null,
    text: normalizePreviewContextField(selection.text, 180),
    href: normalizePreviewContextField(selection.href, 400) || null,
    name: normalizePreviewContextField(selection.name, 120) || null,
    placeholder: normalizePreviewContextField(selection.placeholder, 120) || null,
  };
}

function formatPreviewContextPrimaryLabel(selection: {
  ariaLabel: string | null;
  text: string;
  placeholder: string | null;
  name: string | null;
  selector: string;
}): string {
  const primary =
    selection.ariaLabel ||
    selection.text ||
    selection.placeholder ||
    selection.name ||
    selection.selector;
  if (primary === selection.selector) {
    return selection.selector;
  }
  return `"${primary}"`;
}

export function formatPreviewContextLabel(selection: {
  tagName: string;
  role: string | null;
  ariaLabel: string | null;
  text: string;
  placeholder: string | null;
  name: string | null;
  selector: string;
}): string {
  const kind = selection.role || selection.tagName || "element";
  const primaryLabel = formatPreviewContextPrimaryLabel(selection);
  return primaryLabel === selection.selector
    ? `${kind} ${primaryLabel}`
    : `${kind} ${primaryLabel}`;
}

export function buildInlinePreviewContextText(
  contexts: ReadonlyArray<{
    header: string;
  }>,
): string {
  return contexts
    .map((context) => context.header.trim())
    .filter((header) => header.length > 0)
    .join(" ");
}

function buildPreviewContextBodyLines(selection: PreviewContextSelection): string[] {
  const lines = [
    selection.pageTitle ? `page: ${selection.pageTitle}` : null,
    `url: ${selection.pageUrl}`,
    `selector: ${selection.selector}`,
    `tag: ${selection.tagName}`,
    selection.role ? `role: ${selection.role}` : null,
    selection.ariaLabel ? `aria-label: ${selection.ariaLabel}` : null,
    selection.text.length > 0 ? `text: ${selection.text}` : null,
    selection.href ? `href: ${selection.href}` : null,
    selection.name ? `name: ${selection.name}` : null,
    selection.placeholder ? `placeholder: ${selection.placeholder}` : null,
  ].filter((line): line is string => line !== null);

  return lines.map((line) => `  ${line}`);
}

export function buildPreviewContextBlock(contexts: ReadonlyArray<PreviewContextSelection>): string {
  const normalizedContexts = contexts
    .map((context) => normalizePreviewContextSelection(context))
    .filter((context): context is PreviewContextSelection => context !== null);
  if (normalizedContexts.length === 0) {
    return "";
  }

  const lines: string[] = [];
  for (let index = 0; index < normalizedContexts.length; index += 1) {
    const context = normalizedContexts[index]!;
    lines.push(`- ${formatPreviewContextLabel(context)}:`);
    lines.push(...buildPreviewContextBodyLines(context));
    if (index < normalizedContexts.length - 1) {
      lines.push("");
    }
  }

  return ["<preview_context>", ...lines, "</preview_context>"].join("\n");
}

export function appendPreviewContextsToPrompt(
  prompt: string,
  contexts: ReadonlyArray<PreviewContextSelection>,
): string {
  const trimmedPrompt = prompt.trim();
  const contextBlock = buildPreviewContextBlock(contexts);
  if (contextBlock.length === 0) {
    return trimmedPrompt;
  }
  return trimmedPrompt.length > 0 ? `${trimmedPrompt}\n\n${contextBlock}` : contextBlock;
}

export function extractTrailingPreviewContexts(prompt: string): ExtractedPreviewContexts {
  const match = TRAILING_PREVIEW_CONTEXT_BLOCK_PATTERN.exec(prompt);
  if (!match) {
    return {
      promptText: prompt,
      contextCount: 0,
      previewTitle: null,
      contexts: [],
    };
  }

  const promptText = prompt.slice(0, match.index).replace(/\n+$/, "");
  const parsedContexts = parsePreviewContextEntries(match[1] ?? "");
  return {
    promptText,
    contextCount: parsedContexts.length,
    previewTitle:
      parsedContexts.length > 0
        ? parsedContexts
            .map(({ header, body }) => (body.length > 0 ? `${header}\n${body}` : header))
            .join("\n\n")
        : null,
    contexts: parsedContexts,
  };
}

function parsePreviewContextEntries(block: string): ParsedPreviewContextEntry[] {
  const entries: ParsedPreviewContextEntry[] = [];
  let current: { header: string; bodyLines: string[] } | null = null;

  const commitCurrent = () => {
    if (!current) {
      return;
    }
    entries.push({
      header: current.header,
      body: current.bodyLines.join("\n").trimEnd(),
    });
    current = null;
  };

  for (const rawLine of block.split("\n")) {
    const headerMatch = /^- (.+):$/.exec(rawLine);
    if (headerMatch) {
      commitCurrent();
      current = {
        header: headerMatch[1]!,
        bodyLines: [],
      };
      continue;
    }
    if (!current) {
      continue;
    }
    if (rawLine.startsWith("  ")) {
      current.bodyLines.push(rawLine.slice(2));
      continue;
    }
    if (rawLine.length === 0) {
      current.bodyLines.push("");
    }
  }

  commitCurrent();
  return entries;
}
