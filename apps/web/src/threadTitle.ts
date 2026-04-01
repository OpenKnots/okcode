export const DEFAULT_THREAD_TITLE = "New thread";

export function normalizeThreadTitle(title: string | null | undefined): string {
  const trimmed = title?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : DEFAULT_THREAD_TITLE;
}

export function hasCustomThreadTitle(title: string | null | undefined): boolean {
  return normalizeThreadTitle(title) !== DEFAULT_THREAD_TITLE;
}
