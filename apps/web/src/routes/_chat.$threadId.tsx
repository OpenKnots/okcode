import { ThreadId } from "@okcode/contracts";
import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
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
import { DiffWorkerPoolProvider } from "../components/DiffWorkerPoolProvider";
import {
  DiffPanelHeaderSkeleton,
  DiffPanelLoadingState,
  DiffPanelShell,
  type DiffPanelMode,
} from "../components/DiffPanelShell";
import { useComposerDraftStore } from "../composerDraftStore";
import {
  type DiffRouteSearch,
  parseDiffRouteSearch,
  stripDiffSearchParams,
} from "../diffRouteSearch";
import { useCodeViewerStore } from "../codeViewerStore";
import { usePreviewStateStore } from "../previewStateStore";
import { useMutuallyExclusivePanels } from "../mutuallyExclusivePanels";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useClientMode } from "../hooks/useClientMode";
import { useStore } from "../store";
import { Sheet, SheetPopup } from "../components/ui/sheet";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const CodeViewerPanel = lazy(() => import("../components/CodeViewerPanel"));

const DIFF_INLINE_LAYOUT_MEDIA_QUERY = "(max-width: 1180px)";
const DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_diff_sidebar_width";
const DIFF_INLINE_DEFAULT_WIDTH = "clamp(28rem,48vw,44rem)";
const DIFF_INLINE_SIDEBAR_MIN_WIDTH = 26 * 16;
const CODE_VIEWER_SIDEBAR_WIDTH_STORAGE_KEY = "chat_code_viewer_sidebar_width";
const CODE_VIEWER_DEFAULT_WIDTH = "clamp(28rem,48vw,44rem)";
const CODE_VIEWER_SIDEBAR_MIN_WIDTH = 26 * 16;
const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = 208;

const DiffPanelSheet = (props: {
  children: ReactNode;
  diffOpen: boolean;
  onCloseDiff: () => void;
}) => {
  return (
    <Sheet
      open={props.diffOpen}
      onOpenChange={(open) => {
        if (!open) {
          props.onCloseDiff();
        }
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-[min(88vw,820px)] max-w-[820px] p-0"
      >
        {props.children}
      </SheetPopup>
    </Sheet>
  );
};

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

const DiffLoadingFallback = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffPanelShell mode={props.mode} header={<DiffPanelHeaderSkeleton />}>
      <DiffPanelLoadingState label="Loading diff viewer..." />
    </DiffPanelShell>
  );
};

const CodeViewerLoadingFallback = () => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <DiffPanelLoadingState label="Loading code viewer..." />
    </div>
  );
};

const LazyDiffPanel = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffWorkerPoolProvider>
      <Suspense fallback={<DiffLoadingFallback mode={props.mode} />}>
        <DiffPanel mode={props.mode} />
      </Suspense>
    </DiffWorkerPoolProvider>
  );
};

const LazyCodeViewerPanel = () => {
  return (
    <Suspense fallback={<CodeViewerLoadingFallback />}>
      <CodeViewerPanel />
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

const DiffPanelInlineSidebar = (props: {
  diffOpen: boolean;
  onCloseDiff: () => void;
  onOpenDiff: () => void;
  renderDiffContent: boolean;
}) => {
  const { diffOpen, onCloseDiff, onOpenDiff, renderDiffContent } = props;
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenDiff();
        return;
      }
      onCloseDiff();
    },
    [onCloseDiff, onOpenDiff],
  );
  const shouldAcceptInlineSidebarWidth = useShouldAcceptInlineSidebarWidth();

  return (
    <SidebarProvider
      defaultOpen={false}
      open={diffOpen}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": DIFF_INLINE_DEFAULT_WIDTH } as CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border/60 bg-card text-foreground"
        resizable={{
          minWidth: DIFF_INLINE_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
          storageKey: DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        {renderDiffContent ? <LazyDiffPanel mode="sidebar" /> : null}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
};

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
  const search = Route.useSearch();
  const threadExists = useStore((store) => store.threads.some((thread) => thread.id === threadId));
  const draftThreadExists = useComposerDraftStore((store) =>
    Object.hasOwn(store.draftThreadsByThreadId, threadId),
  );
  const routeThreadExists = threadExists || draftThreadExists;
  const diffOpen = search.diff === "1";
  const clientMode = useClientMode();
  const isNarrowDiffLayout = useMediaQuery(DIFF_INLINE_LAYOUT_MEDIA_QUERY);
  const shouldUseDiffSheet = clientMode === "mobile" || isNarrowDiffLayout;
  const shouldUseCodeViewerSheet = clientMode === "mobile";

  // Code viewer state from Zustand store
  const codeViewerOpen = useCodeViewerStore((state) => state.isOpen);
  const closeCodeViewerStore = useCodeViewerStore((state) => state.close);

  // Preview state from Zustand store
  const previewOpen = usePreviewStateStore((state) => state.globalOpen);
  const setPreviewOpen = usePreviewStateStore((state) => state.setGlobalOpen);

  // TanStack Router keeps active route components mounted across param-only navigations
  // unless remountDeps are configured, so this stays warm across thread switches.
  const [hasOpenedDiff, setHasOpenedDiff] = useState(diffOpen);
  const [hasOpenedCodeViewer, setHasOpenedCodeViewer] = useState(codeViewerOpen);

  const closeDiff = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: { diff: undefined },
    });
  }, [navigate, threadId]);
  const openDiff = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return { ...rest, diff: "1" };
      },
    });
  }, [navigate, threadId]);

  const closeCodeViewer = useCallback(() => {
    closeCodeViewerStore();
  }, [closeCodeViewerStore]);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
  }, [setPreviewOpen]);

  // Enforce mutual exclusivity: only one right-side panel open at a time.
  useMutuallyExclusivePanels(
    diffOpen,
    codeViewerOpen,
    previewOpen,
    closeDiff,
    closeCodeViewer,
    closePreview,
  );

  useEffect(() => {
    if (diffOpen) {
      setHasOpenedDiff(true);
    }
  }, [diffOpen]);

  useEffect(() => {
    if (codeViewerOpen) {
      setHasOpenedCodeViewer(true);
    }
  }, [codeViewerOpen]);

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

  const shouldRenderDiffContent = diffOpen || hasOpenedDiff;
  const shouldRenderCodeViewerContent = codeViewerOpen || hasOpenedCodeViewer;

  if (!shouldUseDiffSheet) {
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
        <DiffPanelInlineSidebar
          diffOpen={diffOpen}
          onCloseDiff={closeDiff}
          onOpenDiff={openDiff}
          renderDiffContent={shouldRenderDiffContent}
        />
      </>
    );
  }

  return (
    <>
      <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView key={threadId} threadId={threadId} />
      </SidebarInset>
      {shouldUseCodeViewerSheet ? (
        <CodeViewerSheet codeViewerOpen={codeViewerOpen} onCloseCodeViewer={closeCodeViewer}>
          {shouldRenderCodeViewerContent ? <LazyCodeViewerPanel /> : null}
        </CodeViewerSheet>
      ) : (
        <CodeViewerInlineSidebar
          codeViewerOpen={codeViewerOpen}
          onCloseCodeViewer={closeCodeViewer}
          renderContent={shouldRenderCodeViewerContent}
        />
      )}
      <DiffPanelSheet diffOpen={diffOpen} onCloseDiff={closeDiff}>
        {shouldRenderDiffContent ? <LazyDiffPanel mode="sheet" /> : null}
      </DiffPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  validateSearch: (search) => parseDiffRouteSearch(search),
  search: {
    middlewares: [retainSearchParams<DiffRouteSearch>(["diff"])],
  },
  component: ChatThreadRouteView,
});
