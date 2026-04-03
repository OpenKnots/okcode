export function truncateTitle(text: string, maxLength = 60): string {
  // Collapse whitespace (newlines, tabs, multiple spaces) into single spaces
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  // Try to truncate at a word boundary
  const lastSpace = trimmed.lastIndexOf(" ", maxLength);
  const cutPoint = lastSpace > maxLength / 2 ? lastSpace : maxLength;
  return `${trimmed.slice(0, cutPoint)}...`;
}
