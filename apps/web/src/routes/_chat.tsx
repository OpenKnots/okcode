import { type ResolvedKeybindingsConfig } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { type CSSProperties, useEffect } from "react";

import ThreadSidebar from "../components/Sidebar";
import { CommandPalette } from "../components/CommandPalette";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { isTerminalFocused } from "../lib/terminalFocus";
import { isMacPlatform } from "../lib/utils";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { resolveShortcutCommand } from "../keybindings";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { useCommandPaletteStore } from "../commandPaletteStore";
import { useStore } from "../store";
import { resolveSidebarNewThreadEnvMode } from "~/components/Sidebar.logic";
import { useAppSettings } from "~/appSettings";
import { Sidebar, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import { useAutoDeleteMergedThreads } from "~/hooks/useAutoDeleteMergedThreads";
import { useClientMode } from "~/hooks/useClientMode";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const THREAD_SIDEBAR_WIDTH_STORAGE_KEY = "chat_thread_sidebar_width";
const THREAD_SIDEBAR_MIN_WIDTH = 13 * 16;
const THREAD_MAIN_CONTENT_MIN_WIDTH = 40 * 16;

function ChatRouteGlobalShortcuts() {
  const clearSelection = useThreadSelectionStore((state) => state.clearSelection);
  const selectedThreadIdsSize = useThreadSelectionStore((state) => state.selectedThreadIds.size);
  const { activeDraftThread, activeThread, handleNewThread, projects, routeThreadId } =
    useHandleNewThread();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const keybindings = serverConfigQuery.data?.keybindings ?? EMPTY_KEYBINDINGS;
  const terminalOpen = useTerminalStateStore((state) =>
    routeThreadId
      ? selectThreadTerminalState(state.terminalStateByThreadId, routeThreadId).terminalOpen
      : false,
  );
  const { settings: appSettings } = useAppSettings();
  const togglePalette = useCommandPaletteStore((state) => state.togglePalette);
  const openPalette = useCommandPaletteStore((state) => state.openPalette);
  const paletteOpen = useCommandPaletteStore((state) => state.open);
  const pushMruThread = useCommandPaletteStore((state) => state.pushMruThread);
  const pushMruProject = useCommandPaletteStore((state) => state.pushMruProject);
  const storeProjects = useStore((state) => state.projects);
  const storeThreads = useStore((state) => state.threads);
  const navigate = useNavigate();

  // ── Track MRU on route changes ──────────────────────────────────
  useEffect(() => {
    if (!routeThreadId) return;
    pushMruThread(routeThreadId);
    const thread = storeThreads.find((t) => t.id === routeThreadId);
    if (thread) pushMruProject(thread.projectId);
  }, [routeThreadId, storeThreads, pushMruThread, pushMruProject]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key === "Escape" && selectedThreadIdsSize > 0) {
        event.preventDefault();
        clearSelection();
        return;
      }

      // ── Command Palette: Cmd+K (Mac) / Ctrl+K (non-Mac) ──────
      const isMac = isMacPlatform(navigator.platform);
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      const key = event.key.toLowerCase();

      if (key === "k" && modKey && !event.altKey && !event.shiftKey && !isTerminalFocused()) {
        event.preventDefault();
        event.stopPropagation();
        togglePalette();
        return;
      }

      // ── Project switching: Cmd+1-9 (Mac) / Ctrl+1-9 (non-Mac) ─
      if (
        modKey &&
        !event.altKey &&
        !event.shiftKey &&
        key >= "1" &&
        key <= "9" &&
        !isTerminalFocused() &&
        !paletteOpen
      ) {
        const index = parseInt(key, 10) - 1;
        if (index < storeProjects.length) {
          event.preventDefault();
          event.stopPropagation();
          const project = storeProjects[index];
          if (project) {
            pushMruProject(project.id);
            // Navigate to the most recent thread in that project
            const projectThreads = storeThreads
              .filter((t) => t.projectId === project.id)
              .toSorted((a, b) =>
                (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
              );
            const latestThread = projectThreads[0];
            if (latestThread) {
              pushMruThread(latestThread.id);
              void navigate({ to: "/$threadId", params: { threadId: latestThread.id } });
            }
          }
          return;
        }
      }

      // ── Quick thread switch: Cmd+P opens thread search ─────────
      if (key === "p" && modKey && !event.altKey && !event.shiftKey && !isTerminalFocused()) {
        event.preventDefault();
        event.stopPropagation();
        openPalette("threads");
        return;
      }

      const projectId = activeThread?.projectId ?? activeDraftThread?.projectId ?? projects[0]?.id;
      if (!projectId) return;

      const command = resolveShortcutCommand(event, keybindings, {
        context: {
          terminalFocus: isTerminalFocused(),
          terminalOpen,
        },
      });

      if (command === "chat.newLocal") {
        event.preventDefault();
        event.stopPropagation();
        void handleNewThread(projectId, {
          envMode: resolveSidebarNewThreadEnvMode({
            defaultEnvMode: appSettings.defaultThreadEnvMode,
          }),
        });
        return;
      }

      if (command !== "chat.new") return;
      event.preventDefault();
      event.stopPropagation();
      void handleNewThread(projectId, {
        branch: activeThread?.branch ?? activeDraftThread?.branch ?? null,
        worktreePath: activeThread?.worktreePath ?? activeDraftThread?.worktreePath ?? null,
        envMode: activeDraftThread?.envMode ?? (activeThread?.worktreePath ? "worktree" : "local"),
      });
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [
    activeDraftThread,
    activeThread,
    clearSelection,
    handleNewThread,
    keybindings,
    navigate,
    openPalette,
    paletteOpen,
    projects,
    pushMruProject,
    pushMruThread,
    selectedThreadIdsSize,
    storeProjects,
    storeThreads,
    terminalOpen,
    togglePalette,
    appSettings.defaultThreadEnvMode,
  ]);

  return null;
}

function ChatRouteLayout() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const sidebarBorderOpacity =
    settings.sidebarOpacity >= 1 ? 1 : Math.max(settings.sidebarOpacity, 0.18);
  const clientMode = useClientMode();

  useEffect(() => {
    const onMenuAction = window.desktopBridge?.onMenuAction;
    if (typeof onMenuAction !== "function") {
      return;
    }

    const unsubscribe = onMenuAction((action) => {
      if (action !== "open-settings") return;
      void navigate({ to: "/settings" });
    });

    return () => {
      unsubscribe?.();
    };
  }, [navigate]);

  // Auto-delete threads whose PR has been merged (when enabled in settings).
  useAutoDeleteMergedThreads(settings);

  return (
    <SidebarProvider defaultOpen={clientMode !== "mobile"}>
      <ChatRouteGlobalShortcuts />
      <CommandPalette />
      <Sidebar
        side="left"
        collapsible="offcanvas"
        className="border-r-2 border-border/60 bg-card/80 text-foreground backdrop-blur-sm shadow-[2px_0_12px_-4px_rgba(0,0,0,0.08)] dark:border-border/40 dark:bg-card/60 dark:shadow-[2px_0_16px_-4px_rgba(0,0,0,0.3)]"
        style={
          {
            "--sidebar-background-opacity": settings.sidebarOpacity,
            "--sidebar-border-opacity": sidebarBorderOpacity,
          } as CSSProperties
        }
        resizable={{
          minWidth: THREAD_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: ({ nextWidth, wrapper }) =>
            wrapper.clientWidth - nextWidth >= THREAD_MAIN_CONTENT_MIN_WIDTH,
          storageKey: THREAD_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        <ThreadSidebar />
        <SidebarRail />
      </Sidebar>
      <Outlet />
    </SidebarProvider>
  );
}

export const Route = createFileRoute("/_chat")({
  component: ChatRouteLayout,
});
