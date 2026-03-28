import { type ProjectDirectoryEntry, type ProjectEntry } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRightIcon,
  FolderClosedIcon,
  FolderIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { memo, useCallback, useDeferredValue, useState } from "react";
import { useCodeViewerStore } from "~/codeViewerStore";
import { openInPreferredEditor } from "~/editorPreferences";
import {
  projectListDirectoryQueryOptions,
  projectSearchEntriesQueryOptions,
} from "~/lib/projectReactQuery";
import { cn } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { resolvePathLinkTarget } from "~/terminal-links";
import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import { Input } from "./ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { toastManager } from "./ui/toast";

const TREE_ROW_LEFT_PADDING = 8;
const TREE_ROW_DEPTH_OFFSET = 14;

export const WorkspaceFileTree = memo(function WorkspaceFileTree(props: {
  cwd: string;
  resolvedTheme: "light" | "dark";
  className?: string;
}) {
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [includePattern, setIncludePattern] = useState("");
  const [excludePattern, setExcludePattern] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredIncludePattern = useDeferredValue(includePattern);
  const deferredExcludePattern = useDeferredValue(excludePattern);

  const toggleDirectory = useCallback((pathValue: string) => {
    setExpandedDirectories((current) => ({
      ...current,
      [pathValue]: !(current[pathValue] ?? false),
    }));
  }, []);

  const openFileInViewer = useCodeViewerStore((state) => state.openFile);
  const searchActive =
    deferredSearchQuery.trim().length > 0 ||
    deferredIncludePattern.trim().length > 0 ||
    deferredExcludePattern.trim().length > 0;

  const searchResultsQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: props.cwd,
      query: deferredSearchQuery,
      includePattern: deferredIncludePattern,
      excludePattern: deferredExcludePattern,
      enabled: searchActive,
      limit: 120,
    }),
  );

  const openFile = useCallback(
    (filePath: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => {
      // Cmd/Ctrl+click opens in external editor
      if (event?.metaKey || event?.ctrlKey) {
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
        return;
      }

      // Default click opens in built-in code viewer
      openFileInViewer(props.cwd, filePath);
    },
    [props.cwd, openFileInViewer],
  );

  const revealDirectory = useCallback((pathValue: string) => {
    setExpandedDirectories((current) => {
      const next = { ...current };
      for (const ancestorPath of ancestorPathsOf(pathValue)) {
        next[ancestorPath] = true;
      }
      next[pathValue] = true;
      return next;
    });
    setSearchQuery("");
    setIncludePattern("");
    setExcludePattern("");
  }, []);

  return (
    <div className={cn("space-y-2", props.className)}>
      <div className="space-y-1.5 px-2">
        <InputGroup className="h-8">
          <InputGroupAddon>
            <SearchIcon className="size-3.5 text-muted-foreground/65" />
          </InputGroupAddon>
          <InputGroupInput
            size="sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search files"
            spellCheck={false}
            aria-label="Search files"
          />
        </InputGroup>
        <div className="grid gap-1.5">
          <Input
            size="sm"
            value={includePattern}
            onChange={(event) => setIncludePattern(event.target.value)}
            placeholder="Include: src/**, *.{ts,tsx}"
            spellCheck={false}
            aria-label="Files to include"
          />
          <Input
            size="sm"
            value={excludePattern}
            onChange={(event) => setExcludePattern(event.target.value)}
            placeholder="Exclude: dist/**, *.snap"
            spellCheck={false}
            aria-label="Files to exclude"
          />
        </div>
        <p className="text-[10px] text-muted-foreground/55">
          CamelCase, path-ordered, and glob-restricted search.
        </p>
      </div>

      {searchActive ? (
        <WorkspaceSearchResults
          entries={searchResultsQuery.data?.entries ?? []}
          error={searchResultsQuery.error}
          isError={searchResultsQuery.isError}
          isLoading={searchResultsQuery.isLoading}
          onOpenFile={openFile}
          onRevealDirectory={revealDirectory}
          resolvedTheme={props.resolvedTheme}
          truncated={searchResultsQuery.data?.truncated ?? false}
        />
      ) : (
        <WorkspaceFileTreeDirectory
          cwd={props.cwd}
          depth={0}
          expandedDirectories={expandedDirectories}
          onOpenFile={openFile}
          onToggleDirectory={toggleDirectory}
          resolvedTheme={props.resolvedTheme}
        />
      )}
    </div>
  );
});

const WorkspaceSearchResults = memo(function WorkspaceSearchResults(props: {
  entries: readonly ProjectEntry[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  truncated: boolean;
  resolvedTheme: "light" | "dark";
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
  onRevealDirectory: (pathValue: string) => void;
}) {
  if (props.isLoading) {
    return <div className="px-2 py-1 text-[11px] text-muted-foreground/60">Searching files…</div>;
  }

  if (props.isError) {
    const message =
      props.error instanceof Error ? props.error.message : "Unable to search workspace files.";
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-300/90">
        <TriangleAlertIcon className="size-3.5 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
    );
  }

  if (props.entries.length === 0) {
    return <div className="px-2 py-1 text-[11px] text-muted-foreground/60">No files matched.</div>;
  }

  return (
    <div className="space-y-0.5">
      {props.entries.map((entry) => (
        <WorkspaceSearchResultRow
          key={`${entry.kind}:${entry.path}`}
          entry={entry}
          onOpenFile={props.onOpenFile}
          onRevealDirectory={props.onRevealDirectory}
          resolvedTheme={props.resolvedTheme}
        />
      ))}
      {props.truncated ? (
        <div className="px-2 py-1 text-[10px] text-muted-foreground/55">
          Search results are truncated for large workspaces.
        </div>
      ) : null}
    </div>
  );
});

const WorkspaceSearchResultRow = memo(function WorkspaceSearchResultRow(props: {
  entry: ProjectEntry;
  resolvedTheme: "light" | "dark";
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
  onRevealDirectory: (pathValue: string) => void;
}) {
  const parentPath = parentPathOf(props.entry.path);
  const isDirectory = props.entry.kind === "directory";

  return (
    <button
      type="button"
      className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/60"
      onClick={(event) => {
        if (isDirectory) {
          props.onRevealDirectory(props.entry.path);
          return;
        }
        props.onOpenFile(props.entry.path, { metaKey: event.metaKey, ctrlKey: event.ctrlKey });
      }}
      title={props.entry.path}
    >
      <span className="mt-0.5 shrink-0">
        {isDirectory ? (
          <FolderClosedIcon className="size-3.5 text-muted-foreground/75" />
        ) : (
          <VscodeEntryIcon
            pathValue={props.entry.path}
            kind="file"
            theme={props.resolvedTheme}
            className="size-3.5 text-muted-foreground/70"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[11px] text-muted-foreground/85 group-hover:text-foreground/90">
          {basenameOfPath(props.entry.path)}
        </span>
        <span className="block truncate text-[10px] text-muted-foreground/55">
          {parentPath ?? "."}
        </span>
      </span>
    </button>
  );
});

const WorkspaceFileTreeDirectory = memo(function WorkspaceFileTreeDirectory(props: {
  cwd: string;
  directoryPath?: string;
  depth: number;
  expandedDirectories: Readonly<Record<string, boolean>>;
  resolvedTheme: "light" | "dark";
  onToggleDirectory: (pathValue: string) => void;
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
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
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-okcode-tree-path", props.entry.path);
        event.dataTransfer.effectAllowed = "copy";
      }}
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
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
}) {
  const leftPadding = TREE_ROW_LEFT_PADDING + props.depth * TREE_ROW_DEPTH_OFFSET;

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-okcode-tree-path", props.entry.path);
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-accent/60"
      style={{ paddingLeft: `${leftPadding}px` }}
      onClick={(event) =>
        props.onOpenFile(props.entry.path, { metaKey: event.metaKey, ctrlKey: event.ctrlKey })
      }
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

function parentPathOf(pathValue: string): string | null {
  const separatorIndex = pathValue.lastIndexOf("/");
  if (separatorIndex === -1) {
    return null;
  }
  return pathValue.slice(0, separatorIndex);
}

function ancestorPathsOf(pathValue: string): string[] {
  const segments = pathValue.split("/").filter((segment) => segment.length > 0);
  if (segments.length <= 1) return [];

  const ancestors: string[] = [];
  for (let index = 1; index < segments.length; index += 1) {
    ancestors.push(segments.slice(0, index).join("/"));
  }
  return ancestors;
}
