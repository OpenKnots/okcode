import { type CSSProperties, useEffect } from "react";
import { Outlet, useParams } from "@tanstack/react-router";

import { useChatWidgetStore } from "../../chatWidgetStore";
import { useAppSettings } from "../../appSettings";
import { CommandPalette } from "../CommandPalette";
import { ScreenshotTool, ScreenshotButton } from "../ScreenshotTool";
import ThreadSidebar from "../Sidebar";
import { Sidebar, SidebarProvider, SidebarRail } from "../ui/sidebar";
import { ChatWidgetBubble } from "./ChatWidgetBubble";
import { ChatWidgetPanel } from "./ChatWidgetPanel";

const THREAD_SIDEBAR_WIDTH_STORAGE_KEY = "chat_thread_sidebar_width";
const THREAD_SIDEBAR_MIN_WIDTH = 13 * 16;
const THREAD_MAIN_CONTENT_MIN_WIDTH = 40 * 16;

/**
 * Top-level orchestrator for the chat widget mode.
 * Renders either the minimized bubble or the expanded panel with the
 * full chat layout inside it.
 */
export function ChatWidgetShell() {
  const mode = useChatWidgetStore((s) => s.mode);
  const setLastThreadId = useChatWidgetStore((s) => s.setLastThreadId);
  const { settings } = useAppSettings();

  const sidebarBorderOpacity =
    settings.sidebarOpacity >= 1 ? 1 : Math.max(settings.sidebarOpacity, 0.18);

  // Track the current thread for the bubble to navigate back to.
  const params = useParams({ strict: false }) as { threadId?: string };
  useEffect(() => {
    if (params.threadId) {
      setLastThreadId(params.threadId);
    }
  }, [params.threadId, setLastThreadId]);

  // Listen for notification taps to auto-expand.
  useEffect(() => {
    const expand = useChatWidgetStore.getState().expand;

    const onNotificationTap = (() => {
      expand();
      // Navigation to the thread is handled by the notification system.
    }) as EventListener;

    window.addEventListener("okcode:notification-tap", onNotificationTap);
    return () => {
      window.removeEventListener("okcode:notification-tap", onNotificationTap);
    };
  }, []);

  const expanded = mode === "expanded";

  return (
    <>
      {/* The bubble is always mounted but only visible when minimized */}
      {!expanded && <ChatWidgetBubble />}

      {/* Global utilities available in both modes */}
      <CommandPalette />
      <ScreenshotTool />
      {!expanded && (
        <div className="fixed bottom-4 right-4 z-50">
          <ScreenshotButton />
        </div>
      )}

      {/* Expanded panel with the full chat layout */}
      <ChatWidgetPanel expanded={expanded}>
        <SidebarProvider defaultOpen={false}>
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
      </ChatWidgetPanel>
    </>
  );
}
