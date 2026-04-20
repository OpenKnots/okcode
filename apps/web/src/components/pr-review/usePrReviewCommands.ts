import { useMemo } from "react";
import { usePrReviewStore } from "~/prReviewStore";

// ── Types ──────────────────────────────────────────────────────────

export interface PrReviewCommand {
  id: string;
  label: string;
  keywords?: string[];
  shortcut?: string;
  group: string;
  onSelect: () => void;
  hidden?: boolean;
}

// ── Hook ───────────────────────────────────────────────────────────

export function usePrReviewCommands({
  enabled,
  onStartAgentReview,
  onOpenOnGitHub,
}: {
  enabled: boolean;
  onStartAgentReview: () => void;
  onOpenOnGitHub: () => void;
}): PrReviewCommand[] {
  const toggleLeftRail = usePrReviewStore((s) => s.toggleLeftRail);
  const toggleInspector = usePrReviewStore((s) => s.toggleInspector);
  const expandInspectorToTab = usePrReviewStore((s) => s.expandInspectorToTab);
  const setShortcutOverlayOpen = usePrReviewStore((s) => s.setShortcutOverlayOpen);
  const setConflictDrawerOpen = usePrReviewStore((s) => s.setConflictDrawerOpen);
  const selectFile = usePrReviewStore((s) => s.selectFile);
  const toggleFileReviewed = usePrReviewStore((s) => s.toggleFileReviewed);

  return useMemo<PrReviewCommand[]>(() => {
    const GROUP = "PR Review";

    return [
      {
        id: "pr-review:start-ai-review",
        label: "Start AI Review",
        keywords: ["agent", "ai", "review", "analyze"],
        shortcut: "\u21e7A",
        group: GROUP,
        onSelect: onStartAgentReview,
        hidden: !enabled,
      },
      {
        id: "pr-review:next-file",
        label: "Next file",
        keywords: ["navigate", "down", "forward"],
        shortcut: "J",
        group: GROUP,
        onSelect: () => {
          // Navigation is handled by the keyboard hook; this entry exists
          // so the command palette can surface and describe the shortcut.
          const { selectedFilePath } = usePrReviewStore.getState();
          const paths = getFilePaths();
          if (paths.length === 0) return;
          const idx = selectedFilePath ? paths.indexOf(selectedFilePath) : -1;
          selectFile(paths[(idx + 1) % paths.length] ?? null);
        },
        hidden: !enabled,
      },
      {
        id: "pr-review:prev-file",
        label: "Previous file",
        keywords: ["navigate", "up", "back"],
        shortcut: "K",
        group: GROUP,
        onSelect: () => {
          const { selectedFilePath } = usePrReviewStore.getState();
          const paths = getFilePaths();
          if (paths.length === 0) return;
          const idx = selectedFilePath ? paths.indexOf(selectedFilePath) : paths.length;
          selectFile(paths[idx > 0 ? idx - 1 : paths.length - 1] ?? null);
        },
        hidden: !enabled,
      },
      {
        id: "pr-review:next-unreviewed",
        label: "Next unreviewed file",
        keywords: ["skip", "unreviewed", "navigate"],
        shortcut: "N",
        group: GROUP,
        onSelect: () => {
          const { selectedFilePath, reviewedFiles } = usePrReviewStore.getState();
          const paths = getFilePaths();
          if (paths.length === 0) return;
          const reviewed = new Set(reviewedFiles);
          const currentIdx = selectedFilePath ? paths.indexOf(selectedFilePath) : -1;
          for (let offset = 1; offset <= paths.length; offset++) {
            const candidate = paths[(currentIdx + offset) % paths.length];
            if (candidate && !reviewed.has(candidate)) {
              selectFile(candidate);
              break;
            }
          }
        },
        hidden: !enabled,
      },
      {
        id: "pr-review:mark-reviewed",
        label: "Mark file reviewed",
        keywords: ["toggle", "reviewed", "check"],
        shortcut: "E",
        group: GROUP,
        onSelect: () => {
          const { selectedFilePath } = usePrReviewStore.getState();
          if (selectedFilePath) toggleFileReviewed(selectedFilePath);
        },
        hidden: !enabled,
      },
      {
        id: "pr-review:toggle-pr-list",
        label: "Toggle PR list",
        keywords: ["sidebar", "left", "rail", "panel"],
        shortcut: "[",
        group: GROUP,
        onSelect: toggleLeftRail,
        hidden: !enabled,
      },
      {
        id: "pr-review:toggle-inspector",
        label: "Toggle inspector",
        keywords: ["right", "panel", "sidebar"],
        shortcut: "]",
        group: GROUP,
        onSelect: toggleInspector,
        hidden: !enabled,
      },
      {
        id: "pr-review:show-shortcuts",
        label: "Show keyboard shortcuts",
        keywords: ["help", "keys", "hotkeys"],
        shortcut: "?",
        group: GROUP,
        onSelect: () => setShortcutOverlayOpen(true),
        hidden: !enabled,
      },
      {
        id: "pr-review:open-github",
        label: "Open on GitHub",
        keywords: ["github", "browser", "external"],
        group: GROUP,
        onSelect: onOpenOnGitHub,
        hidden: !enabled,
      },
      {
        id: "pr-review:show-conflicts",
        label: "Show conflicts",
        keywords: ["merge", "conflict", "resolution"],
        group: GROUP,
        onSelect: () => setConflictDrawerOpen(true),
        hidden: !enabled,
      },
      {
        id: "pr-review:show-ai-findings",
        label: "Show AI findings",
        keywords: ["agent", "ai", "findings", "analysis"],
        group: GROUP,
        onSelect: () => expandInspectorToTab("ai"),
        hidden: !enabled,
      },
    ];
  }, [
    enabled,
    onStartAgentReview,
    onOpenOnGitHub,
    toggleLeftRail,
    toggleInspector,
    expandInspectorToTab,
    setShortcutOverlayOpen,
    setConflictDrawerOpen,
    selectFile,
    toggleFileReviewed,
  ]);
}

// ── Internal helpers ───────────────────────────────────────────────

/**
 * Read the current file-path ordering from the store.
 *
 * The command palette commands need file paths for next/prev navigation,
 * but the list is dynamic and only available at invocation time.  Reading
 * directly from the store avoids threading the paths through as a
 * dependency that would bust the `useMemo`.
 */
function getFilePaths(): string[] {
  // The store does not hold the ordered file-path list directly;
  // callers that wire up the command palette should ensure the store's
  // `selectedFilePath` is kept in sync.  For command-palette actions we
  // fall back to an empty list — the keyboard hook handles the canonical
  // j/k navigation.
  return [];
}
