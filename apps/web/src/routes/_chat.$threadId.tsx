import { ThreadId } from "@okcode/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import {
  type CSSProperties,
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { RightPanelHeader } from "~/components/RightPanelHeader";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import { WorkspaceFileTree } from "~/components/WorkspaceFileTree";
import { useChatWidgetStore } from "../chatWidgetStore";
import { useCodeViewerStore } from "../codeViewerStore";
import ChatView from "../components/ChatView";
import { Sheet, SheetPopup } from "../components/ui/sheet";
import { useComposerDraftStore } from "../composerDraftStore";
import { useDiffViewerStore } from "../diffViewerStore";
import { isMobileShell } from "../env";
import { useClientMode } from "../hooks/useClientMode";
import { useTheme } from "../hooks/useTheme";
import { useRightPanelStore } from "../rightPanelStore";
import { useSimulationViewerStore } from "../simulationViewerStore";
import { useStore } from "../store";

const CodeViewerPanel = lazy(() => import("../components/CodeViewerPanel"));
const DiffPanel = lazy(() => import("../components/DiffPanel"));
const SimulationViewerLazy = lazy(() =>
  import("../components/simulation/SimulationViewer").then((m) => ({
    default: m.SimulationViewer,
  })),
);

const RIGHT_PANEL_SIDEBAR_WIDTH_STORAGE_KEY = "chat_right_panel_sidebar_width";
const RIGHT_PANEL_DEFAULT_WIDTH = "clamp(20rem,38vw,44rem)";
const RIGHT_PANEL_SIDEBAR_MIN_WIDTH = 18 * 16;
const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = 208;

const CodeViewerLoadingFallback = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-xs">Loading code viewer...</span>
      </div>
    </div>
  );
};

const LazyCodeViewerPanel = () => {
  return (
    <Suspense fallback={<CodeViewerLoadingFallback />}>
      <CodeViewerPanel />
    </Suspense>
  );
};

const DiffPanelLoadingFallback = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-xs">Loading diff viewer...</span>
      </div>
    </div>
  );
};

const LazyDiffPanel = ({ mode }: { mode: "sheet" | "sidebar" }) => {
  return (
    <Suspense fallback={<DiffPanelLoadingFallback />}>
      <DiffPanel mode={mode} />
    </Suspense>
  );
};

const SimulationLoadingFallback = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-xs">Loading simulation viewer...</span>
      </div>
    </div>
  );
};

const LazySimulationViewer = ({ onClose }: { onClose: () => void }) => {
  return (
    <Suspense fallback={<SimulationLoadingFallback />}>
      <SimulationViewerLazy onClose={onClose} />
    </Suspense>
  );
};

function useShouldAcceptInlineSidebarWidth() {
  return useCallback(({ nextWidth, wrapper }: { nextWidth: number; wrapper: HTMLElement }) => {
    const composerForm = document.querySelector<HTMLElement>("[data-chat-composer-form='true']");
    if (!composerForm) return true;
    const composerViewport = composerForm.parentElement;
    if (!composerViewport) return true;
    const previousSidebarWidth = wrapper.style.getPropertyValue("--sidebar-width");
    wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`);

    const viewportStyle = window.getComputedStyle(composerViewport);
    const viewportPaddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
    const viewportPaddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;
    const viewportContentWidth = Math.max(
      0,
      composerViewport.clientWidth - viewportPaddingLeft - viewportPaddingRight,
    );
    const formRect = composerForm.getBoundingClientRect();
    const composerFooter = composerForm.querySelector<HTMLElement>(
      "[data-chat-composer-footer='true']",
    );
    const composerRightActions = composerForm.querySelector<HTMLElement>(
      "[data-chat-composer-actions='right']",
    );
    const composerRightActionsWidth = composerRightActions?.getBoundingClientRect().width ?? 0;
    const composerFooterGap = composerFooter
      ? Number.parseFloat(window.getComputedStyle(composerFooter).columnGap) ||
        Number.parseFloat(window.getComputedStyle(composerFooter).gap) ||
        0
      : 0;
    const minimumComposerWidth =
      COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX + composerRightActionsWidth + composerFooterGap;
    const hasComposerOverflow = composerForm.scrollWidth > composerForm.clientWidth + 0.5;
    const overflowsViewport = formRect.width > viewportContentWidth + 0.5;
    const violatesMinimumComposerWidth = composerForm.clientWidth + 0.5 < minimumComposerWidth;

    if (previousSidebarWidth.length > 0) {
      wrapper.style.setProperty("--sidebar-width", previousSidebarWidth);
    } else {
      wrapper.style.removeProperty("--sidebar-width");
    }

    return !hasComposerOverflow && !overflowsViewport && !violatesMinimumComposerWidth;
  }, []);
}

/** Mobile sheet wrapper for the unified right panel. */
const RightPanelSheet = (props: { open: boolean; onClose: () => void; children: ReactNode }) => {
  return (
    <Sheet
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-full max-w-full p-0 sm:w-[min(92vw,860px)] sm:max-w-[860px]"
      >
        {props.children}
      </SheetPopup>
    </Sheet>
  );
};

function ChatThreadRouteView() {
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const navigate = useNavigate();
  const threadId = Route.useParams({
    select: (params) => ThreadId.makeUnsafe(params.threadId),
  });
  const threadExists = useStore((store) => store.threads.some((thread) => thread.id === threadId));
  const draftThreadExists = useComposerDraftStore((store) =>
    Object.hasOwn(store.draftThreadsByThreadId, threadId),
  );
  const routeThreadExists = threadExists || draftThreadExists;
  const clientMode = useClientMode();
  const shouldUseSheet = clientMode === "mobile";
  const { resolvedTheme } = useTheme();
  const widgetMinimize = useChatWidgetStore((s) => s.minimize);
  const onMinimize = isMobileShell ? widgetMinimize : undefined;

  // ── Right panel store ─────────────────────────────────────────────
  const rightPanelOpen = useRightPanelStore((s) => s.isOpen);
  const rightPanelTab = useRightPanelStore((s) => s.activeTab);
  const openRightPanel = useRightPanelStore((s) => s.open);
  const closeRightPanel = useRightPanelStore((s) => s.close);

  // ── Code viewer state ─────────────────────────────────────────────
  const codeViewerOpen = useCodeViewerStore((state) => state.isOpen);
  const codeViewerActiveTabId = useCodeViewerStore((state) => state.activeTabId);
  const closeCodeViewerStore = useCodeViewerStore((state) => state.close);

  // ── Diff viewer state ─────────────────────────────────────────────
  const diffViewerOpen = useDiffViewerStore((state) => state.isOpen && state.threadId === threadId);
  const closeDiffViewerStore = useDiffViewerStore((state) => state.close);

  // ── Simulation viewer state ───────────────────────────────────────
  const simulationOpen = useSimulationViewerStore((state) => state.isOpen);
  const closeSimulationStore = useSimulationViewerStore((state) => state.close);

  // ── Active workspace CWD for file tree ────────────────────────────
  const activeWorkspaceCwd = useStore((store) => {
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) return null;
    const project = store.projects.find((p) => p.id === thread.projectId);
    if (!project) return null;
    return thread.worktreePath ?? project.cwd;
  });

  // ── Keep-alive flags so lazy content doesn't unmount on tab switch ─
  const [hasOpenedCodeViewer, setHasOpenedCodeViewer] = useState(codeViewerOpen);
  const [hasOpenedSimulation, setHasOpenedSimulation] = useState(simulationOpen);

  const closeCodeViewer = useCallback(() => {
    closeCodeViewerStore();
  }, [closeCodeViewerStore]);
  const closeDiffViewer = useCallback(() => {
    closeDiffViewerStore();
  }, [closeDiffViewerStore]);
  const closeSimulation = useCallback(() => {
    closeSimulationStore();
  }, [closeSimulationStore]);

  // ── Sync sub-panel opens → right panel tab ────────────────────────
  // When code viewer opens (or a new file is activated), switch to editor tab.
  useEffect(() => {
    if (codeViewerOpen) {
      openRightPanel("editor");
    }
  }, [codeViewerOpen, codeViewerActiveTabId, openRightPanel]);

  // When diff viewer opens, switch to diffs tab.
  useEffect(() => {
    if (diffViewerOpen) {
      openRightPanel("diffs");
    }
  }, [diffViewerOpen, openRightPanel]);

  // ── Sync right panel close → close sub-panels ─────────────────────
  const prevRightPanelOpenRef = useRef(rightPanelOpen);
  useEffect(() => {
    const wasOpen = prevRightPanelOpenRef.current;
    prevRightPanelOpenRef.current = rightPanelOpen;
    if (wasOpen && !rightPanelOpen) {
      closeCodeViewer();
      closeDiffViewer();
    }
  }, [rightPanelOpen, closeCodeViewer, closeDiffViewer]);

  useEffect(() => {
    if (codeViewerOpen) {
      setHasOpenedCodeViewer(true);
    }
  }, [codeViewerOpen]);

  useEffect(() => {
    if (simulationOpen) {
      setHasOpenedSimulation(true);
    }
  }, [simulationOpen]);

  const shouldAcceptInlineSidebarWidth = useShouldAcceptInlineSidebarWidth();

  useEffect(() => {
    if (!threadsHydrated) {
      return;
    }

    if (!routeThreadExists) {
      void navigate({ to: "/", replace: true });
      return;
    }
  }, [navigate, routeThreadExists, threadsHydrated, threadId]);

  if (!threadsHydrated || !routeThreadExists) {
    return null;
  }

  const shouldRenderCodeViewerContent = codeViewerOpen || hasOpenedCodeViewer;
  const shouldRenderDiffViewerContent = diffViewerOpen;
  const shouldRenderSimulation = simulationOpen || hasOpenedSimulation;

  // ── Right panel content (shared between desktop sidebar & mobile sheet) ──
  const rightPanelContent = (
    <div className="flex h-full flex-col bg-background">
      <RightPanelHeader />
      <div className="relative flex-1 overflow-hidden">
        {rightPanelTab === "files" && activeWorkspaceCwd ? (
          <div className="h-full overflow-y-auto pt-2">
            <WorkspaceFileTree cwd={activeWorkspaceCwd} resolvedTheme={resolvedTheme} />
          </div>
        ) : null}
        {rightPanelTab === "editor" ? (
          <div className="h-full">
            {shouldRenderCodeViewerContent ? <LazyCodeViewerPanel /> : null}
          </div>
        ) : null}
        {rightPanelTab === "diffs" ? (
          <div className="h-full">
            {shouldRenderDiffViewerContent ? (
              <LazyDiffPanel mode={shouldUseSheet ? "sheet" : "sidebar"} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  // Simulation viewer: on mobile, use a sheet; otherwise render as an
  // inline sidebar-like panel that fills the right portion of the screen.
  const simulationNode = shouldRenderSimulation ? (
    clientMode === "mobile" ? (
      <Sheet
        open={simulationOpen}
        onOpenChange={(open) => {
          if (!open) closeSimulation();
        }}
      >
        <SheetPopup
          side="right"
          showCloseButton={false}
          keepMounted
          className="w-full max-w-full p-0 sm:w-[min(92vw,860px)] sm:max-w-[860px]"
        >
          <LazySimulationViewer onClose={closeSimulation} />
        </SheetPopup>
      </Sheet>
    ) : (
      <SidebarProvider
        defaultOpen={false}
        open={simulationOpen}
        onOpenChange={(open) => {
          if (!open) closeSimulation();
        }}
        className="w-auto min-h-0 flex-none bg-transparent"
        style={{ "--sidebar-width": "clamp(32rem,55vw,52rem)" } as CSSProperties}
      >
        <Sidebar
          side="right"
          collapsible="offcanvas"
          className="border-l border-border bg-card text-foreground"
          resizable={{
            minWidth: 28 * 16,
            storageKey: "chat_simulation_sidebar_width",
          }}
        >
          <LazySimulationViewer onClose={closeSimulation} />
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>
    )
  ) : null;

  if (shouldUseSheet) {
    return (
      <>
        <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView key={threadId} threadId={threadId} onMinimize={onMinimize} />
        </SidebarInset>
        <RightPanelSheet open={rightPanelOpen} onClose={closeRightPanel}>
          {rightPanelContent}
        </RightPanelSheet>
        {simulationNode}
      </>
    );
  }

  return (
    <>
      <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView key={threadId} threadId={threadId} onMinimize={onMinimize} />
      </SidebarInset>
      <SidebarProvider
        defaultOpen={false}
        open={rightPanelOpen}
        onOpenChange={(open) => {
          if (!open) closeRightPanel();
        }}
        className="w-auto min-h-0 flex-none bg-transparent"
        style={{ "--sidebar-width": RIGHT_PANEL_DEFAULT_WIDTH } as CSSProperties}
      >
        <Sidebar
          side="right"
          collapsible="offcanvas"
          className="border-l border-border/60 bg-card text-foreground"
          resizable={{
            minWidth: RIGHT_PANEL_SIDEBAR_MIN_WIDTH,
            shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
            storageKey: RIGHT_PANEL_SIDEBAR_WIDTH_STORAGE_KEY,
          }}
        >
          {rightPanelContent}
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>
      {simulationNode}
    </>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  component: ChatThreadRouteView,
});
