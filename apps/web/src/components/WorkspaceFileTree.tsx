import { type ProjectDirectoryEntry, type ProjectEntry } from "@okcode/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRightIcon,
  FolderClosedIcon,
  FolderIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { type MouseEvent, memo, useCallback, useDeferredValue, useState } from "react";
import { openInPreferredEditor } from "~/editorPreferences";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useFileViewNavigation } from "~/hooks/useFileViewNavigation";
import {
  projectListDirectoryQueryOptions,
  projectSearchEntriesQueryOptions,
} from "~/lib/projectReactQuery";
import { cn, isMacPlatform } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { resolvePathLinkTarget } from "~/terminal-links";
import { VscodeEntryIcon } from "./chat/VscodeEntryIcon";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { Input } from "./ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { toastManager } from "./ui/toast";

const TREE_ROW_LEFT_PADDING = 8;
const TREE_ROW_DEPTH_OFFSET = 14;
type WorkspaceFileAction = "open" | "open-in-editor" | "reveal-in-finder" | "copy-path" | "delete";
type WorkspaceDirectoryAction = "expand" | "collapse" | "open-in-finder" | "copy-path" | "delete";
type WorkspaceSearchDirectoryAction = "reveal-in-tree" | "open-in-finder" | "copy-path" | "delete";

export const WorkspaceFileTree = memo(function WorkspaceFileTree(props: {
  cwd: string;
  resolvedTheme: "light" | "dark";
  className?: string;
}) {
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [includePattern, setIncludePattern] = useState("");
  const [excludePattern, setExcludePattern] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredIncludePattern = useDeferredValue(includePattern);
  const deferredExcludePattern = useDeferredValue(excludePattern);

  const toggleDirectory = useCallback((pathValue: string) => {
    setExpandedDirectories((current) => ({
      ...current,
      [pathValue]: !(current[pathValue] ?? false),
    }));
  }, []);

  const openFileInViewer = useFileViewNavigation();
  const fileManagerName =
    typeof navigator !== "undefined" && isMacPlatform(navigator.platform)
      ? "Finder"
      : "File Manager";
  const { copyToClipboard: copyPathToClipboard } = useCopyToClipboard<{ path: string }>({
    onCopy: (ctx) => {
      toastManager.add({
        type: "success",
        title: "Path copied",
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Failed to copy path",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    },
  });
  const filtersHaveContent = includePattern.trim().length > 0 || excludePattern.trim().length > 0;
  const filtersVisible = filtersOpen || filtersHaveContent;

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

  const openFileInNativeEditor = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api) {
        toastManager.add({
          type: "error",
          title: "File opening is unavailable.",
        });
        return;
      }

      const targetPath = resolvePathLinkTarget(pathValue, props.cwd);
      try {
        await openInPreferredEditor(api, targetPath);
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Unable to open file",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    },
    [props.cwd],
  );

  const openDirectoryInFileManager = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api) return;
      const absolutePath = resolvePathLinkTarget(pathValue, props.cwd);
      try {
        await api.shell.openInFileManager(absolutePath);
      } catch (error) {
        toastManager.add({
          type: "error",
          title: `Unable to open in ${fileManagerName}`,
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    },
    [fileManagerName, props.cwd],
  );

  const revealFileInFileManager = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api) return;
      const absolutePath = resolvePathLinkTarget(pathValue, props.cwd);
      try {
        await api.shell.revealInFileManager(absolutePath);
      } catch (error) {
        toastManager.add({
          type: "error",
          title: `Unable to reveal in ${fileManagerName}`,
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    },
    [fileManagerName, props.cwd],
  );

  const copyWorkspacePath = useCallback(
    (pathValue: string) => {
      const absolutePath = resolvePathLinkTarget(pathValue, props.cwd);
      copyPathToClipboard(absolutePath, { path: absolutePath });
    },
    [copyPathToClipboard, props.cwd],
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
    setFiltersOpen(false);
  }, []);

  const queryClient = useQueryClient();
  const deleteEntry = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api) return;
      const name = basenameOfPath(pathValue);
      const confirmed = await api.dialog.confirm(`Are you sure you want to delete "${name}"?`);
      if (!confirmed) return;
      try {
        await api.projects.deleteEntry({ cwd: props.cwd, relativePath: pathValue });
        toastManager.add({ type: "success", title: `Deleted ${name}` });
        void queryClient.invalidateQueries({ queryKey: ["projectListDirectory"] });
        void queryClient.invalidateQueries({ queryKey: ["projectSearchEntries"] });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Failed to delete",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      }
    },
    [props.cwd, queryClient],
  );

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
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-label="Toggle file filters"
              aria-expanded={filtersVisible}
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors hover:bg-accent/60",
                filtersHaveContent && "text-foreground",
              )}
            >
              <SlidersHorizontalIcon
                className={cn(
                  "size-3.5",
                  filtersHaveContent ? "text-foreground" : "text-muted-foreground/65",
                )}
              />
            </button>
          </InputGroupAddon>
        </InputGroup>
        <Collapsible open={filtersVisible}>
          <CollapsibleContent>
            <div className="grid gap-1.5 pt-1.5">
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
          </CollapsibleContent>
        </Collapsible>
      </div>

      {searchActive ? (
        <WorkspaceSearchResults
          cwd={props.cwd}
          entries={searchResultsQuery.data?.entries ?? []}
          error={searchResultsQuery.error}
          isError={searchResultsQuery.isError}
          isLoading={searchResultsQuery.isLoading}
          fileManagerName={fileManagerName}
          onCopyPath={copyWorkspacePath}
          onDeleteEntry={deleteEntry}
          onOpenDirectoryInFileManager={openDirectoryInFileManager}
          onOpenFileInEditor={openFileInNativeEditor}
          onOpenFile={openFile}
          onRevealFileInFileManager={revealFileInFileManager}
          onRevealDirectory={revealDirectory}
          resolvedTheme={props.resolvedTheme}
          truncated={searchResultsQuery.data?.truncated ?? false}
        />
      ) : (
        <WorkspaceFileTreeDirectory
          cwd={props.cwd}
          depth={0}
          expandedDirectories={expandedDirectories}
          fileManagerName={fileManagerName}
          onCopyPath={copyWorkspacePath}
          onDeleteEntry={deleteEntry}
          onOpenDirectoryInFileManager={openDirectoryInFileManager}
          onOpenFileInEditor={openFileInNativeEditor}
          onOpenFile={openFile}
          onRevealFileInFileManager={revealFileInFileManager}
          onToggleDirectory={toggleDirectory}
          resolvedTheme={props.resolvedTheme}
        />
      )}
    </div>
  );
});

const WorkspaceSearchResults = memo(function WorkspaceSearchResults(props: {
  cwd: string;
  entries: readonly ProjectEntry[];
  fileManagerName: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  truncated: boolean;
  resolvedTheme: "light" | "dark";
  onCopyPath: (pathValue: string) => void;
  onDeleteEntry: (pathValue: string) => void;
  onOpenDirectoryInFileManager: (pathValue: string) => void;
  onOpenFileInEditor: (pathValue: string) => void;
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
  onRevealFileInFileManager: (pathValue: string) => void;
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
          cwd={props.cwd}
          entry={entry}
          fileManagerName={props.fileManagerName}
          onCopyPath={props.onCopyPath}
          onDeleteEntry={props.onDeleteEntry}
          onOpenDirectoryInFileManager={props.onOpenDirectoryInFileManager}
          onOpenFileInEditor={props.onOpenFileInEditor}
          onOpenFile={props.onOpenFile}
          onRevealFileInFileManager={props.onRevealFileInFileManager}
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
  cwd: string;
  entry: ProjectEntry;
  fileManagerName: string;
  resolvedTheme: "light" | "dark";
  onCopyPath: (pathValue: string) => void;
  onDeleteEntry: (pathValue: string) => void;
  onOpenDirectoryInFileManager: (pathValue: string) => void;
  onOpenFileInEditor: (pathValue: string) => void;
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
  onRevealFileInFileManager: (pathValue: string) => void;
  onRevealDirectory: (pathValue: string) => void;
}) {
  const parentPath = parentPathOf(props.entry.path);
  const isDirectory = props.entry.kind === "directory";
  const handleContextMenu = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const api = readNativeApi();
      if (!api) return;

      if (isDirectory) {
        const clicked = await api.contextMenu.show<WorkspaceSearchDirectoryAction>(
          [
            { id: "reveal-in-tree", label: "Reveal in tree" },
            { id: "open-in-finder", label: `Open in ${props.fileManagerName}` },
            { id: "copy-path", label: "Copy path" },
            { id: "delete", label: "Delete", destructive: true },
          ],
          { x: event.clientX, y: event.clientY },
        );
        if (clicked === "reveal-in-tree") {
          props.onRevealDirectory(props.entry.path);
        } else if (clicked === "open-in-finder") {
          props.onOpenDirectoryInFileManager(props.entry.path);
        } else if (clicked === "copy-path") {
          props.onCopyPath(props.entry.path);
        } else if (clicked === "delete") {
          props.onDeleteEntry(props.entry.path);
        }
        return;
      }

      const clicked = await api.contextMenu.show<WorkspaceFileAction>(
        [
          { id: "open", label: "Open" },
          { id: "open-in-editor", label: "Open in editor" },
          { id: "reveal-in-finder", label: `Reveal in ${props.fileManagerName}` },
          { id: "copy-path", label: "Copy path" },
          { id: "delete", label: "Delete", destructive: true },
        ],
        { x: event.clientX, y: event.clientY },
      );

      if (clicked === "open") {
        props.onOpenFile(props.entry.path);
      } else if (clicked === "open-in-editor") {
        props.onOpenFileInEditor(props.entry.path);
      } else if (clicked === "reveal-in-finder") {
        props.onRevealFileInFileManager(props.entry.path);
      } else if (clicked === "copy-path") {
        props.onCopyPath(props.entry.path);
      } else if (clicked === "delete") {
        props.onDeleteEntry(props.entry.path);
      }
    },
    [isDirectory, props],
  );

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
      onContextMenu={handleContextMenu}
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
  fileManagerName: string;
  resolvedTheme: "light" | "dark";
  onCopyPath: (pathValue: string) => void;
  onDeleteEntry: (pathValue: string) => void;
  onOpenDirectoryInFileManager: (pathValue: string) => void;
  onOpenFileInEditor: (pathValue: string) => void;
  onToggleDirectory: (pathValue: string) => void;
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
  onRevealFileInFileManager: (pathValue: string) => void;
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

  const entries = query.data?.entries ?? [];
  const truncated = query.data?.truncated ?? false;

  if (entries.length === 0) {
    if (props.directoryPath) {
      return null;
    }
    return <div className="px-2 py-1 text-[11px] text-muted-foreground/60">No files found.</div>;
  }

  return (
    <div className="space-y-0.5">
      {entries.map((entry) => {
        if (entry.kind === "directory") {
          const isExpanded = props.expandedDirectories[entry.path] ?? false;
          return (
            <div key={`dir:${entry.path}`}>
              <WorkspaceDirectoryRow
                depth={props.depth}
                entry={entry}
                fileManagerName={props.fileManagerName}
                isExpanded={isExpanded}
                onCopyPath={props.onCopyPath}
                onDeleteEntry={props.onDeleteEntry}
                onOpenDirectoryInFileManager={props.onOpenDirectoryInFileManager}
                onToggleDirectory={props.onToggleDirectory}
              />
              {isExpanded && (
                <WorkspaceFileTreeDirectory
                  cwd={props.cwd}
                  directoryPath={entry.path}
                  depth={props.depth + 1}
                  expandedDirectories={props.expandedDirectories}
                  fileManagerName={props.fileManagerName}
                  onCopyPath={props.onCopyPath}
                  onDeleteEntry={props.onDeleteEntry}
                  onOpenDirectoryInFileManager={props.onOpenDirectoryInFileManager}
                  onOpenFileInEditor={props.onOpenFileInEditor}
                  onOpenFile={props.onOpenFile}
                  onRevealFileInFileManager={props.onRevealFileInFileManager}
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
            fileManagerName={props.fileManagerName}
            onCopyPath={props.onCopyPath}
            onDeleteEntry={props.onDeleteEntry}
            onOpenFileInEditor={props.onOpenFileInEditor}
            onOpenFile={props.onOpenFile}
            onRevealFileInFileManager={props.onRevealFileInFileManager}
            resolvedTheme={props.resolvedTheme}
          />
        );
      })}
      {props.depth === 0 && truncated ? (
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
  fileManagerName: string;
  isExpanded: boolean;
  onCopyPath: (pathValue: string) => void;
  onDeleteEntry: (pathValue: string) => void;
  onOpenDirectoryInFileManager: (pathValue: string) => void;
  onToggleDirectory: (pathValue: string) => void;
}) {
  const leftPadding = TREE_ROW_LEFT_PADDING + props.depth * TREE_ROW_DEPTH_OFFSET;
  const handleContextMenu = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const api = readNativeApi();
      if (!api) return;
      const clicked = await api.contextMenu.show<WorkspaceDirectoryAction>(
        [
          {
            id: props.isExpanded ? "collapse" : "expand",
            label: props.isExpanded ? "Collapse" : "Expand",
          },
          { id: "open-in-finder", label: `Open in ${props.fileManagerName}` },
          { id: "copy-path", label: "Copy path" },
          { id: "delete", label: "Delete", destructive: true },
        ],
        { x: event.clientX, y: event.clientY },
      );
      if (clicked === "expand" || clicked === "collapse") {
        props.onToggleDirectory(props.entry.path);
      } else if (clicked === "open-in-finder") {
        props.onOpenDirectoryInFileManager(props.entry.path);
      } else if (clicked === "copy-path") {
        props.onCopyPath(props.entry.path);
      } else if (clicked === "delete") {
        props.onDeleteEntry(props.entry.path);
      }
    },
    [props],
  );

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
      onContextMenu={handleContextMenu}
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
  fileManagerName: string;
  resolvedTheme: "light" | "dark";
  onCopyPath: (pathValue: string) => void;
  onDeleteEntry: (pathValue: string) => void;
  onOpenFileInEditor: (pathValue: string) => void;
  onOpenFile: (pathValue: string, event?: { metaKey?: boolean; ctrlKey?: boolean }) => void;
  onRevealFileInFileManager: (pathValue: string) => void;
}) {
  const leftPadding = TREE_ROW_LEFT_PADDING + props.depth * TREE_ROW_DEPTH_OFFSET;
  const handleContextMenu = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const api = readNativeApi();
      if (!api) return;
      const clicked = await api.contextMenu.show<WorkspaceFileAction>(
        [
          { id: "open", label: "Open" },
          { id: "open-in-editor", label: "Open in editor" },
          { id: "reveal-in-finder", label: `Reveal in ${props.fileManagerName}` },
          { id: "copy-path", label: "Copy path" },
          { id: "delete", label: "Delete", destructive: true },
        ],
        { x: event.clientX, y: event.clientY },
      );
      if (clicked === "open") {
        props.onOpenFile(props.entry.path);
      } else if (clicked === "open-in-editor") {
        props.onOpenFileInEditor(props.entry.path);
      } else if (clicked === "reveal-in-finder") {
        props.onRevealFileInFileManager(props.entry.path);
      } else if (clicked === "copy-path") {
        props.onCopyPath(props.entry.path);
      } else if (clicked === "delete") {
        props.onDeleteEntry(props.entry.path);
      }
    },
    [props],
  );

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
      onContextMenu={handleContextMenu}
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
