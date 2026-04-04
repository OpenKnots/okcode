import { useQuery } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon, FileCodeIcon, XIcon } from "lucide-react";
import { memo, useCallback, useState } from "react";

import { useCodeViewerStore, type CodeViewerTab } from "~/codeViewerStore";
import { useTheme } from "~/hooks/useTheme";
import { projectReadFileQueryOptions } from "~/lib/projectReactQuery";
import { cn, isMacPlatform } from "~/lib/utils";
import { isMarkdownPreviewFilePath } from "~/markdownPreview";
import { CodeMirrorViewer, type CodeContextSelection } from "./CodeMirrorViewer";
import { DiffPanelLoadingState } from "./DiffPanelShell";
import { MarkdownPreview } from "./MarkdownPreview";
import { isElectron } from "~/env";
import { Button } from "./ui/button";

/** Check if a file path is a dotenv / secrets file whose values should be masked. */
function isEnvFile(filePath: string): boolean {
  const basename = filePath.split("/").pop() ?? filePath;
  return /^\.env(\..*)?$/.test(basename);
}

export function CodeViewerTabStrip(props: {
  tabs: CodeViewerTab[];
  activeTabPath: string | null;
  onSelectTab: (relativePath: string) => void;
  onCloseTab: (relativePath: string) => void;
  onCloseAll: () => void;
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

export const CodeViewerFileContent = memo(function CodeViewerFileContent(props: {
  cwd: string;
  relativePath: string;
  resolvedTheme: "light" | "dark";
  onAddContext: (ctx: CodeContextSelection) => void;
}) {
  const envFile = isEnvFile(props.relativePath);
  const [envValuesRevealed, setEnvValuesRevealed] = useState(false);

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

  if (!query.data?.contents && query.data?.contents !== "" && !query.data?.imageDataUrl) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        No content available.
      </div>
    );
  }

  // Render image files
  if (query.data?.imageDataUrl) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <img
          src={query.data.imageDataUrl}
          alt={props.relativePath}
          className="max-h-full max-w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {query.data.truncated && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-700 dark:text-amber-300/90">
          File is larger than 1MB. Showing truncated content.
        </div>
      )}

      {/* Env file: show/hide toggle banner */}
      {envFile && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300/90">
            Sensitive file — values are hidden by default
          </span>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="gap-1.5 text-[11px] text-amber-700 hover:text-amber-900 dark:text-amber-300/90 dark:hover:text-amber-100"
            onClick={() => setEnvValuesRevealed((prev) => !prev)}
          >
            {envValuesRevealed ? (
              <>
                <EyeOffIcon className="size-3.5" />
                Hide values
              </>
            ) : (
              <>
                <EyeIcon className="size-3.5" />
                Show values
              </>
            )}
          </Button>
        </div>
      )}

      <div
        className={cn(
          envFile &&
            !envValuesRevealed &&
            "select-none blur-[6px] transition-[filter] duration-200",
        )}
      >
        {isMarkdownPreviewFilePath(props.relativePath) ? (
          <MarkdownPreview contents={query.data.contents} />
        ) : (
          <CodeMirrorViewer
            contents={query.data.contents}
            filePath={props.relativePath}
            resolvedTheme={props.resolvedTheme}
            onAddContext={props.onAddContext}
          />
        )}
      </div>
    </div>
  );
});

export default function CodeViewerPanel() {
  const { resolvedTheme } = useTheme();
  const tabs = useCodeViewerStore((state) => state.tabs);
  const activeTabPath = useCodeViewerStore((state) => state.activeTabPath);
  const setActiveTab = useCodeViewerStore((state) => state.setActiveTab);
  const closeTab = useCodeViewerStore((state) => state.closeTab);
  const closeViewer = useCodeViewerStore((state) => state.close);
  const setPendingContext = useCodeViewerStore((state) => state.setPendingContext);

  const activeTab = tabs.find((tab) => tab.relativePath === activeTabPath);

  const onSelectTab = useCallback(
    (relativePath: string) => setActiveTab(relativePath),
    [setActiveTab],
  );

  const onCloseTab = useCallback((relativePath: string) => closeTab(relativePath), [closeTab]);

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
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border px-4",
          isElectron ? "drag-region h-[52px]" : "h-12",
        )}
      >
        <CodeViewerTabStrip
          tabs={tabs}
          activeTabPath={activeTabPath}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onCloseAll={closeViewer}
        />
        <div className="flex shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="hidden text-[10px] text-muted-foreground/50 sm:inline">
            Select code + {modKey}L to add context
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={closeViewer}
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
