/**
 * Hook that coordinates across all panel/terminal stores to capture
 * the current layout state and apply a saved layout.
 *
 * Sidebar widths are read/written via the same localStorage keys the
 * `<SidebarRail>` component uses, so persisted widths survive page
 * reloads. Panel open/close states apply immediately via Zustand;
 * sidebar widths take effect on next panel toggle or page load (the
 * SidebarRail reads them from localStorage on mount).
 */

import { useCallback } from "react";
import { Schema } from "effect";
import type { ProjectId, ThreadId } from "@okcode/contracts";
import { getLocalStorageItem, setLocalStorageItem } from "./useLocalStorage";
import { useCodeViewerStore } from "../codeViewerStore";
import { useDiffViewerStore } from "../diffViewerStore";
import { useSimulationViewerStore } from "../simulationViewerStore";
import { usePreviewStateStore } from "../previewStateStore";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import {
  useLayoutStore,
  type LayoutPanel,
  type LayoutSidebarWidths,
  type SavedLayout,
} from "../layoutStore";

// ─── Sidebar width localStorage keys ───────────────────────────────
// These must match the storageKey values used by the <Sidebar> components
// in _chat.tsx and _chat.$threadId.tsx.
const SIDEBAR_WIDTH_KEYS = {
  threadSidebar: "chat_thread_sidebar_width",
  codeViewer: "chat_code_viewer_sidebar_width",
  diffViewer: "chat_diff_viewer_sidebar_width",
  simulation: "chat_simulation_sidebar_width",
} as const satisfies Record<keyof LayoutSidebarWidths, string>;

// ─── Helpers ────────────────────────────────────────────────────────

function generateLayoutId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments.
  return `layout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readSidebarWidths(): LayoutSidebarWidths {
  return {
    threadSidebar: getLocalStorageItem(SIDEBAR_WIDTH_KEYS.threadSidebar, Schema.Finite),
    codeViewer: getLocalStorageItem(SIDEBAR_WIDTH_KEYS.codeViewer, Schema.Finite),
    diffViewer: getLocalStorageItem(SIDEBAR_WIDTH_KEYS.diffViewer, Schema.Finite),
    simulation: getLocalStorageItem(SIDEBAR_WIDTH_KEYS.simulation, Schema.Finite),
  };
}

function writeSidebarWidths(widths: LayoutSidebarWidths): void {
  for (const [field, storageKey] of Object.entries(SIDEBAR_WIDTH_KEYS) as Array<
    [keyof LayoutSidebarWidths, string]
  >) {
    const value = widths[field];
    if (value !== null) {
      setLocalStorageItem(storageKey, value, Schema.Finite);
    }
  }
}

/**
 * Determine which panel is currently active based on all panel store states.
 */
function resolveActivePanel(
  codeViewerOpen: boolean,
  diffViewerOpen: boolean,
  previewOpen: boolean,
  simulationOpen: boolean,
): LayoutPanel {
  if (codeViewerOpen) return "code-viewer";
  if (diffViewerOpen) return "diff-viewer";
  if (previewOpen) return "preview";
  if (simulationOpen) return "simulation";
  return "none";
}

// ─── Hook ───────────────────────────────────────────────────────────

export interface UseLayoutActionsResult {
  /**
   * Snapshot the current panel arrangement into a `SavedLayout` object.
   * Does not persist it — call `saveCurrentAsLayout` for that.
   */
  captureCurrentLayout: (
    name: string,
    threadId: ThreadId | null,
    projectId: ProjectId | null,
  ) => SavedLayout;

  /**
   * Apply a saved layout by setting all panel stores to the saved state.
   * Sidebar widths are written to localStorage and will take effect on
   * next panel toggle or page load.
   */
  applyLayout: (
    layout: SavedLayout,
    threadId: ThreadId | null,
    projectId: ProjectId | null,
  ) => void;

  /**
   * Capture the current layout and save it to the layout store in one step.
   * Returns the ID of the newly saved layout.
   */
  saveCurrentAsLayout: (
    name: string,
    threadId: ThreadId | null,
    projectId: ProjectId | null,
  ) => string;

  /**
   * Overwrite a saved layout with the current panel arrangement,
   * preserving its name and ID.
   */
  updateLayoutFromCurrent: (
    layoutId: string,
    threadId: ThreadId | null,
    projectId: ProjectId | null,
  ) => void;
}

export function useLayoutActions(): UseLayoutActionsResult {
  const saveLayoutToStore = useLayoutStore((s) => s.saveLayout);
  const updateLayoutInStore = useLayoutStore((s) => s.updateLayout);

  const captureCurrentLayout = useCallback(
    (name: string, threadId: ThreadId | null, projectId: ProjectId | null): SavedLayout => {
      const codeViewerOpen = useCodeViewerStore.getState().isOpen;
      const diffState = useDiffViewerStore.getState();
      const diffViewerOpen = diffState.isOpen;
      const simulationOpen = useSimulationViewerStore.getState().isOpen;
      const previewState = usePreviewStateStore.getState();
      const previewOpen = projectId
        ? (previewState.openByProjectId[projectId] ?? false)
        : false;

      const terminalStoreState = useTerminalStateStore.getState();
      const threadTerminal = threadId
        ? selectThreadTerminalState(terminalStoreState.terminalStateByThreadId, threadId)
        : null;

      const previewDock = projectId
        ? (previewState.dockByProjectId[projectId] ?? null)
        : null;
      const previewSize = projectId
        ? (previewState.sizeByProjectId[projectId] ?? null)
        : null;

      const now = Date.now();
      return {
        id: generateLayoutId(),
        name: name.trim().slice(0, 128) || "Untitled Layout",
        createdAt: now,
        updatedAt: now,
        activePanel: resolveActivePanel(codeViewerOpen, diffViewerOpen, previewOpen, simulationOpen),
        terminalOpen: threadTerminal?.terminalOpen ?? false,
        terminalHeight: threadTerminal?.terminalHeight ?? null,
        sidebarWidths: readSidebarWidths(),
        previewDock,
        previewSize,
      };
    },
    [],
  );

  const applyLayout = useCallback(
    (layout: SavedLayout, threadId: ThreadId | null, projectId: ProjectId | null) => {
      // ── 1. Close all right-side panels first ────────────────────
      const codeViewerStore = useCodeViewerStore.getState();
      const diffViewerStore = useDiffViewerStore.getState();
      const simulationStore = useSimulationViewerStore.getState();
      const previewStore = usePreviewStateStore.getState();

      if (codeViewerStore.isOpen) codeViewerStore.close();
      if (diffViewerStore.isOpen) diffViewerStore.close();
      if (simulationStore.isOpen) simulationStore.close();
      if (projectId && previewStore.openByProjectId[projectId]) {
        previewStore.setProjectOpen(projectId, false);
      }

      // ── 2. Open the target panel ───────────────────────────────
      switch (layout.activePanel) {
        case "code-viewer":
          useCodeViewerStore.getState().open();
          break;
        case "diff-viewer":
          if (threadId) {
            useDiffViewerStore.getState().openConversation(threadId);
          }
          break;
        case "preview":
          if (projectId) {
            usePreviewStateStore.getState().setProjectOpen(projectId, true);
          }
          break;
        case "simulation":
          useSimulationViewerStore.getState().open();
          break;
        case "none":
        default:
          break;
      }

      // ── 3. Apply preview dock & size ───────────────────────────
      if (projectId) {
        if (layout.previewDock !== null) {
          usePreviewStateStore.getState().setProjectDock(projectId, layout.previewDock);
        }
        if (layout.previewSize !== null) {
          usePreviewStateStore.getState().setProjectSize(projectId, layout.previewSize);
        }
      }

      // ── 4. Apply terminal state ────────────────────────────────
      if (threadId) {
        const terminalStore = useTerminalStateStore.getState();
        terminalStore.setTerminalOpen(threadId, layout.terminalOpen);
        if (layout.terminalHeight !== null) {
          terminalStore.setTerminalHeight(threadId, layout.terminalHeight);
        }
      }

      // ── 5. Apply sidebar widths to localStorage ────────────────
      writeSidebarWidths(layout.sidebarWidths);

      // ── 6. Mark this layout as active ──────────────────────────
      useLayoutStore.getState().setActiveLayoutId(layout.id);
    },
    [],
  );

  const saveCurrentAsLayout = useCallback(
    (name: string, threadId: ThreadId | null, projectId: ProjectId | null): string => {
      const layout = captureCurrentLayout(name, threadId, projectId);
      saveLayoutToStore(layout);
      return layout.id;
    },
    [captureCurrentLayout, saveLayoutToStore],
  );

  const updateLayoutFromCurrent = useCallback(
    (layoutId: string, threadId: ThreadId | null, projectId: ProjectId | null) => {
      const layouts = useLayoutStore.getState().savedLayouts;
      const existing = layouts.find((l) => l.id === layoutId);
      if (!existing) return;

      const snapshot = captureCurrentLayout(existing.name, threadId, projectId);
      updateLayoutInStore(layoutId, {
        activePanel: snapshot.activePanel,
        terminalOpen: snapshot.terminalOpen,
        terminalHeight: snapshot.terminalHeight,
        sidebarWidths: snapshot.sidebarWidths,
        previewDock: snapshot.previewDock,
        previewSize: snapshot.previewSize,
      });
    },
    [captureCurrentLayout, updateLayoutInStore],
  );

  return {
    captureCurrentLayout,
    applyLayout,
    saveCurrentAsLayout,
    updateLayoutFromCurrent,
  };
}
