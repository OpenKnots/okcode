const PROVIDER_ATTRIBUTION_MARKERS = [
  "claude code",
  "anthropic",
  "codex",
  "openai codex",
  "openai",
  "github copilot",
  "copilot",
  "cursor",
  "gemini",
  "noreply@anthropic.com",
  "noreply@openai.com",
  "copilot@github.com",
] as const;

const TRAILER_LINE_PATTERN = /^(?:co-authored-by|signed-off-by):/i;
const ATTRIBUTION_LINE_PATTERN =
  /^(?:this (?:commit|pull request|pr) was\s+)?(?:generated|created|authored|written)\s+(?:with|by)\s+(.+?)(?:[.!])?$/i;

function normalizeAttributionLine(line: string): string {
  return line
    .trim()
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1")
    .replace(/^[-*]\s+/, "")
    .replace(/^🤖\s*/, "")
    .replace(/\s+/g, " ");
}

function containsProviderAttributionMarker(value: string): boolean {
  const lower = value.toLowerCase();
  return PROVIDER_ATTRIBUTION_MARKERS.some((marker) => lower.includes(marker));
}

function isLikelyProviderLabel(value: string): boolean {
  const normalized = value
    .trim()
    .replace(/[()[\]{}"'`]/g, "")
    .replace(/\s+/g, " ");
  if (!containsProviderAttributionMarker(normalized)) {
    return false;
  }
  return normalized.split(" ").filter(Boolean).length <= 4;
}

function isProviderAttributionLine(line: string): boolean {
  const normalized = normalizeAttributionLine(line);
  if (normalized.length === 0) {
    return false;
  }

  if (TRAILER_LINE_PATTERN.test(normalized) && containsProviderAttributionMarker(normalized)) {
    return true;
  }

  const attributionMatch = normalized.match(ATTRIBUTION_LINE_PATTERN);
  if (!attributionMatch) {
    return false;
  }

  const tail = attributionMatch[1] ?? "";
  return isLikelyProviderLabel(tail);
}

function trimBlankLines(lines: readonly string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim().length === 0) {
    start += 1;
  }
  while (end > start && lines[end - 1]?.trim().length === 0) {
    end -= 1;
  }

  const trimmed = lines.slice(start, end);
  const compacted: string[] = [];
  let previousWasBlank = false;

  for (const line of trimmed) {
    const normalizedLine = line.trimEnd();
    const isBlank = normalizedLine.length === 0;
    if (isBlank) {
      if (previousWasBlank) {
        continue;
      }
      previousWasBlank = true;
      compacted.push("");
      continue;
    }

    previousWasBlank = false;
    compacted.push(normalizedLine);
  }

  return compacted;
}

export function stripProviderAttribution(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const keptLines = normalized.split("\n").filter((line) => !isProviderAttributionLine(line));
  return trimBlankLines(keptLines).join("\n").trim();
}

export function sanitizeGeneratedCommitSubject(raw: string): string {
  const sanitized = stripProviderAttribution(raw);
  const singleLine = sanitized.split("\n")[0]?.trim() ?? "";
  const withoutTrailingPeriod = singleLine.replace(/[.]+$/g, "").trim();
  if (withoutTrailingPeriod.length === 0) {
    return "Update project files";
  }

  if (withoutTrailingPeriod.length <= 72) {
    return withoutTrailingPeriod;
  }
  return withoutTrailingPeriod.slice(0, 72).trimEnd();
}

export function sanitizeGeneratedCommitBody(raw: string): string {
  return stripProviderAttribution(raw);
}

export function sanitizeGeneratedPrTitle(raw: string): string {
  const sanitized = stripProviderAttribution(raw);
  const singleLine = sanitized.split("\n")[0]?.trim() ?? "";
  if (singleLine.length > 0) {
    return singleLine;
  }
  return "Update project changes";
}

export function sanitizeGeneratedPrBody(raw: string): string {
  return stripProviderAttribution(raw);
}
