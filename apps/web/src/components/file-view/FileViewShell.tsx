import { useNavigate } from "@tanstack/react-router";
import { FileCodeIcon, XIcon } from "lucide-react";
import { useCallback, useEffect } from "react";

import { useAppSettings } from "~/appSettings";
import { useCodeViewerStore } from "~/codeViewerStore";
import { useTheme } from "~/hooks/useTheme";
import type { CodeContextSelection } from "../CodeMirrorViewer";
import { CodeViewerFileContent, CodeViewerTabStrip } from "../CodeViewerPanel";
import { Button } from "../ui/button";

export function FileViewShell(props: { initialCwd: string; initialPath: string | null }) {
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const { settings } = useAppSettings();

  const tabs = useCodeViewerStore((state) => state.tabs);
  const activeTabId = useCodeViewerStore((state) => state.activeTabId);
  const setActiveTab = useCodeViewerStore((state) => state.setActiveTab);
  const closeTab = useCodeViewerStore((state) => state.closeTab);
  const closeAllTabs = useCodeViewerStore((state) => state.closeAllTabs);
  const openFile = useCodeViewerStore((state) => state.openFile);
  const setPendingContext = useCodeViewerStore((state) => state.setPendingContext);

  // On mount, ensure the initial file is open as a tab
  useEffect(() => {
    if (props.initialPath) {
      openFile(props.initialCwd, props.initialPath);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = tabs.find((tab) => tab.tabId === activeTabId);

  const onSelectTab = useCallback(
    (tabId: string) => {
      setActiveTab(tabId);
      const tab = tabs.find((t) => t.tabId === tabId);
      if (tab) {
        void navigate({
          to: "/file-view",
          search: { cwd: tab.cwd, path: tab.relativePath },
          replace: true,
        });
      }
    },
    [setActiveTab, tabs, navigate],
  );

  const onCloseTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((item) => item.tabId === tabId);
      if (!tab) return;
      if (tab.isDirty && !settings.codeViewerAutosave) {
        const confirmed = window.confirm(`Discard unsaved changes in "${tab.label}"?`);
        if (!confirmed) return;
      }
      closeTab(tabId);
      if (tabs.length <= 1) {
        await navigate({ to: "/" });
      }
    },
    [closeTab, navigate, settings.codeViewerAutosave, tabs],
  );

  const onCloseAll = useCallback(async () => {
    if (tabs.some((tab) => tab.isDirty) && !settings.codeViewerAutosave) {
      const confirmed = window.confirm("Discard unsaved changes in all open files?");
      if (!confirmed) return;
    }
    closeAllTabs();
    await navigate({ to: "/" });
  }, [closeAllTabs, navigate, settings.codeViewerAutosave, tabs]);

  const onAddContext = useCallback(
    (ctx: CodeContextSelection) => {
      setPendingContext({
        filePath: ctx.filePath,
        fromLine: ctx.fromLine,
        toLine: ctx.toLine,
      });
    },
    [setPendingContext],
  );



  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 h-12">
        <CodeViewerTabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onCloseAll={onCloseAll}
        />
        <div className="flex shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={onCloseAll}
            aria-label="Close all open files"
            title="Close all open files"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
        <div className="h-full w-full max-w-5xl">
          {!activeTab ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground/60">
              <FileCodeIcon className="size-8 opacity-40" />
              <p className="text-xs">Click a file in the sidebar to view it here.</p>
            </div>
          ) : (
            <CodeViewerFileContent
              key={activeTab.tabId}
              cwd={activeTab.cwd}
              relativePath={activeTab.relativePath}
              resolvedTheme={resolvedTheme}
              onAddContext={onAddContext}
            />
          )}
        </div>
      </div>
    </div>
  );
}
