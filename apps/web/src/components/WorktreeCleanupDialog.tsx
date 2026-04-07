import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GitMergeIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";

import { useCurrentWorktreeCleanupCandidates } from "~/hooks/useCurrentWorktreeCleanupCandidates";
import { gitRemoveWorktreeMutationOptions } from "~/lib/gitReactQuery";
import { readNativeApi } from "~/nativeApi";
import { useStore } from "~/store";
import {
  buildWorktreeCleanupCandidateStates,
  formatBranchAge,
  formatWorktreePathForDisplay,
  type WorktreeCleanupCandidateState,
} from "~/worktreeCleanup";
import { useWorktreeCleanupStore } from "~/worktreeCleanupStore";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
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
import { Separator } from "./ui/separator";
import { toastManager } from "./ui/toast";

export function WorktreeCleanupDialog() {
  const open = useWorktreeCleanupStore((state) => state.open);
  const closeDialog = useWorktreeCleanupStore((state) => state.closeDialog);
  const threads = useStore((state) => state.threads);
  const queryClient = useQueryClient();
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { candidates, candidatesQuery, cwd } = useCurrentWorktreeCleanupCandidates();
  const threadWorktreePaths = useMemo(
    () => threads.map((thread) => thread.worktreePath),
    [threads],
  );

  const removeWorktreeMutation = useMutation(gitRemoveWorktreeMutationOptions({ queryClient }));
  const candidateStates = useMemo(
    () =>
      buildWorktreeCleanupCandidateStates({
        candidates,
        threadWorktreePaths,
      }),
    [candidates, threadWorktreePaths],
  );
  const actionableCandidateStates = useMemo(
    () => candidateStates.filter((state) => state.canDelete),
    [candidateStates],
  );
  const onDiskCandidateCount = actionableCandidateStates.filter(
    (state) => state.candidate.pathExists,
  ).length;
  const staleCandidateCount = actionableCandidateStates.length - onDiskCandidateCount;
  const hasCandidates = candidateStates.length > 0;
  const isBusy = isDeletingAll || removeWorktreeMutation.isPending;

  const handleClose = () => {
    closeDialog();
  };

  const handleRemoveCandidate = async (candidateState: WorktreeCleanupCandidateState) => {
    if (!cwd || !candidateState.canDelete) return;

    try {
      await removeWorktreeMutation.mutateAsync({
        cwd,
        path: candidateState.candidate.path,
        force: true,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: candidateState.candidate.pathExists
          ? "Could not delete worktree"
          : "Could not remove stale record",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  };

  const handleDeleteAll = async () => {
    if (!cwd || actionableCandidateStates.length === 0) return;

    const skippedCount = candidateStates.length - actionableCandidateStates.length;
    const summaryLines = ["Delete all available cleanup candidates?"];
    const effects: string[] = [];
    if (onDiskCandidateCount > 0) {
      effects.push(
        `delete ${onDiskCandidateCount} worktree${onDiskCandidateCount === 1 ? "" : "s"} on disk`,
      );
    }
    if (staleCandidateCount > 0) {
      effects.push(
        `remove ${staleCandidateCount} stale Git record${staleCandidateCount === 1 ? "" : "s"}`,
      );
    }
    if (effects.length > 0) {
      summaryLines.push(`${effects.join(" and ")}.`);
    }
    if (skippedCount > 0) {
      summaryLines.push(
        `Skip ${skippedCount} candidate${skippedCount === 1 ? "" : "s"} still linked to thread${skippedCount === 1 ? "" : "s"}.`,
      );
    }
    summaryLines.push("This cannot be undone.");

    const api = readNativeApi();
    const confirmMessage = summaryLines.join("\n");
    const confirmed = api
      ? await api.dialogs.confirm(confirmMessage)
      : window.confirm(confirmMessage);
    if (!confirmed) {
      return;
    }

    setIsDeletingAll(true);
    let deletedOnDiskCount = 0;
    let deletedStaleCount = 0;
    try {
      for (const candidateState of actionableCandidateStates) {
        await removeWorktreeMutation.mutateAsync({
          cwd,
          path: candidateState.candidate.path,
          force: true,
        });
        if (candidateState.candidate.pathExists) {
          deletedOnDiskCount += 1;
        } else {
          deletedStaleCount += 1;
        }
      }

      const completedParts: string[] = [];
      if (deletedOnDiskCount > 0) {
        completedParts.push(
          `Deleted ${deletedOnDiskCount} worktree${deletedOnDiskCount === 1 ? "" : "s"}`,
        );
      }
      if (deletedStaleCount > 0) {
        completedParts.push(
          `removed ${deletedStaleCount} stale Git record${deletedStaleCount === 1 ? "" : "s"}`,
        );
      }
      if (skippedCount > 0) {
        completedParts.push(
          `skipped ${skippedCount} candidate${skippedCount === 1 ? "" : "s"} still linked to thread${skippedCount === 1 ? "" : "s"}`,
        );
      }

      toastManager.add({
        type: "success",
        title: "Cleanup complete",
        description: `${completedParts.join("; ")}.`,
      });
    } catch (error) {
      const completedParts: string[] = [];
      if (deletedOnDiskCount > 0) {
        completedParts.push(
          `Deleted ${deletedOnDiskCount} worktree${deletedOnDiskCount === 1 ? "" : "s"}`,
        );
      }
      if (deletedStaleCount > 0) {
        completedParts.push(
          `removed ${deletedStaleCount} stale Git record${deletedStaleCount === 1 ? "" : "s"}`,
        );
      }

      toastManager.add({
        type: "error",
        title: "Cleanup stopped before finishing",
        description: `${completedParts.length > 0 ? `${completedParts.join("; ")} before the failure. ` : ""}${error instanceof Error ? error.message : "Unknown error."}`,
      });
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogPopup className="max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle>Merged worktree cleanup</DialogTitle>
          <DialogDescription>
            Review worktrees whose pull requests are already merged. Delete the worktree if it is
            still on disk, or remove the stale Git record if it is already missing.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="px-4 pb-4 sm:px-6">
          {!cwd ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="px-4 py-5 text-sm text-muted-foreground">
                Open a project first, then use this command to review merged worktrees.
              </CardContent>
            </Card>
          ) : candidatesQuery.isLoading ? (
            <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Loading merged worktrees...
            </div>
          ) : candidatesQuery.isError ? (
            <Card className="border-destructive/24 bg-destructive/6">
              <CardContent className="px-4 py-5 text-sm text-destructive-foreground">
                Could not load merged worktrees:{" "}
                {candidatesQuery.error instanceof Error
                  ? candidatesQuery.error.message
                  : "Unknown error."}
              </CardContent>
            </Card>
          ) : !hasCandidates ? (
            <Card className="border-dashed bg-muted/30">
              <CardContent className="px-4 py-5 text-sm text-muted-foreground">
                No merged worktree candidates were found in this repository.
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[60vh] pr-1" scrollbarGutter>
              <div className="space-y-3">
                {candidateStates.map((candidateState, index) => {
                  const { candidate, canDelete, usageCount } = candidateState;
                  const displayPath = formatWorktreePathForDisplay(candidate.path);
                  const actionLabel = candidate.pathExists
                    ? "Delete worktree"
                    : "Delete stale record";

                  return (
                    <Card
                      key={`${candidate.branch}:${candidate.path}`}
                      className="border-border/70 bg-card/78"
                    >
                      <CardContent className="px-4 py-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <a
                                href={candidate.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="no-underline"
                              >
                                <Badge
                                  variant="outline"
                                  size="sm"
                                  className="cursor-pointer hover:bg-accent"
                                >
                                  <GitMergeIcon className="size-3.5" />
                                  Merged PR #{candidate.prNumber}
                                </Badge>
                              </a>
                              {candidate.pathExists ? (
                                <Badge variant="success" size="sm">
                                  On disk
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm">
                                  Missing on disk
                                </Badge>
                              )}
                              {usageCount > 0 ? (
                                <Badge variant="info" size="sm">
                                  In use by {usageCount} thread{usageCount === 1 ? "" : "s"}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {candidate.prTitle}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                Branch{" "}
                                <span className="font-mono text-foreground">
                                  {candidate.branch}
                                </span>
                                {" · "}
                                Path{" "}
                                <span className="font-mono text-foreground">{displayPath}</span>
                                {" · "}
                                Merged{" "}
                                <span className="text-foreground">
                                  {formatBranchAge(candidate.mergedAt)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="destructive-outline"
                              size="sm"
                              disabled={!canDelete || isBusy}
                              onClick={() => void handleRemoveCandidate(candidateState)}
                            >
                              {isBusy ? (
                                <LoaderCircleIcon className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2Icon className="size-3.5" />
                              )}
                              {actionLabel}
                            </Button>
                          </div>
                        </div>
                        {index < candidateStates.length - 1 ? (
                          <Separator className="mt-4" />
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogPanel>
        <DialogFooter variant="bare">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {candidateStates.length} candidate{candidateStates.length === 1 ? "" : "s"} found
            </div>
            <div className="flex items-center gap-2">
              {actionableCandidateStates.length > 0 ? (
                <Button
                  variant="destructive-outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void handleDeleteAll()}
                >
                  {isDeletingAll ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-3.5" />
                  )}
                  Delete all ({actionableCandidateStates.length})
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
