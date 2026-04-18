import { describe, expect, it } from "vitest";

import {
  countCountedDesktopShells,
  getCountedDesktopShells,
  resolveTerminalDockPlacement,
} from "./desktopShellLayout";

describe("desktopShellLayout", () => {
  it("counts only the approved desktop shells and excludes terminal", () => {
    expect(
      getCountedDesktopShells({
        sidebarOpen: true,
        previewOpen: true,
        rightPanelOpen: true,
        planSidebarOpen: true,
        terminalOpen: true,
      }),
    ).toEqual(["sidebar", "preview", "right-panel", "plan-sidebar"]);

    expect(
      countCountedDesktopShells({
        sidebarOpen: true,
        previewOpen: true,
        rightPanelOpen: true,
        planSidebarOpen: true,
        terminalOpen: true,
      }),
    ).toBe(4);
  });

  it("returns zero when none of the counted desktop shells are open", () => {
    expect(
      countCountedDesktopShells({
        sidebarOpen: false,
        previewOpen: false,
        rightPanelOpen: false,
        planSidebarOpen: false,
        terminalOpen: true,
      }),
    ).toBe(0);
  });

  it("docks the terminal under the right panel only when the desktop dock host exists", () => {
    expect(
      resolveTerminalDockPlacement({
        clientMode: "desktop",
        rightPanelOpen: true,
        hasRightPanelTerminalDock: true,
      }),
    ).toBe("right-panel");
  });

  it("keeps the terminal inline when the right panel is closed", () => {
    expect(
      resolveTerminalDockPlacement({
        clientMode: "desktop",
        rightPanelOpen: false,
        hasRightPanelTerminalDock: true,
      }),
    ).toBe("inline");
  });

  it("keeps the terminal inline for mobile even if a dock host exists", () => {
    expect(
      resolveTerminalDockPlacement({
        clientMode: "mobile",
        rightPanelOpen: true,
        hasRightPanelTerminalDock: true,
      }),
    ).toBe("inline");
  });
});
