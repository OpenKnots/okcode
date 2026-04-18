export type CountedDesktopShell = "sidebar" | "preview" | "right-panel" | "plan-sidebar";

interface DesktopShellState {
  sidebarOpen: boolean;
  previewOpen: boolean;
  rightPanelOpen: boolean;
  planSidebarOpen: boolean;
  terminalOpen: boolean;
}

interface TerminalDockPlacementInput {
  clientMode: "desktop" | "mobile";
  rightPanelOpen: boolean;
  hasRightPanelTerminalDock: boolean;
}

export type TerminalDockPlacement = "inline" | "right-panel";

export function getCountedDesktopShells(input: DesktopShellState): CountedDesktopShell[] {
  const shells: CountedDesktopShell[] = [];
  if (input.sidebarOpen) shells.push("sidebar");
  if (input.previewOpen) shells.push("preview");
  if (input.rightPanelOpen) shells.push("right-panel");
  if (input.planSidebarOpen) shells.push("plan-sidebar");
  return shells;
}

export function countCountedDesktopShells(input: DesktopShellState): number {
  return getCountedDesktopShells(input).length;
}

export function resolveTerminalDockPlacement(
  input: TerminalDockPlacementInput,
): TerminalDockPlacement {
  return input.clientMode === "desktop" && input.rightPanelOpen && input.hasRightPanelTerminalDock
    ? "right-panel"
    : "inline";
}
