import type { ThreadId } from "@okcode/contracts";
import { ArrowDownIcon, FolderIcon, GitForkIcon, LoaderIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { gitPullMutationOptions, gitQueryKeys, gitStatusQueryOptions, invalidateGitQueries } from "../lib/gitReactQuery";
import { newCommandId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useComposerDraftStore } from "../composerDraftStore";
import { useStore } from "../store";
import {
  EnvMode,
  resolveDraftEnvModeAfterBranchChange,
  resolveEffectiveEnvMode,
} from "./BranchToolbar.logic";
import { Badge } from "./ui/badge";
import { BranchToolbarBranchSelector } from "./BranchToolbarBranchSelector";
import { Button } from "./ui/button";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { toastManager } from "./ui/toast";

const envModeItems = [
  { value: "local", label: "Local" },
  { value: "worktree", label: "New worktree" },
] as const;

interface BranchToolbarProps {
  threadId: ThreadId;
  onEnvModeChange: (mode: EnvMode) => void;
  envLocked: boolean;
  onCheckoutPullRequestRequest?: (reference: string) => void;
  onComposerFocusRequest?: () => void;
}

export default function BranchToolbar({
  threadId,
  onEnvModeChange,
  envLocked,
  onCheckoutPullRequestRequest,
  onComposerFocusRequest,
}: BranchToolbarProps) {
  const threads = useStore((store) => store.threads);
  const projects = useStore((store) => store.projects);
  const setThreadBranchAction = useStore((store) => store.setThreadBranch);
  const draftThread = useComposerDraftStore((store) => store.getDraftThread(threadId));
  const setDraftThreadContext = useComposerDraftStore((store) => store.setDraftThreadContext);

  const serverThread = threads.find((thread) => thread.id === threadId);
  const activeProjectId = serverThread?.projectId ?? draftThread?.projectId ?? null;
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const activeThreadId = serverThread?.id ?? (draftThread ? threadId : undefined);
  const activeThreadBranch = serverThread?.branch ?? draftThread?.branch ?? null;
  const activeWorktreePath = serverThread?.worktreePath ?? draftThread?.worktreePath ?? null;
  const activeWorktreeBaseBranch =
    serverThread?.worktreeBaseBranch ?? draftThread?.worktreeBaseBranch ?? null;
  const branchCwd = activeWorktreePath ?? activeProject?.cwd ?? null;
  const hasServerThread = serverThread !== undefined;
  const effectiveEnvMode = resolveEffectiveEnvMode({
    activeWorktreePath,
    hasServerThread,
    draftThreadEnvMode: draftThread?.envMode,
  });

  const setThreadBranch = useCallback(
    (branch: string | null, worktreePath: string | null) => {
      if (!activeThreadId) return;
      const api = readNativeApi();
      // If the effective cwd is about to change, stop the running session so the
      // next message creates a new one with the correct cwd.
      if (serverThread?.session && worktreePath !== activeWorktreePath && api) {
        void api.orchestration
          .dispatchCommand({
            type: "thread.session.stop",
            commandId: newCommandId(),
            threadId: activeThreadId,
            createdAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }
      if (api && hasServerThread) {
        void api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: activeThreadId,
          branch,
          worktreePath,
        });
      }
      if (hasServerThread) {
        setThreadBranchAction(activeThreadId, branch, worktreePath);
        return;
      }
      const nextDraftEnvMode = resolveDraftEnvModeAfterBranchChange({
        nextWorktreePath: worktreePath,
        currentWorktreePath: activeWorktreePath,
        effectiveEnvMode,
      });
      setDraftThreadContext(threadId, {
        branch,
        worktreePath,
        envMode: nextDraftEnvMode,
      });
    },
    [
      activeThreadId,
      serverThread?.session,
      activeWorktreePath,
      hasServerThread,
      setThreadBranchAction,
      setDraftThreadContext,
      threadId,
      effectiveEnvMode,
    ],
  );

  const queryClient = useQueryClient();
  const gitCwd = activeWorktreePath ?? activeProject?.cwd ?? null;
  const gitStatus = useQuery(gitStatusQueryOptions(gitCwd));
  const behindCount = gitStatus.data?.behindCount ?? 0;
  const isBehindUpstream = behindCount > 0 && !hasServerThread;
  const pullMutation = useMutation(gitPullMutationOptions({ cwd: gitCwd, queryClient }));

  // Force a fresh git-status fetch when a draft thread mounts so we catch
  // upstream changes immediately instead of waiting for the next poll cycle.
  useEffect(() => {
    if (hasServerThread || !gitCwd) return;
    void queryClient.invalidateQueries({ queryKey: gitQueryKeys.status(gitCwd) });
  }, [hasServerThread, gitCwd, queryClient]);

  const handlePull = useCallback(() => {
    if (pullMutation.isPending) return;
    const promise = pullMutation.mutateAsync();
    void promise
      .then((result) => {
        toastManager.add({
          type: "success",
          title: result.status === "pulled" ? "Pulled" : "Already up to date",
          description:
            result.status === "pulled"
              ? `Updated ${result.branch} from ${result.upstreamBranch ?? "upstream"}.`
              : "Branch is already up to date.",
        });
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Pull failed",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      })
      .finally(() => {
        void invalidateGitQueries(queryClient);
      });
  }, [pullMutation, queryClient]);

  if (!activeThreadId || !activeProject) return null;

  return (
    <div className="mx-auto flex w-full max-w-7xl items-end justify-between px-5 pb-3 pt-1">
      {envLocked || activeWorktreePath ? (
        <span className="inline-flex items-center gap-1 border border-transparent px-[calc(--spacing(3)-1px)] text-sm font-medium text-muted-foreground/70 sm:text-xs">
          {activeWorktreePath ? (
            <>
              <GitForkIcon className="size-3" />
              Worktree
            </>
          ) : (
            <>
              <FolderIcon className="size-3" />
              Local
            </>
          )}
        </span>
      ) : (
        <Select
          value={effectiveEnvMode}
          onValueChange={(value) => onEnvModeChange(value as EnvMode)}
          items={envModeItems}
        >
          <SelectTrigger variant="ghost" size="xs" className="font-medium">
            {effectiveEnvMode === "worktree" ? (
              <GitForkIcon className="size-3" />
            ) : (
              <FolderIcon className="size-3" />
            )}
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            <SelectItem value="local">
              <span className="inline-flex items-center gap-1.5">
                <FolderIcon className="size-3" />
                Local
              </span>
            </SelectItem>
            <SelectItem value="worktree">
              <span className="inline-flex items-center gap-1.5">
                <GitForkIcon className="size-3" />
                New worktree
              </span>
            </SelectItem>
          </SelectPopup>
        </Select>
      )}

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          {isBehindUpstream ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="xs"
                    className="gap-1 text-warning border-warning/30 hover:bg-warning/10"
                    onClick={handlePull}
                    disabled={pullMutation.isPending}
                  >
                    {pullMutation.isPending ? (
                      <LoaderIcon className="size-3 animate-spin" />
                    ) : (
                      <ArrowDownIcon className="size-3" />
                    )}
                    Pull
                    <Badge variant="outline" size="sm" className="ml-0.5 px-1 py-0 text-[10px] text-warning border-warning/30">
                      {behindCount}
                    </Badge>
                  </Button>
                }
              />
              <TooltipPopup side="bottom" align="end">
                Local branch is {behindCount} commit{behindCount !== 1 ? "s" : ""} behind upstream. Pull to update before starting a new thread.
              </TooltipPopup>
            </Tooltip>
          ) : null}
          <BranchToolbarBranchSelector
            activeProjectCwd={activeProject.cwd}
            activeThreadBranch={activeThreadBranch}
            activeWorktreePath={activeWorktreePath}
            branchCwd={branchCwd}
            effectiveEnvMode={effectiveEnvMode}
            envLocked={envLocked}
            onSetThreadBranch={setThreadBranch}
            {...(onCheckoutPullRequestRequest ? { onCheckoutPullRequestRequest } : {})}
            {...(onComposerFocusRequest ? { onComposerFocusRequest } : {})}
          />
        </div>
        {activeWorktreePath && activeWorktreeBaseBranch ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge
                  variant="outline"
                  size="sm"
                  className="max-w-56 truncate px-2 text-[11px] text-muted-foreground"
                >
                  Base: {activeWorktreeBaseBranch}
                </Badge>
              }
            />
            <TooltipPopup side="bottom" align="end">
              OK Code created this worktree from {activeWorktreeBaseBranch}.
            </TooltipPopup>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}
