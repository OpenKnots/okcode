import type { GitWorktreeCleanupCandidate } from "@okcode/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitMergeIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useMemo } from "react";

import { useStore } from "~/store";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import {
  gitMergedWorktreeCleanupCandidatesQueryOptions,
  gitPruneWorktreesMutationOptions,
  gitRemoveWorktreeMutationOptions,
} from "~/lib/gitReactQuery";
import { formatBranchAge, formatWorktreePathForDisplay } from "~/worktreeCleanup";
import { useWorktreeCleanupStore } from "~/worktreeCleanupStore";
import { toastManager } from "./ui/toast";
import { Badge } from "./ui/badge";
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
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { Card, CardContent } from "./ui/card";

function resolveWorktreeUsageCount(
  candidate: GitWorktreeCleanupCandidate,
  threadWorktreePaths: readonly (string | null)[],
): number {
  return threadWorktreePaths.filter((path) => path === candidate.path).length;
}

export function WorktreeCleanupDialog() {
  const open = useWorktreeCleanupStore((state) => state.open);
  const closeDialog = useWorktreeCleanupStore((state) => state.closeDialog);
  const { activeThread } = useHandleNewThread();
  const threads = useStore((state) => state.threads);
  const projects = useStore((state) => state.projects);
  const queryClient = useQueryClient();
  const activeProject = useMemo(() => {
    if (activeThread) {
      return (
        projects.find((project) => project.id === activeThread.projectId) ?? projects[0] ?? null
      );
    }
    return projects[0] ?? null;
  }, [activeThread, projects]);
  const cwd = activeProject?.cwd ?? null;
  const threadWorktreePaths = useMemo(
    () => threads.map((thread) => thread.worktreePath),
    [threads],
  );

  const candidatesQuery = useQuery(gitMergedWorktreeCleanupCandidatesQueryOptions(cwd));
  const removeWorktreeMutation = useMutation(gitRemoveWorktreeMutationOptions({ queryClient }));
  const pruneWorktreesMutation = useMutation(gitPruneWorktreesMutationOptions({ queryClient }));

  const candidates = Array.isArray(candidatesQuery.data) ? candidatesQuery.data : [];
  const hasCandidates = candidates.length > 0;
  const isBusy = removeWorktreeMutation.isPending || pruneWorktreesMutation.isPending;

  const staleCandidates = useMemo(
    () =>
      candidates.filter(
        (c) => !c.pathExists && resolveWorktreeUsageCount(c, threadWorktreePaths) === 0,
      ),
    [candidates, threadWorktreePaths],
  );
  const hasStaleCandidates = staleCandidates.length > 0;

  const handleClose = () => {
    closeDialog();
  };

  const handlePruneAllStale = async () => {
    if (!cwd || !hasStaleCandidates) return;
    try {
      await pruneWorktreesMutation.mutateAsync({ cwd });
      toastManager.add({
        type: "success",
        title: "Stale records pruned",
        description: `Pruned ${staleCandidates.length} stale worktree record${staleCandidates.length === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not prune stale records",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  };

  const handleRemoveCandidate = async (candidate: GitWorktreeCleanupCandidate) => {
    if (!cwd) return;
    const usageCount = resolveWorktreeUsageCount(candidate, threadWorktreePaths);
    if (usageCount > 0) return;

    try {
      if (candidate.pathExists) {
        await removeWorktreeMutation.mutateAsync({
          cwd,
          path: candidate.path,
          force: true,
        });
      } else {
        await pruneWorktreesMutation.mutateAsync({ cwd });
      }
    } catch (error) {
      toastManager.add({
        type: "error",
        title: candidate.pathExists
          ? "Could not delete worktree"
          : "Could not prune worktree record",
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogPopup className="max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle>Merged worktree cleanup</DialogTitle>
          <DialogDescription>
            Review worktrees whose pull requests are already merged. Delete the worktree if it is
            still on disk, or prune the stale Git record if it is already missing.
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
                {candidates.map((candidate, index) => {
                  const usageCount = resolveWorktreeUsageCount(candidate, threadWorktreePaths);
                  const displayPath = formatWorktreePathForDisplay(candidate.path);
                  const canDelete = usageCount === 0;
                  const actionLabel = candidate.pathExists
                    ? "Delete worktree"
                    : "Prune stale records";

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
                              onClick={() => void handleRemoveCandidate(candidate)}
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
                        {index < candidates.length - 1 ? <Separator className="mt-4" /> : null}
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
              {candidates.length} candidate{candidates.length === 1 ? "" : "s"} found
            </div>
            <div className="flex items-center gap-2">
              {hasStaleCandidates ? (
                <Button
                  variant="destructive-outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void handlePruneAllStale()}
                >
                  {pruneWorktreesMutation.isPending ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2Icon className="size-3.5" />
                  )}
                  Prune all stale ({staleCandidates.length})
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
