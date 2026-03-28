import { useEffect, useRef } from "react";

/**
 * Given previous and current open states for three right-side panels,
 * returns which panels should be closed to enforce mutual exclusivity,
 * or an empty array if no action is needed.
 *
 * The rule is: whichever panel just transitioned from closed → open wins;
 * all other open panels are closed.
 */
export function resolveExclusivePanelAction(
  prevDiffOpen: boolean,
  diffOpen: boolean,
  prevCodeViewerOpen: boolean,
  codeViewerOpen: boolean,
  prevPreviewOpen: boolean,
  previewOpen: boolean,
): Array<"close-diff" | "close-code-viewer" | "close-preview"> {
  const diffJustOpened = diffOpen && !prevDiffOpen;
  const codeViewerJustOpened = codeViewerOpen && !prevCodeViewerOpen;
  const previewJustOpened = previewOpen && !prevPreviewOpen;

  const actions: Array<"close-diff" | "close-code-viewer" | "close-preview"> = [];

  if (diffJustOpened) {
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (previewOpen) actions.push("close-preview");
  } else if (codeViewerJustOpened) {
    if (diffOpen) actions.push("close-diff");
    if (previewOpen) actions.push("close-preview");
  } else if (previewJustOpened) {
    if (diffOpen) actions.push("close-diff");
    if (codeViewerOpen) actions.push("close-code-viewer");
  }

  return actions;
}

/**
 * Ensures that the diff panel, code viewer, and preview panel are never open
 * simultaneously. When one panel transitions from closed → open while another
 * is already open, the previously-open panel(s) are closed.
 */
export function useMutuallyExclusivePanels(
  diffOpen: boolean,
  codeViewerOpen: boolean,
  previewOpen: boolean,
  closeDiff: () => void,
  closeCodeViewer: () => void,
  closePreview: () => void,
) {
  const prevDiffOpen = useRef(diffOpen);
  const prevCodeViewerOpen = useRef(codeViewerOpen);
  const prevPreviewOpen = useRef(previewOpen);

  useEffect(() => {
    const wasDiffOpen = prevDiffOpen.current;
    const wasCodeViewerOpen = prevCodeViewerOpen.current;
    const wasPreviewOpen = prevPreviewOpen.current;
    prevDiffOpen.current = diffOpen;
    prevCodeViewerOpen.current = codeViewerOpen;
    prevPreviewOpen.current = previewOpen;

    const actions = resolveExclusivePanelAction(
      wasDiffOpen,
      diffOpen,
      wasCodeViewerOpen,
      codeViewerOpen,
      wasPreviewOpen,
      previewOpen,
    );
    for (const action of actions) {
      if (action === "close-code-viewer") {
        closeCodeViewer();
      } else if (action === "close-diff") {
        closeDiff();
      } else if (action === "close-preview") {
        closePreview();
      }
    }
  }, [diffOpen, codeViewerOpen, previewOpen, closeDiff, closeCodeViewer, closePreview]);
}
