import { useNavigate } from "@tanstack/react-router";
import { FileCodeIcon, XIcon } from "lucide-react";
import { useCallback, useEffect } from "react";

import { useCodeViewerStore } from "~/codeViewerStore";
import { useTheme } from "~/hooks/useTheme";
import { isMacPlatform } from "~/lib/utils";
import type { CodeContextSelection } from "../CodeMirrorViewer";
import { CodeViewerFileContent, CodeViewerTabStrip } from "../CodeViewerPanel";
import { Button } from "../ui/button";

export function FileViewShell(props: { initialCwd: string; initialPath: string | null }) {
  const { resolvedTheme } = useTheme();
  const navigate = useNavigate();

  const tabs = useCodeViewerStore((state) => state.tabs);
  const activeTabPath = useCodeViewerStore((state) => state.activeTabPath);
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

  const activeTab = tabs.find((tab) => tab.relativePath === activeTabPath);

  const onSelectTab = useCallback(
    (relativePath: string) => {
      setActiveTab(relativePath);
      const tab = tabs.find((t) => t.relativePath === relativePath);
      if (tab) {
        void navigate({
          to: "/file-view",
          search: { cwd: tab.cwd, path: relativePath },
          replace: true,
        });
      }
    },
    [setActiveTab, tabs, navigate],
  );

  const onCloseTab = useCallback(
    (relativePath: string) => {
      closeTab(relativePath);
      // Check if this was the last tab (after closing, store will have tabs.length - 1)
      if (tabs.length <= 1) {
        void navigate({ to: "/" });
      }
    },
    [closeTab, tabs.length, navigate],
  );

  const onCloseAll = useCallback(() => {
    closeAllTabs();
    void navigate({ to: "/" });
  }, [closeAllTabs, navigate]);

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

  const modKey = isMacPlatform(navigator.platform) ? "\u2318" : "Ctrl+";

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 h-12">
        <CodeViewerTabStrip
          tabs={tabs}
          activeTabPath={activeTabPath}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onCloseAll={onCloseAll}
        />
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-[10px] text-muted-foreground/50 sm:inline">
            Select code + {modKey}L to add context
          </span>
          <Button size="icon-xs" variant="ghost" onClick={onCloseAll} aria-label="Close all tabs">
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
              key={activeTab.relativePath}
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
