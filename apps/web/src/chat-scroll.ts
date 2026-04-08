export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 64;

interface ScrollPosition {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export function isScrollContainerNearBottom(
  position: ScrollPosition,
  thresholdPx = AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
): boolean {
  const threshold = Number.isFinite(thresholdPx)
    ? Math.max(0, thresholdPx)
    : AUTO_SCROLL_BOTTOM_THRESHOLD_PX;

  const { scrollTop, clientHeight, scrollHeight } = position;
  if (![scrollTop, clientHeight, scrollHeight].every(Number.isFinite)) {
    return true;
  }

  const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
  return distanceFromBottom <= threshold;
}

/**
 * Minimum pixel delta required to interpret a scroll position change as an
 * intentional upward scroll. Sub-pixel jitter from the browser, virtualizer,
 * or layout shifts should not flip the auto-scroll state.
 */
export const SCROLL_UP_DETECTION_TOLERANCE_PX = 1;

export interface AutoScrollStateInputs {
  /** Previous value of the auto-scroll intent flag. */
  shouldAutoScroll: boolean;
  /** Whether a wheel/touch gesture has flagged a likely upward scroll. */
  pendingUserScrollUpIntent: boolean;
  /** Whether a pointer/touch press is currently driving the scroll. */
  isPointerScrollActive: boolean;
  /** Whether the container is currently within the auto-scroll threshold. */
  isNearBottom: boolean;
  /** Current scrollTop reported by the scroll event. */
  currentScrollTop: number;
  /** scrollTop captured from the previous scroll event. */
  lastKnownScrollTop: number;
}

export interface AutoScrollStateResult {
  /** Next value of the auto-scroll intent flag. */
  shouldAutoScroll: boolean;
  /** Next value of the pending user scroll-up intent flag. */
  pendingUserScrollUpIntent: boolean;
}

/**
 * Pure state-machine for the chat view's auto-scroll behavior.
 *
 * Mirrors the inline branches of `ChatView.onMessagesScroll` so the rules
 * around "should we still stick to the bottom?" can be exercised in unit
 * tests without rendering the full chat tree. Behavior is intentionally
 * identical to the previous inline implementation.
 *
 * Rules, in priority order:
 * 1. If auto-scroll was off but the user scrolled back to the bottom, turn
 *    it back on and clear any pending up-intent.
 * 2. If a wheel/touch gesture flagged an up-intent, only disable auto-scroll
 *    when the position actually moved up beyond the tolerance, then clear
 *    the intent flag (it has been consumed).
 * 3. If a pointer/touch press is driving the scroll, disable auto-scroll
 *    only on a real upward delta.
 * 4. Catch-all for keyboard / assistive scrolls: if we are no longer near
 *    the bottom and the position moved up beyond the tolerance, disable
 *    auto-scroll.
 */
export function computeNextAutoScrollState(
  inputs: AutoScrollStateInputs,
): AutoScrollStateResult {
  const {
    shouldAutoScroll,
    pendingUserScrollUpIntent,
    isPointerScrollActive,
    isNearBottom,
    currentScrollTop,
    lastKnownScrollTop,
  } = inputs;

  const scrolledUp =
    currentScrollTop < lastKnownScrollTop - SCROLL_UP_DETECTION_TOLERANCE_PX;

  if (!shouldAutoScroll && isNearBottom) {
    return { shouldAutoScroll: true, pendingUserScrollUpIntent: false };
  }

  if (shouldAutoScroll && pendingUserScrollUpIntent) {
    return {
      shouldAutoScroll: scrolledUp ? false : shouldAutoScroll,
      pendingUserScrollUpIntent: false,
    };
  }

  if (shouldAutoScroll && isPointerScrollActive) {
    return {
      shouldAutoScroll: scrolledUp ? false : shouldAutoScroll,
      pendingUserScrollUpIntent,
    };
  }

  if (shouldAutoScroll && !isNearBottom) {
    return {
      shouldAutoScroll: scrolledUp ? false : shouldAutoScroll,
      pendingUserScrollUpIntent,
    };
  }

  return { shouldAutoScroll, pendingUserScrollUpIntent };
}
