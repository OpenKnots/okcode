import { describe, expect, it } from "vitest";

import {
  AUTO_SCROLL_BOTTOM_THRESHOLD_PX,
  computeNextAutoScrollState,
  isScrollContainerNearBottom,
  type AutoScrollStateInputs,
} from "./chat-scroll";

describe("isScrollContainerNearBottom", () => {
  it("returns true when already at bottom", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 600,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(true);
  });

  it("returns true when within the auto-scroll threshold", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 540,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(true);
  });

  it("returns false when the user is meaningfully above the bottom", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 520,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(false);
  });

  it("clamps negative thresholds to zero", () => {
    expect(
      isScrollContainerNearBottom(
        {
          scrollTop: 539,
          clientHeight: 400,
          scrollHeight: 1_000,
        },
        -1,
      ),
    ).toBe(false);
  });

  it("falls back to the default threshold for non-finite values", () => {
    expect(
      isScrollContainerNearBottom(
        {
          scrollTop: 540,
          clientHeight: 400,
          scrollHeight: 1_000,
        },
        Number.NaN,
      ),
    ).toBe(true);
    expect(AUTO_SCROLL_BOTTOM_THRESHOLD_PX).toBe(64);
  });

  it("returns true when scrollTop overshoots scrollHeight (rubber-band)", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 700,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(true);
  });

  it("returns true at the exact boundary of the threshold", () => {
    // distanceFromBottom = 1000 - 400 - 536 = 64 (== threshold)
    expect(
      isScrollContainerNearBottom({
        scrollTop: 536,
        clientHeight: 400,
        scrollHeight: 1_000,
      }),
    ).toBe(true);
  });

  it("returns true when the container has zero size (degenerate)", () => {
    expect(
      isScrollContainerNearBottom({
        scrollTop: 0,
        clientHeight: 0,
        scrollHeight: 0,
      }),
    ).toBe(true);
  });
});

describe("computeNextAutoScrollState", () => {
  const baseInputs: AutoScrollStateInputs = {
    shouldAutoScroll: true,
    pendingUserScrollUpIntent: false,
    isPointerScrollActive: false,
    isNearBottom: true,
    currentScrollTop: 600,
    lastKnownScrollTop: 600,
  };

  it("re-engages auto-scroll when the user returns to the bottom", () => {
    // Issue #13 scenario: user scrolled up, then submits a message —
    // the submit handler scrolls to bottom, the resulting scroll event
    // should re-enable auto-scroll.
    const result = computeNextAutoScrollState({
      ...baseInputs,
      shouldAutoScroll: false,
      pendingUserScrollUpIntent: true,
      isNearBottom: true,
      currentScrollTop: 600,
      lastKnownScrollTop: 200,
    });
    expect(result.shouldAutoScroll).toBe(true);
    expect(result.pendingUserScrollUpIntent).toBe(false);
  });

  it("keeps auto-scroll on for a streaming response while user is at bottom", () => {
    // Issue #13 scenario: streaming response starts; user has not scrolled up.
    const result = computeNextAutoScrollState({
      ...baseInputs,
      currentScrollTop: 612,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(true);
  });

  it("keeps auto-scroll on across rapid optimistic submits at the bottom", () => {
    // Issue #13 scenario: multiple rapid submissions — each submit triggers
    // a scroll-to-bottom; consecutive scroll events at the bottom must not
    // flip the flag off.
    let state: AutoScrollStateInputs = { ...baseInputs };
    for (let i = 0; i < 5; i += 1) {
      const next = computeNextAutoScrollState(state);
      expect(next.shouldAutoScroll).toBe(true);
      state = {
        ...state,
        shouldAutoScroll: next.shouldAutoScroll,
        pendingUserScrollUpIntent: next.pendingUserScrollUpIntent,
        lastKnownScrollTop: state.currentScrollTop,
        currentScrollTop: state.currentScrollTop + 24,
      };
    }
  });

  it("disables auto-scroll when a wheel-flagged scroll moves up beyond tolerance", () => {
    const result = computeNextAutoScrollState({
      ...baseInputs,
      pendingUserScrollUpIntent: true,
      isNearBottom: false,
      currentScrollTop: 540,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(false);
    expect(result.pendingUserScrollUpIntent).toBe(false);
  });

  it("clears the wheel intent flag even if the position did not actually move up", () => {
    // The intent has been "consumed" by the scroll event regardless of outcome,
    // matching the inline implementation that always cleared the flag here.
    const result = computeNextAutoScrollState({
      ...baseInputs,
      pendingUserScrollUpIntent: true,
      currentScrollTop: 600,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(true);
    expect(result.pendingUserScrollUpIntent).toBe(false);
  });

  it("disables auto-scroll on a real upward delta during a pointer drag", () => {
    const result = computeNextAutoScrollState({
      ...baseInputs,
      isPointerScrollActive: true,
      isNearBottom: false,
      currentScrollTop: 500,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(false);
  });

  it("ignores sub-pixel jitter during a pointer drag", () => {
    const result = computeNextAutoScrollState({
      ...baseInputs,
      isPointerScrollActive: true,
      currentScrollTop: 599.5,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(true);
  });

  it("disables auto-scroll on keyboard scroll-up away from the bottom", () => {
    // Catch-all branch: no pointer, no wheel intent, just an upward scroll
    // (e.g. PageUp / arrow keys / assistive tech).
    const result = computeNextAutoScrollState({
      ...baseInputs,
      isNearBottom: false,
      currentScrollTop: 400,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(false);
  });

  it("does not disable auto-scroll on a downward keyboard scroll", () => {
    const result = computeNextAutoScrollState({
      ...baseInputs,
      isNearBottom: false,
      currentScrollTop: 650,
      lastKnownScrollTop: 600,
    });
    expect(result.shouldAutoScroll).toBe(true);
  });

  it("is a no-op when auto-scroll is already off and user is still above the bottom", () => {
    const result = computeNextAutoScrollState({
      ...baseInputs,
      shouldAutoScroll: false,
      isNearBottom: false,
      currentScrollTop: 200,
      lastKnownScrollTop: 200,
    });
    expect(result.shouldAutoScroll).toBe(false);
    expect(result.pendingUserScrollUpIntent).toBe(false);
  });
});
