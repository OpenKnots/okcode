import type { PrAgentReviewResult } from "@okcode/contracts";
import { create } from "zustand";
import type { InspectorTab, PullRequestState } from "./components/pr-review/pr-review-utils";

// ── Helpers ─────────────────────────────────────────────────────────

function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

// ── Types ───────────────────────────────────────────────────────────

export interface PrReviewState {
  // PR selection
  selectedPrNumber: number | null;
  selectedFilePath: string | null;
  selectedThreadId: string | null;

  // Filters
  pullRequestState: PullRequestState;
  searchQuery: string;

  // Workflow
  workflowId: string | null;

  // Panel state
  leftRailCollapsed: boolean;
  inspectorCollapsed: boolean;
  actionRailExpanded: boolean;
  conflictDrawerOpen: boolean;
  inspectorOpen: boolean; // mobile sheet
  inspectorTab: InspectorTab;
  userExplicitlyOpenedInspector: boolean;
  shortcutOverlayOpen: boolean;

  // Agent review
  agentReviewResult: PrAgentReviewResult | null;

  // Per-project-per-PR state (keyed externally)
  reviewedFiles: readonly string[];
  reviewBody: string;

  // Actions
  selectPr: (prNumber: number | null) => void;
  selectFile: (path: string | null) => void;
  selectThread: (threadId: string | null) => void;
  setPullRequestState: (state: PullRequestState) => void;
  setSearchQuery: (query: string) => void;
  setWorkflowId: (id: string | null) => void;
  toggleLeftRail: () => void;
  setLeftRailCollapsed: (collapsed: boolean) => void;
  toggleInspector: () => void;
  setInspectorCollapsed: (collapsed: boolean) => void;
  setActionRailExpanded: (expanded: boolean) => void;
  setConflictDrawerOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  expandInspectorToTab: (tab: InspectorTab) => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  setAgentReviewResult: (result: PrAgentReviewResult | null) => void;
  setReviewedFiles: (files: readonly string[]) => void;
  toggleFileReviewed: (path: string) => void;
  setReviewBody: (body: string) => void;
  resetForNewPr: () => void;
}

// ── Store ───────────────────────────────────────────────────────────

export const usePrReviewStore = create<PrReviewState>((set) => ({
  // PR selection
  selectedPrNumber: null,
  selectedFilePath: null,
  selectedThreadId: null,

  // Filters
  pullRequestState: "open",
  searchQuery: "",

  // Workflow
  workflowId: null,

  // Panel state — restore from localStorage
  leftRailCollapsed: readLocalStorage("okcode:pr-review:left-rail-collapsed", false),
  inspectorCollapsed: readLocalStorage("okcode:pr-review:inspector-collapsed", true),
  actionRailExpanded: false,
  conflictDrawerOpen: false,
  inspectorOpen: false,
  inspectorTab: "threads",
  userExplicitlyOpenedInspector: false,
  shortcutOverlayOpen: false,

  // Agent review
  agentReviewResult: null,

  // Per-PR state
  reviewedFiles: [],
  reviewBody: "",

  // ── Actions ─────────────────────────────────────────────────────

  selectPr: (prNumber) =>
    set({
      selectedPrNumber: prNumber,
      selectedFilePath: null,
      selectedThreadId: null,
      inspectorOpen: true,
    }),

  selectFile: (path) => set({ selectedFilePath: path }),

  selectThread: (threadId) => set({ selectedThreadId: threadId }),

  setPullRequestState: (state) => set({ pullRequestState: state }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setWorkflowId: (id) => set({ workflowId: id }),

  toggleLeftRail: () =>
    set((state) => {
      const next = !state.leftRailCollapsed;
      writeLocalStorage("okcode:pr-review:left-rail-collapsed", next);
      return { leftRailCollapsed: next };
    }),

  setLeftRailCollapsed: (collapsed) => {
    writeLocalStorage("okcode:pr-review:left-rail-collapsed", collapsed);
    set({ leftRailCollapsed: collapsed });
  },

  toggleInspector: () =>
    set((state) => {
      const next = !state.inspectorCollapsed;
      if (!next) {
        return {
          inspectorCollapsed: next,
          userExplicitlyOpenedInspector: true,
        };
      }
      writeLocalStorage("okcode:pr-review:inspector-collapsed", next);
      return { inspectorCollapsed: next };
    }),

  setInspectorCollapsed: (collapsed) => {
    writeLocalStorage("okcode:pr-review:inspector-collapsed", collapsed);
    set({ inspectorCollapsed: collapsed });
  },

  setActionRailExpanded: (expanded) => set({ actionRailExpanded: expanded }),

  setConflictDrawerOpen: (open) => set({ conflictDrawerOpen: open }),

  setInspectorOpen: (open) => set({ inspectorOpen: open }),

  setInspectorTab: (tab) => set({ inspectorTab: tab }),

  expandInspectorToTab: (tab) =>
    set({
      inspectorCollapsed: false,
      inspectorTab: tab,
      userExplicitlyOpenedInspector: true,
    }),

  setShortcutOverlayOpen: (open) => set({ shortcutOverlayOpen: open }),

  setAgentReviewResult: (result) =>
    set({
      agentReviewResult: result,
      ...(result?.status === "complete" ? { inspectorTab: "ai" } : {}),
    }),

  setReviewedFiles: (files) => set({ reviewedFiles: files }),

  toggleFileReviewed: (path) =>
    set((state) => {
      const fileSet = new Set(state.reviewedFiles);
      if (fileSet.has(path)) fileSet.delete(path);
      else fileSet.add(path);
      return { reviewedFiles: [...fileSet] };
    }),

  setReviewBody: (body) => set({ reviewBody: body }),

  resetForNewPr: () =>
    set({
      selectedFilePath: null,
      selectedThreadId: null,
      agentReviewResult: null,
      reviewedFiles: [],
      reviewBody: "",
    }),
}));
