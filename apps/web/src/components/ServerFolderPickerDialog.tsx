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
  Loader2Icon,
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

  // Reset when dialog opens so stale state from a previous session doesn't leak.
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

  // Keep pathInput in sync with the resolved server path (handles the case where
  // we opened at `undefined` and the server resolves it to $HOME).
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
      <DialogPopup>
        <DialogPanel className="w-[min(560px,95vw)]">
          <DialogHeader>
            <DialogTitle>Select project folder</DialogTitle>
            <DialogDescription>
              Browse the OK Code server&rsquo;s filesystem. Only directories you can read are shown.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={navigateUp}
              disabled={!browseQuery.data?.parentPath}
              aria-label="Up to parent directory"
            >
              <ArrowUpIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={navigateHome}
              aria-label="Go to home directory"
            >
              <HomeIcon className="size-4" />
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
              className="flex-1 font-mono text-xs"
              aria-label="Current path"
            />
          </div>

          <div className="mt-3 flex h-[320px] flex-col overflow-hidden rounded-md border border-border bg-secondary">
            <div className="flex shrink-0 items-center border-b border-border/60 px-3 py-1.5">
              <button
                type="button"
                onClick={toggleSort}
                className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                aria-label={`Sort by name ${sortDirection === "asc" ? "descending" : "ascending"}`}
              >
                Name
                {sortDirection === "asc" ? (
                  <ArrowDownAZIcon className="size-3" />
                ) : (
                  <ArrowUpAZIcon className="size-3" />
                )}
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              {browseQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                </div>
              ) : browseQuery.error ? (
                <div className="p-3 text-xs text-red-500">
                  {browseQuery.error instanceof Error
                    ? browseQuery.error.message
                    : "Failed to list directory"}
                </div>
              ) : sortedEntries.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">(empty directory)</div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {sortedEntries.map((entry) => {
                    const isDirectory = entry.kind === "directory";
                    const isSelected = selectedChild === entry.name;
                    if (!isDirectory) {
                      return (
                        <li
                          key={`f:${entry.name}`}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground/70"
                        >
                          <FileIcon className="size-3.5 shrink-0 text-muted-foreground/50" />
                          <span className="flex-1 truncate font-mono">{entry.name}</span>
                          {entry.isSymlink && (
                            <span className="text-[10px] text-muted-foreground/80">link</span>
                          )}
                        </li>
                      );
                    }
                    return (
                      <li key={`d:${entry.name}`}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                            isSelected ? "bg-accent" : ""
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
                          {entry.isSymlink && (
                            <span className="text-[10px] text-muted-foreground/80">link</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {browseQuery.data?.partial && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Some entries were skipped (broken symlinks or permission denied).
            </p>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSelect}
              disabled={!pickPath}
              title={pickPath ? `Use: ${pickPath}` : undefined}
            >
              <CheckIcon className="mr-1 size-4" />
              {selectedChild ? "Select subfolder" : "Use this folder"}
            </Button>
          </DialogFooter>
        </DialogPanel>
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
