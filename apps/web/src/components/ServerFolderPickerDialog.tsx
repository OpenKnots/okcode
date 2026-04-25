import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  ArrowUpIcon,
  CheckIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  HomeIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readNativeApi } from "~/nativeApi";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { Spinner } from "./ui/spinner";

interface ServerFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Initial path to show. When undefined, defaults to the service user's home. */
  initialPath?: string;
  onSelect: (path: string) => void;
}

/**
 * In-app folder picker that browses the OK Code server's filesystem over
 * WebSocket. Used in web/mobile mode (where no native OS folder picker is
 * available on the server host) to let users add projects by navigating the
 * remote filesystem.
 */
export function ServerFolderPickerDialog({
  open,
  onOpenChange,
  initialPath,
  onSelect,
}: ServerFolderPickerDialogProps) {
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const [pathInput, setPathInput] = useState<string>(initialPath ?? "");
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    if (open) {
      setCurrentPath(initialPath);
      setPathInput(initialPath ?? "");
      setSelectedChild(null);
    }
  }, [open, initialPath]);

  const browseQuery = useQuery({
    queryKey: ["server-folder-picker", currentPath ?? "__home__"],
    enabled: open,
    queryFn: async () => {
      const api = readNativeApi();
      if (!api) {
        throw new Error("okcode API unavailable");
      }
      return api.projects.browseDirectory(currentPath === undefined ? {} : { path: currentPath });
    },
    staleTime: 2000,
    retry: false,
  });

  useEffect(() => {
    if (browseQuery.data?.path && currentPath !== browseQuery.data.path) {
      setCurrentPath(browseQuery.data.path);
      setPathInput(browseQuery.data.path);
    }
  }, [browseQuery.data, currentPath]);

  const navigateTo = useCallback((target: string) => {
    setCurrentPath(target);
    setPathInput(target);
    setSelectedChild(null);
  }, []);

  const navigateUp = useCallback(() => {
    if (browseQuery.data?.parentPath) {
      navigateTo(browseQuery.data.parentPath);
    }
  }, [browseQuery.data?.parentPath, navigateTo]);

  const navigateHome = useCallback(() => {
    setCurrentPath(undefined);
    setSelectedChild(null);
  }, []);

  const handlePathInputSubmit = useCallback(() => {
    const trimmed = pathInput.trim();
    if (trimmed.length === 0) return;
    navigateTo(trimmed);
  }, [navigateTo, pathInput]);

  // Default sort is case-insensitive alphabetical by filename, flat (no
  // directory/file grouping). Clicking the column header toggles direction.
  const sortedEntries = useMemo(() => {
    const entries = [...(browseQuery.data?.entries ?? [])];
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (sortDirection === "desc") entries.reverse();
    return entries;
  }, [browseQuery.data, sortDirection]);

  const toggleSort = useCallback(() => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }, []);

  const pickPath = useMemo(() => {
    if (selectedChild && browseQuery.data) {
      return joinPath(browseQuery.data.path, selectedChild);
    }
    return browseQuery.data?.path;
  }, [browseQuery.data, selectedChild]);

  const handleSelect = useCallback(() => {
    if (!pickPath) return;
    onSelect(pickPath);
    onOpenChange(false);
  }, [onOpenChange, onSelect, pickPath]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Select project folder</DialogTitle>
          <DialogDescription>
            Browse the server&rsquo;s filesystem and pick a directory to open as a project.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={navigateUp}
              disabled={!browseQuery.data?.parentPath}
              aria-label="Up to parent directory"
            >
              <ArrowUpIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={navigateHome}
              aria-label="Go to home directory"
            >
              <HomeIcon className="size-3.5" />
            </Button>
            <Input
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handlePathInputSubmit();
                }
              }}
              placeholder="/absolute/path"
              className="min-w-0 flex-1 font-mono text-xs"
              aria-label="Current path"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/24">
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-3 py-2">
              <button
                type="button"
                onClick={toggleSort}
                className="flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground"
                aria-label={`Sort by name ${sortDirection === "asc" ? "descending" : "ascending"}`}
              >
                Name
                {sortDirection === "asc" ? (
                  <ArrowDownAZIcon className="size-3.5" />
                ) : (
                  <ArrowUpAZIcon className="size-3.5" />
                )}
              </button>
              {browseQuery.data?.partial ? (
                <span className="text-[11px] text-muted-foreground">Some entries skipped</span>
              ) : null}
            </div>

            {browseQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
                <Spinner className="size-3.5" />
                Loading...
              </div>
            ) : browseQuery.error ? (
              <div className="px-3 py-6 text-xs text-destructive">
                {browseQuery.error instanceof Error
                  ? browseQuery.error.message
                  : "Failed to list directory"}
              </div>
            ) : sortedEntries.length === 0 ? (
              <div className="px-3 py-6 text-xs text-muted-foreground">
                This directory is empty.
              </div>
            ) : (
              <ScrollArea className="max-h-[280px]" scrollbarGutter>
                <ul className="divide-y divide-border/40">
                  {sortedEntries.map((entry) => {
                    const isDirectory = entry.kind === "directory";
                    const isSelected = selectedChild === entry.name;
                    if (!isDirectory) {
                      return (
                        <li
                          key={`f:${entry.name}`}
                          className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-muted-foreground/70"
                        >
                          <FileIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                          <span className="flex-1 truncate font-mono">{entry.name}</span>
                          {entry.isSymlink ? (
                            <span className="text-[10px] text-muted-foreground/80">link</span>
                          ) : null}
                        </li>
                      );
                    }
                    return (
                      <li key={`d:${entry.name}`}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent/60 ${
                            isSelected ? "bg-accent/80" : ""
                          }`}
                          onClick={() => setSelectedChild(entry.name)}
                          onDoubleClick={() => {
                            if (browseQuery.data) {
                              navigateTo(joinPath(browseQuery.data.path, entry.name));
                            }
                          }}
                        >
                          {isSelected ? (
                            <FolderOpenIcon className="size-3.5 shrink-0 text-foreground/80" />
                          ) : (
                            <FolderIcon className="size-3.5 shrink-0 text-foreground/60" />
                          )}
                          <span className="flex-1 truncate font-mono">{entry.name}</span>
                          {entry.isSymlink ? (
                            <span className="text-[10px] text-muted-foreground/80">link</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSelect}
            disabled={!pickPath}
            title={pickPath ? `Use: ${pickPath}` : undefined}
          >
            <CheckIcon className="size-3.5" />
            {selectedChild ? "Select subfolder" : "Use this folder"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/** Join a directory and a child name using the server's path conventions. */
function joinPath(dir: string, child: string): string {
  if (dir.endsWith("/") || dir.endsWith("\\")) {
    return `${dir}${child}`;
  }
  // Preserve Windows separators if the parent used them.
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir}${sep}${child}`;
}
