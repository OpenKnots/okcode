import { ThreadId } from "@okcode/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Suspense,
  lazy,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import ChatView from "../components/ChatView";
import { useComposerDraftStore } from "../composerDraftStore";
import { useCodeViewerStore } from "../codeViewerStore";
import { usePreviewStateStore } from "../previewStateStore";
import { useSimulationViewerStore } from "../simulationViewerStore";
import { useMutuallyExclusivePanels } from "../mutuallyExclusivePanels";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useClientMode } from "../hooks/useClientMode";
import { useStore } from "../store";
import { Sheet, SheetPopup } from "../components/ui/sheet";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import { Loader2Icon } from "lucide-react";

const CodeViewerPanel = lazy(() => import("../components/CodeViewerPanel"));
const SimulationViewerLazy = lazy(() =>
  import("../components/simulation/SimulationViewer").then((m) => ({
    default: m.SimulationViewer,
  })),
);

const CODE_VIEWER_SIDEBAR_WIDTH_STORAGE_KEY = "chat_code_viewer_sidebar_width";
const CODE_VIEWER_DEFAULT_WIDTH = "clamp(28rem,48vw,44rem)";
const CODE_VIEWER_SIDEBAR_MIN_WIDTH = 26 * 16;
const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = 208;

const CodeViewerSheet = (props: {
  children: ReactNode;
  codeViewerOpen: boolean;
  onCloseCodeViewer: () => void;
}) => {
  return (
    <Sheet
      open={props.codeViewerOpen}
      onOpenChange={(open) => {
        if (!open) {
          props.onCloseCodeViewer();
        }
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-[min(92vw,860px)] max-w-[860px] p-0"
      >
        {props.children}
      </SheetPopup>
    </Sheet>
  );
};

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

/** Right-side sidebar panel for the code viewer — sits alongside the chat area. */
const CodeViewerInlineSidebar = (props: {
  codeViewerOpen: boolean;
  onCloseCodeViewer: () => void;
  renderContent: boolean;
}) => {
  const { codeViewerOpen, onCloseCodeViewer, renderContent } = props;
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onCloseCodeViewer();
      }
    },
    [onCloseCodeViewer],
  );
  const shouldAcceptInlineSidebarWidth = useShouldAcceptInlineSidebarWidth();

  return (
    <SidebarProvider
      defaultOpen={false}
      open={codeViewerOpen}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": CODE_VIEWER_DEFAULT_WIDTH } as CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border/60 bg-card text-foreground"
        resizable={{
          minWidth: CODE_VIEWER_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
          storageKey: CODE_VIEWER_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        {renderContent ? <LazyCodeViewerPanel /> : null}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
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
  const shouldUseCodeViewerSheet = clientMode === "mobile";

  // Code viewer state from Zustand store
  const codeViewerOpen = useCodeViewerStore((state) => state.isOpen);
  const closeCodeViewerStore = useCodeViewerStore((state) => state.close);

  // Preview state from Zustand store (project-scoped)
  const activeProjectId = useStore((store) => {
    const thread = store.threads.find((t) => t.id === threadId);
    return thread?.projectId ?? null;
  });
  const previewOpen = usePreviewStateStore((state) =>
    activeProjectId ? (state.openByProjectId[activeProjectId] ?? false) : false,
  );
  const setPreviewOpen = usePreviewStateStore((state) => state.setProjectOpen);

  // Simulation viewer state from Zustand store
  const simulationOpen = useSimulationViewerStore((state) => state.isOpen);
  const closeSimulationStore = useSimulationViewerStore((state) => state.close);

  // TanStack Router keeps active route components mounted across param-only navigations
  // unless remountDeps are configured, so this stays warm across thread switches.
  const [hasOpenedCodeViewer, setHasOpenedCodeViewer] = useState(codeViewerOpen);
  const [hasOpenedSimulation, setHasOpenedSimulation] = useState(simulationOpen);

  const closeCodeViewer = useCallback(() => {
    closeCodeViewerStore();
  }, [closeCodeViewerStore]);

  const closePreview = useCallback(() => {
    if (activeProjectId) setPreviewOpen(activeProjectId, false);
  }, [activeProjectId, setPreviewOpen]);

  const closeSimulation = useCallback(() => {
    closeSimulationStore();
  }, [closeSimulationStore]);

  // Enforce mutual exclusivity: only one right-side panel open at a time.
  useMutuallyExclusivePanels(
    codeViewerOpen,
    previewOpen,
    closeCodeViewer,
    closePreview,
    simulationOpen,
    closeSimulation,
  );

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
  const shouldRenderSimulation = simulationOpen || hasOpenedSimulation;

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

  if (!shouldUseCodeViewerSheet) {
    return (
      <>
        <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView key={threadId} threadId={threadId} />
        </SidebarInset>
        <CodeViewerInlineSidebar
          codeViewerOpen={codeViewerOpen}
          onCloseCodeViewer={closeCodeViewer}
          renderContent={shouldRenderCodeViewerContent}
        />
        {simulationNode}
      </>
    );
  }

  return (
    <>
      <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView key={threadId} threadId={threadId} />
      </SidebarInset>
      <CodeViewerSheet codeViewerOpen={codeViewerOpen} onCloseCodeViewer={closeCodeViewer}>
        {shouldRenderCodeViewerContent ? <LazyCodeViewerPanel /> : null}
      </CodeViewerSheet>
      {simulationNode}
    </>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  component: ChatThreadRouteView,
});
