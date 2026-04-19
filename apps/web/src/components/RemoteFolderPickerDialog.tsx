import { useQuery } from "@tanstack/react-query";
import { ChevronRightIcon, FolderIcon, HouseIcon, MoveUpIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { projectListDirectoryQueryOptions } from "~/lib/projectReactQuery";
import { joinRemoteFolderPath, relativeRemoteFolderPath } from "~/lib/remoteFolderPicker";
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
import { ScrollArea } from "./ui/scroll-area";
import { Spinner } from "./ui/spinner";

interface RemoteFolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootPath: string;
  initialPath?: string | undefined;
  title: string;
  description: string;
  onPick: (path: string) => void;
}

export function RemoteFolderPickerDialog({
  open,
  onOpenChange,
  rootPath,
  initialPath,
  title,
  description,
  onPick,
}: RemoteFolderPickerDialogProps) {
  const [currentRelativePath, setCurrentRelativePath] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setCurrentRelativePath(relativeRemoteFolderPath(initialPath, rootPath));
  }, [initialPath, open, rootPath]);

  const currentAbsolutePath = useMemo(
    () => joinRemoteFolderPath(rootPath, currentRelativePath),
    [currentRelativePath, rootPath],
  );

  const directoryQuery = useQuery(
    projectListDirectoryQueryOptions({
      cwd: rootPath || null,
      ...(currentRelativePath ? { directoryPath: currentRelativePath } : {}),
      shallow: true,
      enabled: open && rootPath.trim().length > 0,
    }),
  );

  const directoryEntries = useMemo(
    () => directoryQuery.data?.entries.filter((entry) => entry.kind === "directory") ?? [],
    [directoryQuery.data?.entries],
  );
  const isLoadingDirectories =
    directoryQuery.isPending ||
    (directoryQuery.isFetching && directoryEntries.length === 0 && !directoryQuery.error);

  const pathSegments = useMemo(
    () => (currentRelativePath ? currentRelativePath.split("/").filter(Boolean) : []),
    [currentRelativePath],
  );

  const navigateUp = () => {
    if (!currentRelativePath) {
      return;
    }
    const nextSegments = pathSegments.slice(0, -1);
    setCurrentRelativePath(nextSegments.join("/"));
  };

  const chooseCurrentFolder = () => {
    onPick(currentAbsolutePath);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-h-[min(85vh,48rem)] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
          <div className="rounded-xl border border-border/70 bg-muted/24 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <FolderIcon className="size-3.5" />
              <span>Current folder</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-foreground transition-colors hover:bg-accent"
                onClick={() => setCurrentRelativePath("")}
              >
                <HouseIcon className="size-3.5" />
                {rootPath}
              </button>
              {pathSegments.map((segment, index) => {
                const nextPath = pathSegments.slice(0, index + 1).join("/");
                return (
                  <div key={nextPath} className="inline-flex items-center gap-1.5">
                    <ChevronRightIcon className="size-3 text-muted-foreground/50" />
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-foreground transition-colors hover:bg-accent"
                      onClick={() => setCurrentRelativePath(nextPath)}
                    >
                      {segment}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={navigateUp}
              disabled={!currentRelativePath}
            >
              <MoveUpIcon className="size-3.5" />
              Up one level
            </Button>
            <Button type="button" size="sm" onClick={chooseCurrentFolder}>
              Use this folder
            </Button>
          </div>

          <div className="h-[min(50vh,24rem)] overflow-hidden rounded-xl border border-border/70 bg-card/70">
            <ScrollArea className="size-full">
              <div className="p-2">
                {isLoadingDirectories ? (
                  <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    Loading folders...
                  </div>
                ) : directoryQuery.error ? (
                  <div className="px-2 py-3 text-xs text-destructive">
                    {directoryQuery.error instanceof Error
                      ? directoryQuery.error.message
                      : "Unable to browse folders."}
                  </div>
                ) : directoryEntries.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">No subfolders here.</div>
                ) : (
                  directoryEntries.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
                      onClick={() => setCurrentRelativePath(entry.path)}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">
                          {entry.path.split("/").at(-1) ?? entry.path}
                        </span>
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60" />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={chooseCurrentFolder}>
            Use this folder
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
