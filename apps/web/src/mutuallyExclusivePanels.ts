import { useEffect, useRef } from "react";

/**
 * Action types for panel mutual exclusivity enforcement.
 */
export type ExclusivePanelAction =
  | "close-code-viewer"
  | "close-preview"
  | "close-simulation"
  | "close-diff-viewer";

/**
 * Given previous and current open states for the right-side panels,
 * returns which panels should be closed to enforce mutual exclusivity,
 * or an empty array if no action is needed.
 *
 * The rule is: whichever panel just transitioned from closed → open wins;
 * all other open panels are closed.
 */
export function resolveExclusivePanelAction(
  prevCodeViewerOpen: boolean,
  codeViewerOpen: boolean,
  prevDiffViewerOpen: boolean,
  diffViewerOpen: boolean,
  prevPreviewOpen: boolean,
  previewOpen: boolean,
  prevSimulationOpen: boolean = false,
  simulationOpen: boolean = false,
): ExclusivePanelAction[] {
  const codeViewerJustOpened = codeViewerOpen && !prevCodeViewerOpen;
  const diffViewerJustOpened = diffViewerOpen && !prevDiffViewerOpen;
  const previewJustOpened = previewOpen && !prevPreviewOpen;
  const simulationJustOpened = simulationOpen && !prevSimulationOpen;

  const actions: ExclusivePanelAction[] = [];

  if (codeViewerJustOpened) {
    if (diffViewerOpen) actions.push("close-diff-viewer");
    if (previewOpen) actions.push("close-preview");
    if (simulationOpen) actions.push("close-simulation");
  } else if (diffViewerJustOpened) {
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (previewOpen) actions.push("close-preview");
    if (simulationOpen) actions.push("close-simulation");
  } else if (previewJustOpened) {
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (diffViewerOpen) actions.push("close-diff-viewer");
    if (simulationOpen) actions.push("close-simulation");
  } else if (simulationJustOpened) {
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (diffViewerOpen) actions.push("close-diff-viewer");
    if (previewOpen) actions.push("close-preview");
  }

  return actions;
}

/**
 * Ensures that the code viewer, preview panel, and simulation
 * viewer are never open simultaneously. When one panel transitions from
 * closed → open while another is already open, the previously-open panel(s)
 * are closed.
 */
export function useMutuallyExclusivePanels(
  codeViewerOpen: boolean,
  diffViewerOpen: boolean,
  previewOpen: boolean,
  closeCodeViewer: () => void,
  closeDiffViewer: () => void,
  closePreview: () => void,
  simulationOpen: boolean = false,
  closeSimulation?: () => void,
) {
  const prevCodeViewerOpen = useRef(codeViewerOpen);
  const prevDiffViewerOpen = useRef(diffViewerOpen);
  const prevPreviewOpen = useRef(previewOpen);
  const prevSimulationOpen = useRef(simulationOpen);

  useEffect(() => {
    const wasCodeViewerOpen = prevCodeViewerOpen.current;
    const wasDiffViewerOpen = prevDiffViewerOpen.current;
    const wasPreviewOpen = prevPreviewOpen.current;
    const wasSimulationOpen = prevSimulationOpen.current;
    prevCodeViewerOpen.current = codeViewerOpen;
    prevDiffViewerOpen.current = diffViewerOpen;
    prevPreviewOpen.current = previewOpen;
    prevSimulationOpen.current = simulationOpen;

    const actions = resolveExclusivePanelAction(
      wasCodeViewerOpen,
      codeViewerOpen,
      wasDiffViewerOpen,
      diffViewerOpen,
      wasPreviewOpen,
      previewOpen,
      wasSimulationOpen,
      simulationOpen,
    );
    for (const action of actions) {
      if (action === "close-code-viewer") {
        closeCodeViewer();
      } else if (action === "close-diff-viewer") {
        closeDiffViewer();
      } else if (action === "close-preview") {
        closePreview();
      } else if (action === "close-simulation") {
        closeSimulation?.();
      }
    }
  }, [
    codeViewerOpen,
    diffViewerOpen,
    previewOpen,
    simulationOpen,
    closeCodeViewer,
    closeDiffViewer,
    closePreview,
    closeSimulation,
  ]);
}
