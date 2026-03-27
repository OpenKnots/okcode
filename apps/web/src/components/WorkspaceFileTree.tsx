import { type ProjectDirectoryEntry } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, FolderClosedIcon, FolderIcon, TriangleAlertIcon } from "lucide-react";
import { memo, useCallback, useState } from "react";
import { openInPreferredEditor } from "~/editorPreferences";
import { projectListDirectoryQueryOptions } from "~/lib/projectReactQuery";
import { cn } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { resolvePathLinkTarget } from "~/terminal-links";
import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import { toastManager } from "./ui/toast";

const TREE_ROW_LEFT_PADDING = 8;
const TREE_ROW_DEPTH_OFFSET = 14;

export const WorkspaceFileTree = memo(function WorkspaceFileTree(props: {
  cwd: string;
  resolvedTheme: "light" | "dark";
  className?: string;
}) {
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>({});

  const toggleDirectory = useCallback((pathValue: string) => {
    setExpandedDirectories((current) => ({
      ...current,
      [pathValue]: !(current[pathValue] ?? false),
    }));
  }, []);

  const openFile = useCallback(
    (filePath: string) => {
      const api = readNativeApi();
      if (!api) {
        toastManager.add({
          type: "error",
          title: "File opening is unavailable.",
        });
        return;
      }

      const targetPath = resolvePathLinkTarget(filePath, props.cwd);
      void openInPreferredEditor(api, targetPath).catch((error) => {
        toastManager.add({
          type: "error",
          title: "Unable to open file",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      });
    },
    [props.cwd],
  );

  return (
    <div className={cn("space-y-0.5", props.className)}>
      <WorkspaceFileTreeDirectory
        cwd={props.cwd}
        depth={0}
        expandedDirectories={expandedDirectories}
        onOpenFile={openFile}
        onToggleDirectory={toggleDirectory}
        resolvedTheme={props.resolvedTheme}
      />
    </div>
  );
});

const WorkspaceFileTreeDirectory = memo(function WorkspaceFileTreeDirectory(props: {
  cwd: string;
  directoryPath?: string;
  depth: number;
  expandedDirectories: Readonly<Record<string, boolean>>;
  resolvedTheme: "light" | "dark";
  onToggleDirectory: (pathValue: string) => void;
  onOpenFile: (pathValue: string) => void;
}) {
  const query = useQuery(
    projectListDirectoryQueryOptions({
      cwd: props.cwd,
      ...(props.directoryPath ? { directoryPath: props.directoryPath } : {}),
    }),
  );

  if (query.isLoading) {
    return (
      <div className="px-2 py-1 text-[11px] text-muted-foreground/60">
        {props.directoryPath ? "Loading folder…" : "Loading files…"}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-300/90">
        <TriangleAlertIcon className="size-3.5 shrink-0" />
        <span className="truncate">Unable to load files.</span>
      </div>
    );
  }

  if ((query.data?.entries.length ?? 0) === 0) {
    if (props.directoryPath) {
      return null;
    }
    return <div className="px-2 py-1 text-[11px] text-muted-foreground/60">No files found.</div>;
  }

  return (
    <div className="space-y-0.5">
      {query.data?.entries.map((entry) => {
        if (entry.kind === "directory") {
          const isExpanded = props.expandedDirectories[entry.path] ?? false;
          return (
            <div key={`dir:${entry.path}`}>
              <WorkspaceDirectoryRow
                depth={props.depth}
                entry={entry}
                isExpanded={isExpanded}
                onToggleDirectory={props.onToggleDirectory}
              />
              {isExpanded && (
                <WorkspaceFileTreeDirectory
                  cwd={props.cwd}
                  directoryPath={entry.path}
                  depth={props.depth + 1}
                  expandedDirectories={props.expandedDirectories}
                  onOpenFile={props.onOpenFile}
                  onToggleDirectory={props.onToggleDirectory}
                  resolvedTheme={props.resolvedTheme}
                />
              )}
            </div>
          );
        }

        return (
          <WorkspaceFileRow
            key={`file:${entry.path}`}
            depth={props.depth}
            entry={entry}
            onOpenFile={props.onOpenFile}
            resolvedTheme={props.resolvedTheme}
          />
        );
      })}
      {props.depth === 0 && query.data?.truncated ? (
        <div className="px-2 py-1 text-[10px] text-muted-foreground/55">
          Workspace tree may be truncated for very large repos.
        </div>
      ) : null}
    </div>
  );
});

const WorkspaceDirectoryRow = memo(function WorkspaceDirectoryRow(props: {
  depth: number;
  entry: ProjectDirectoryEntry;
  isExpanded: boolean;
  onToggleDirectory: (pathValue: string) => void;
}) {
  const leftPadding = TREE_ROW_LEFT_PADDING + props.depth * TREE_ROW_DEPTH_OFFSET;

  return (
    <button
      type="button"
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-accent/60",
        !props.entry.hasChildren && "cursor-default",
      )}
      style={{ paddingLeft: `${leftPadding}px` }}
      onClick={() => {
        if (!props.entry.hasChildren) return;
        props.onToggleDirectory(props.entry.path);
      }}
    >
      <ChevronRightIcon
        aria-hidden="true"
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground/70 transition-transform group-hover:text-foreground/80",
          props.isExpanded && "rotate-90",
          !props.entry.hasChildren && "opacity-35",
        )}
      />
      {props.isExpanded ? (
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground/75" />
      ) : (
        <FolderClosedIcon className="size-3.5 shrink-0 text-muted-foreground/75" />
      )}
      <span className="truncate font-mono text-[11px] text-muted-foreground/85 group-hover:text-foreground/90">
        {basenameOfPath(props.entry.path)}
      </span>
    </button>
  );
});

const WorkspaceFileRow = memo(function WorkspaceFileRow(props: {
  depth: number;
  entry: ProjectDirectoryEntry;
  resolvedTheme: "light" | "dark";
  onOpenFile: (pathValue: string) => void;
}) {
  const leftPadding = TREE_ROW_LEFT_PADDING + props.depth * TREE_ROW_DEPTH_OFFSET;

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-accent/60"
      style={{ paddingLeft: `${leftPadding}px` }}
      onClick={() => props.onOpenFile(props.entry.path)}
      title={props.entry.path}
    >
      <span aria-hidden="true" className="size-3.5 shrink-0" />
      <VscodeEntryIcon
        pathValue={props.entry.path}
        kind="file"
        theme={props.resolvedTheme}
        className="size-3.5 text-muted-foreground/70"
      />
      <span className="truncate font-mono text-[11px] text-muted-foreground/80 group-hover:text-foreground/90">
        {basenameOfPath(props.entry.path)}
      </span>
    </button>
  );
});

function basenameOfPath(pathValue: string): string {
  const segments = pathValue.split("/");
  return segments[segments.length - 1] ?? pathValue;
}
