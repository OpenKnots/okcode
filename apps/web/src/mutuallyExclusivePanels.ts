import { useEffect, useRef } from "react";

/**
 * Action types for panel mutual exclusivity enforcement.
 */
export type ExclusivePanelAction =
  | "close-diff"
  | "close-code-viewer"
  | "close-preview"
  | "close-simulation";

/**
 * Given previous and current open states for the right-side panels,
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
  prevSimulationOpen: boolean = false,
  simulationOpen: boolean = false,
): ExclusivePanelAction[] {
  const diffJustOpened = diffOpen && !prevDiffOpen;
  const codeViewerJustOpened = codeViewerOpen && !prevCodeViewerOpen;
  const previewJustOpened = previewOpen && !prevPreviewOpen;
  const simulationJustOpened = simulationOpen && !prevSimulationOpen;

  const actions: ExclusivePanelAction[] = [];

  if (diffJustOpened) {
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (previewOpen) actions.push("close-preview");
    if (simulationOpen) actions.push("close-simulation");
  } else if (codeViewerJustOpened) {
    if (diffOpen) actions.push("close-diff");
    if (previewOpen) actions.push("close-preview");
    if (simulationOpen) actions.push("close-simulation");
  } else if (previewJustOpened) {
    if (diffOpen) actions.push("close-diff");
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (simulationOpen) actions.push("close-simulation");
  } else if (simulationJustOpened) {
    if (diffOpen) actions.push("close-diff");
    if (codeViewerOpen) actions.push("close-code-viewer");
    if (previewOpen) actions.push("close-preview");
  }

  return actions;
}

/**
 * Ensures that the diff panel, code viewer, preview panel, and simulation
 * viewer are never open simultaneously. When one panel transitions from
 * closed → open while another is already open, the previously-open panel(s)
 * are closed.
 */
export function useMutuallyExclusivePanels(
  diffOpen: boolean,
  codeViewerOpen: boolean,
  previewOpen: boolean,
  closeDiff: () => void,
  closeCodeViewer: () => void,
  closePreview: () => void,
  simulationOpen: boolean = false,
  closeSimulation?: () => void,
) {
  const prevDiffOpen = useRef(diffOpen);
  const prevCodeViewerOpen = useRef(codeViewerOpen);
  const prevPreviewOpen = useRef(previewOpen);
  const prevSimulationOpen = useRef(simulationOpen);

  useEffect(() => {
    const wasDiffOpen = prevDiffOpen.current;
    const wasCodeViewerOpen = prevCodeViewerOpen.current;
    const wasPreviewOpen = prevPreviewOpen.current;
    const wasSimulationOpen = prevSimulationOpen.current;
    prevDiffOpen.current = diffOpen;
    prevCodeViewerOpen.current = codeViewerOpen;
    prevPreviewOpen.current = previewOpen;
    prevSimulationOpen.current = simulationOpen;

    const actions = resolveExclusivePanelAction(
      wasDiffOpen,
      diffOpen,
      wasCodeViewerOpen,
      codeViewerOpen,
      wasPreviewOpen,
      previewOpen,
      wasSimulationOpen,
      simulationOpen,
    );
    for (const action of actions) {
      if (action === "close-code-viewer") {
        closeCodeViewer();
      } else if (action === "close-diff") {
        closeDiff();
      } else if (action === "close-preview") {
        closePreview();
      } else if (action === "close-simulation") {
        closeSimulation?.();
      }
    }
  }, [
    diffOpen,
    codeViewerOpen,
    previewOpen,
    simulationOpen,
    closeDiff,
    closeCodeViewer,
    closePreview,
    closeSimulation,
  ]);
}
