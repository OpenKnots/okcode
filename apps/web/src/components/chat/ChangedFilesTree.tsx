import { type TurnId } from "@okcode/contracts";
import { type MouseEvent, memo, useCallback, useEffect, useMemo, useState } from "react";
import { type TurnDiffFileChange } from "../../types";
import { buildTurnDiffTree, type TurnDiffTreeNode } from "../../lib/turnDiffTree";
import { ChevronRightIcon, FolderIcon, FolderClosedIcon } from "lucide-react";
import { cn, isMacPlatform } from "~/lib/utils";
import { openInPreferredEditor } from "~/editorPreferences";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { readNativeApi } from "~/nativeApi";
import { resolvePathLinkTarget } from "~/terminal-links";
import { DiffStatLabel, hasNonZeroStat } from "./DiffStatLabel";
import { VscodeEntryIcon } from "./VscodeEntryIcon";
import { toastManager } from "../ui/toast";

type ChangedFileAction = "open-in-editor" | "reveal-in-finder" | "copy-path";
type ChangedDirectoryAction = "reveal-in-finder" | "copy-path";

export const ChangedFilesTree = memo(function ChangedFilesTree(props: {
  turnId: TurnId;
  files: ReadonlyArray<TurnDiffFileChange>;
  allDirectoriesExpanded: boolean;
  resolvedTheme: "light" | "dark";
  cwd: string | undefined;
}) {
  const { files, allDirectoriesExpanded, resolvedTheme, turnId, cwd } = props;
  const fileManagerName =
    typeof navigator !== "undefined" && isMacPlatform(navigator.platform)
      ? "Finder"
      : "File Manager";

  const { copyToClipboard: copyPathToClipboard } = useCopyToClipboard<{ path: string }>({
    onCopy: (ctx) => {
      toastManager.add({ type: "success", title: "Path copied", description: ctx.path });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Failed to copy path",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    },
  });

  const revealInFileManager = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api || !cwd) return;
      const absolutePath = resolvePathLinkTarget(pathValue, cwd);
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
    [cwd, fileManagerName],
  );

  const openDirectoryInFileManager = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api || !cwd) return;
      const absolutePath = resolvePathLinkTarget(pathValue, cwd);
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
    [cwd, fileManagerName],
  );

  const openInEditor = useCallback(
    async (pathValue: string) => {
      const api = readNativeApi();
      if (!api || !cwd) return;
      const targetPath = resolvePathLinkTarget(pathValue, cwd);
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
    [cwd],
  );

  const copyPath = useCallback(
    (pathValue: string) => {
      if (!cwd) return;
      const absolutePath = resolvePathLinkTarget(pathValue, cwd);
      copyPathToClipboard(absolutePath, { path: absolutePath });
    },
    [cwd, copyPathToClipboard],
  );
  const treeNodes = useMemo(() => buildTurnDiffTree(files), [files]);
  const directoryPathsKey = useMemo(
    () => collectDirectoryPaths(treeNodes).join("\u0000"),
    [treeNodes],
  );
  const allDirectoryExpansionState = useMemo(
    () =>
      buildDirectoryExpansionState(
        directoryPathsKey ? directoryPathsKey.split("\u0000") : [],
        allDirectoriesExpanded,
      ),
    [allDirectoriesExpanded, directoryPathsKey],
  );
  const [expandedDirectories, setExpandedDirectories] = useState<Record<string, boolean>>(() =>
    buildDirectoryExpansionState(directoryPathsKey ? directoryPathsKey.split("\u0000") : [], true),
  );
  useEffect(() => {
    setExpandedDirectories(allDirectoryExpansionState);
  }, [allDirectoryExpansionState]);

  const toggleDirectory = useCallback((pathValue: string, fallbackExpanded: boolean) => {
    setExpandedDirectories((current) => ({
      ...current,
      [pathValue]: !(current[pathValue] ?? fallbackExpanded),
    }));
  }, []);

  const handleDirectoryContextMenu = useCallback(
    async (
      event: MouseEvent<HTMLButtonElement>,
      node: TurnDiffTreeNode & { kind: "directory" },
    ) => {
      event.preventDefault();
      const api = readNativeApi();
      if (!api || !cwd) return;
      const clicked = await api.contextMenu.show<ChangedDirectoryAction>(
        [
          { id: "reveal-in-finder", label: `Open in ${fileManagerName}` },
          { id: "copy-path", label: "Copy path" },
        ],
        { x: event.clientX, y: event.clientY },
      );
      if (clicked === "reveal-in-finder") {
        openDirectoryInFileManager(node.path);
      } else if (clicked === "copy-path") {
        copyPath(node.path);
      }
    },
    [cwd, fileManagerName, openDirectoryInFileManager, copyPath],
  );

  const handleFileContextMenu = useCallback(
    async (event: MouseEvent<HTMLButtonElement>, node: TurnDiffTreeNode & { kind: "file" }) => {
      event.preventDefault();
      const api = readNativeApi();
      if (!api || !cwd) return;
      const clicked = await api.contextMenu.show<ChangedFileAction>(
        [
          { id: "open-in-editor", label: "Open in editor" },
          { id: "reveal-in-finder", label: `Reveal in ${fileManagerName}` },
          { id: "copy-path", label: "Copy path" },
        ],
        { x: event.clientX, y: event.clientY },
      );
      if (clicked === "open-in-editor") {
        openInEditor(node.path);
      } else if (clicked === "reveal-in-finder") {
        revealInFileManager(node.path);
      } else if (clicked === "copy-path") {
        copyPath(node.path);
      }
    },
    [cwd, fileManagerName, openInEditor, revealInFileManager, copyPath],
  );

  const renderTreeNode = (node: TurnDiffTreeNode, depth: number) => {
    const leftPadding = 8 + depth * 14;
    if (node.kind === "directory") {
      const isExpanded = expandedDirectories[node.path] ?? depth === 0;
      return (
        <div key={`dir:${node.path}`}>
          <button
            type="button"
            className="group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-background/80"
            style={{ paddingLeft: `${leftPadding}px` }}
            onClick={() => toggleDirectory(node.path, depth === 0)}
            onContextMenu={(event) => handleDirectoryContextMenu(event, node)}
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground/70 transition-transform group-hover:text-foreground/80",
                isExpanded && "rotate-90",
              )}
            />
            {isExpanded ? (
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground/75" />
            ) : (
              <FolderClosedIcon className="size-3.5 shrink-0 text-muted-foreground/75" />
            )}
            <span className="truncate font-mono text-[11px] text-muted-foreground/90 group-hover:text-foreground/90">
              {node.name}
            </span>
            {hasNonZeroStat(node.stat) && (
              <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums">
                <DiffStatLabel additions={node.stat.additions} deletions={node.stat.deletions} />
              </span>
            )}
          </button>
          {isExpanded && (
            <div className="space-y-0.5">
              {node.children.map((childNode) => renderTreeNode(childNode, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={`file:${node.path}`}
        type="button"
        className="group flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left hover:bg-background/80"
        style={{ paddingLeft: `${leftPadding}px` }}
        onClick={() => openInEditor(node.path)}
        onContextMenu={(event) => handleFileContextMenu(event, node)}
      >
        <span aria-hidden="true" className="size-3.5 shrink-0" />
        <VscodeEntryIcon
          pathValue={node.path}
          kind="file"
          theme={resolvedTheme}
          className="size-3.5 text-muted-foreground/70"
        />
        <span className="truncate font-mono text-[11px] text-muted-foreground/80 group-hover:text-foreground/90">
          {node.name}
        </span>
        {node.stat && (
          <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums">
            <DiffStatLabel additions={node.stat.additions} deletions={node.stat.deletions} />
          </span>
        )}
      </button>
    );
  };

  return <div className="space-y-0.5">{treeNodes.map((node) => renderTreeNode(node, 0))}</div>;
});

function collectDirectoryPaths(nodes: ReadonlyArray<TurnDiffTreeNode>): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.kind !== "directory") continue;
    paths.push(node.path);
    paths.push(...collectDirectoryPaths(node.children));
  }
  return paths;
}

function buildDirectoryExpansionState(
  directoryPaths: ReadonlyArray<string>,
  expanded: boolean,
): Record<string, boolean> {
  const expandedState: Record<string, boolean> = {};
  for (const directoryPath of directoryPaths) {
    expandedState[directoryPath] = expanded;
  }
  return expandedState;
}
