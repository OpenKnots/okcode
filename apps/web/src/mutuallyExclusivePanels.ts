import { useEffect, useRef } from "react";

/**
 * Given previous and current open states for the diff panel and code viewer,
 * returns which panel should be closed to enforce mutual exclusivity, or `null`
 * if no action is needed.
 *
 * The rule is: whichever panel just transitioned from closed → open wins; the
 * other panel is closed.
 */
export function resolveExclusivePanelAction(
  prevDiffOpen: boolean,
  diffOpen: boolean,
  prevCodeViewerOpen: boolean,
  codeViewerOpen: boolean,
): "close-code-viewer" | "close-diff" | null {
  // Diff just opened while code viewer is already open → close code viewer
  if (diffOpen && !prevDiffOpen && codeViewerOpen) {
    return "close-code-viewer";
  }

  // Code viewer just opened while diff is already open → close diff
  if (codeViewerOpen && !prevCodeViewerOpen && diffOpen) {
    return "close-diff";
  }

  return null;
}

/**
 * Ensures that the diff panel and code viewer are never open simultaneously.
 * When one panel transitions from closed → open while the other is already open,
 * the previously-open panel is closed. This prevents overlapping fixed-position
 * sidebars and the phantom gap that results from two sidebar gap divs reserving
 * layout space while the fixed containers stack at `right: 0`.
 */
export function useMutuallyExclusivePanels(
  diffOpen: boolean,
  codeViewerOpen: boolean,
  closeDiff: () => void,
  closeCodeViewer: () => void,
) {
  const prevDiffOpen = useRef(diffOpen);
  const prevCodeViewerOpen = useRef(codeViewerOpen);

  useEffect(() => {
    const wasDiffOpen = prevDiffOpen.current;
    const wasCodeViewerOpen = prevCodeViewerOpen.current;
    prevDiffOpen.current = diffOpen;
    prevCodeViewerOpen.current = codeViewerOpen;

    const action = resolveExclusivePanelAction(wasDiffOpen, diffOpen, wasCodeViewerOpen, codeViewerOpen);
    if (action === "close-code-viewer") {
      closeCodeViewer();
    } else if (action === "close-diff") {
      closeDiff();
    }
  }, [diffOpen, codeViewerOpen, closeDiff, closeCodeViewer]);
}
