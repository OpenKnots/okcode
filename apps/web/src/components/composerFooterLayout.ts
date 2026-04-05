export const COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX = 620;
export const COMPOSER_FOOTER_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX = 720;
const COMPOSER_FOOTER_CONTENT_BUFFER_PX = 12;

export function shouldUseCompactComposerFooter(
  width: number | null,
  options?: {
    hasWideActions?: boolean;
    leadingWidth?: number | null;
    trailingWidth?: number | null;
    gap?: number | null;
  },
): boolean {
  if (
    width !== null &&
    typeof options?.leadingWidth === "number" &&
    Number.isFinite(options.leadingWidth) &&
    typeof options.trailingWidth === "number" &&
    Number.isFinite(options.trailingWidth)
  ) {
    const requiredWidth =
      options.leadingWidth +
      options.trailingWidth +
      Math.max(0, options.gap ?? 0) +
      COMPOSER_FOOTER_CONTENT_BUFFER_PX;
    return width < requiredWidth;
  }

  const breakpoint = options?.hasWideActions
    ? COMPOSER_FOOTER_WIDE_ACTIONS_COMPACT_BREAKPOINT_PX
    : COMPOSER_FOOTER_COMPACT_BREAKPOINT_PX;
  return width !== null && width < breakpoint;
}
