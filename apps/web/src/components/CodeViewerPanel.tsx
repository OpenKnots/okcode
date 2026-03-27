import { useQuery } from "@tanstack/react-query";
import { FileCodeIcon, XIcon } from "lucide-react";
import { memo, useCallback } from "react";

import { useCodeViewerStore, type CodeViewerTab } from "~/codeViewerStore";
import { useTheme } from "~/hooks/useTheme";
import { projectReadFileQueryOptions } from "~/lib/projectReactQuery";
import { cn } from "~/lib/utils";
import { CodeMirrorViewer } from "./CodeMirrorViewer";
import { type DiffPanelMode, DiffPanelShell, DiffPanelLoadingState } from "./DiffPanelShell";

export type CodeViewerPanelMode = DiffPanelMode;

function CodeViewerTabStrip(props: {
  tabs: CodeViewerTab[];
  activeTabPath: string | null;
  onSelectTab: (relativePath: string) => void;
  onCloseTab: (relativePath: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-webkit-app-region:no-drag]">
      {props.tabs.map((tab) => {
        const isActive = tab.relativePath === props.activeTabPath;
        return (
          <div
            key={tab.relativePath}
            className={cn(
              "group flex max-w-[180px] shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
              isActive
                ? "border-border bg-accent text-accent-foreground"
                : "border-transparent text-muted-foreground/70 hover:border-border/60 hover:text-foreground/80",
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-mono"
              onClick={() => props.onSelectTab(tab.relativePath)}
              title={tab.relativePath}
            >
              {tab.label}
            </button>
            <button
              type="button"
              className="shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-accent/80 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                props.onCloseTab(tab.relativePath);
              }}
              aria-label={`Close ${tab.label}`}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const CodeViewerFileContent = memo(function CodeViewerFileContent(props: {
  cwd: string;
  relativePath: string;
  resolvedTheme: "light" | "dark";
}) {
  const query = useQuery(
    projectReadFileQueryOptions({
      cwd: props.cwd,
      relativePath: props.relativePath,
    }),
  );

  if (query.isLoading) {
    return <DiffPanelLoadingState label="Loading file..." />;
  }

  if (query.isError) {
    const message = query.error instanceof Error ? query.error.message : "Failed to load file.";
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-destructive/80">
        {message}
      </div>
    );
  }

  if (!query.data?.contents && query.data?.contents !== "") {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        No content available.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      {query.data.truncated && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-700 dark:text-amber-300/90">
          File is larger than 1MB. Showing truncated content.
        </div>
      )}
      <CodeMirrorViewer
        contents={query.data.contents}
        filePath={props.relativePath}
        resolvedTheme={props.resolvedTheme}
      />
    </div>
  );
});

interface CodeViewerPanelProps {
  mode?: CodeViewerPanelMode;
}

export default function CodeViewerPanel({ mode = "inline" }: CodeViewerPanelProps) {
  const { resolvedTheme } = useTheme();
  const tabs = useCodeViewerStore((state) => state.tabs);
  const activeTabPath = useCodeViewerStore((state) => state.activeTabPath);
  const setActiveTab = useCodeViewerStore((state) => state.setActiveTab);
  const closeTab = useCodeViewerStore((state) => state.closeTab);

  const activeTab = tabs.find((tab) => tab.relativePath === activeTabPath);

  const onSelectTab = useCallback(
    (relativePath: string) => setActiveTab(relativePath),
    [setActiveTab],
  );

  const onCloseTab = useCallback((relativePath: string) => closeTab(relativePath), [closeTab]);

  const headerRow = (
    <CodeViewerTabStrip
      tabs={tabs}
      activeTabPath={activeTabPath}
      onSelectTab={onSelectTab}
      onCloseTab={onCloseTab}
    />
  );

  return (
    <DiffPanelShell mode={mode} header={headerRow}>
      {!activeTab ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground/60">
          <FileCodeIcon className="size-8 opacity-40" />
          <p className="text-xs">Click a file in the sidebar to view it here.</p>
        </div>
      ) : (
        <CodeViewerFileContent
          key={activeTab.relativePath}
          cwd={activeTab.cwd}
          relativePath={activeTab.relativePath}
          resolvedTheme={resolvedTheme}
        />
      )}
    </DiffPanelShell>
  );
}
