import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpenIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isElectron } from "~/env";
import { gitCloneRepositoryMutationOptions } from "~/lib/gitReactQuery";
import { parseGitHubRepositoryUrl, type ParsedGitHubUrl } from "~/githubRepositoryUrl";
import { deriveRemoteFolderBrowserRoot, isProbablyLocalWebSession } from "~/lib/remoteFolderPicker";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { readNativeApi } from "~/nativeApi";
import { RemoteFolderPickerDialog } from "./RemoteFolderPickerDialog";
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
import { Spinner } from "./ui/spinner";
import { toastManager } from "./ui/toast";

interface CloneRepositoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloned: (result: { path: string; branch: string; repoName: string }) => Promise<void> | void;
}

export function CloneRepositoryDialog({
  open,
  onOpenChange,
  onCloned,
}: CloneRepositoryDialogProps) {
  const queryClient = useQueryClient();
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [urlDirty, setUrlDirty] = useState(false);
  const [targetDir, setTargetDir] = useState("");
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [remoteFolderPickerOpen, setRemoteFolderPickerOpen] = useState(false);

  const cloneMutation = useMutation(gitCloneRepositoryMutationOptions({ queryClient }));
  const { reset: resetCloneMutation } = cloneMutation;
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const shouldUseWebFolderBrowser = !isElectron && !isProbablyLocalWebSession();
  const canUseRemoteFolderBrowser =
    shouldUseWebFolderBrowser && Boolean(serverConfigQuery.data?.cwd);
  const remoteFolderBrowserRoot = useMemo(
    () =>
      serverConfigQuery.data?.cwd ? deriveRemoteFolderBrowserRoot(serverConfigQuery.data.cwd) : "",
    [serverConfigQuery.data?.cwd],
  );

  const parsed: ParsedGitHubUrl | null = useMemo(() => parseGitHubRepositoryUrl(url), [url]);

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setUrlDirty(false);
    setTargetDir("");
    resetCloneMutation();
  }, [open, resetCloneMutation]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      urlInputRef.current?.focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const pickTargetDir = useCallback(async () => {
    const api = readNativeApi();
    if (!api || isPickingFolder) return;
    if (shouldUseWebFolderBrowser) {
      if (!canUseRemoteFolderBrowser) {
        toastManager.add({
          type: "error",
          title: "Folder browser is still loading",
          description: "Wait a moment for the server path to load, then try again.",
        });
        return;
      }
      setRemoteFolderPickerOpen(true);
      return;
    }

    setIsPickingFolder(true);
    try {
      const pickedPath = await api.dialogs.pickFolder();
      if (pickedPath) {
        setTargetDir(pickedPath);
      }
    } catch {
      // Swallow folder picker errors
    } finally {
      setIsPickingFolder(false);
    }
  }, [canUseRemoteFolderBrowser, isPickingFolder, shouldUseWebFolderBrowser]);

  const handleClone = useCallback(async () => {
    if (!parsed) {
      setUrlDirty(true);
      return;
    }
    if (!targetDir) {
      return;
    }

    try {
      const result = await cloneMutation.mutateAsync({
        url: parsed.cloneUrl,
        targetDir,
        ...(parsed.branch ? { branch: parsed.branch } : {}),
      });
      await onCloned({
        path: result.path,
        branch: result.branch,
        repoName: parsed.repo,
      });
      onOpenChange(false);
    } catch {
      // Error is tracked through cloneMutation.error
    }
  }, [cloneMutation, onCloned, onOpenChange, parsed, targetDir]);

  const validationMessage = !urlDirty
    ? null
    : url.trim().length === 0
      ? "Paste a GitHub repository URL or enter owner/repo."
      : parsed === null
        ? "Use a GitHub URL (https://github.com/owner/repo) or owner/repo."
        : null;

  const errorMessage =
    validationMessage ??
    (cloneMutation.error instanceof Error
      ? cloneMutation.error.message
      : cloneMutation.error
        ? "Failed to clone repository."
        : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!cloneMutation.isPending) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Clone from GitHub</DialogTitle>
          <DialogDescription>
            Clone a GitHub repository and open it as a new project.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Repository URL</span>
            <Input
              ref={urlInputRef}
              placeholder="https://github.com/owner/repo or owner/repo"
              value={url}
              onChange={(event) => {
                setUrlDirty(true);
                setUrl(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (parsed && targetDir && !cloneMutation.isPending) {
                  void handleClone();
                }
              }}
            />
          </label>

          {parsed ? (
            <div className="rounded-xl border border-border/70 bg-muted/24 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {parsed.owner}/{parsed.repo}
                </p>
                {parsed.branch ? (
                  <p className="truncate text-xs text-muted-foreground">Branch: {parsed.branch}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Clone into</span>
            <div className="flex gap-2">
              <Input
                placeholder="Select a parent directory..."
                value={targetDir}
                onChange={(event) => setTargetDir(event.target.value)}
                className="flex-1"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (parsed && targetDir && !cloneMutation.isPending) {
                    void handleClone();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => void pickTargetDir()}
                disabled={isPickingFolder || cloneMutation.isPending}
              >
                <FolderOpenIcon className="size-3.5" />
                {shouldUseWebFolderBrowser ? "Browse server folders" : "Browse"}
              </Button>
            </div>
            {parsed && targetDir ? (
              <p className="text-xs text-muted-foreground">
                Will clone to: {targetDir}/{parsed.repo}
              </p>
            ) : null}
          </label>

          {cloneMutation.isPending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              Cloning repository...
            </div>
          ) : null}

          {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={cloneMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleClone()}
            disabled={!parsed || !targetDir || cloneMutation.isPending}
          >
            {cloneMutation.isPending ? "Cloning..." : "Clone & Open"}
          </Button>
        </DialogFooter>
      </DialogPopup>
      <RemoteFolderPickerDialog
        open={remoteFolderPickerOpen}
        onOpenChange={setRemoteFolderPickerOpen}
        rootPath={remoteFolderBrowserRoot}
        initialPath={targetDir || undefined}
        title="Browse server folders"
        description="Pick a parent directory on the machine running OK Code. This works from remote web sessions such as Tailscale."
        onPick={setTargetDir}
      />
    </Dialog>
  );
}
