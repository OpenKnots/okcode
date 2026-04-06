import type { GitHubIssueDetail } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { githubGetIssueQueryOptions } from "~/lib/githubReactQuery";
import { cn } from "~/lib/utils";
import { parseIssueReferenceParts } from "~/issueReference";
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

interface IssueThreadDialogProps {
  open: boolean;
  cwd: string | null;
  initialReference: string | null;
  onOpenChange: (open: boolean) => void;
  onStartThread: (input: {
    issue: GitHubIssueDetail;
    mode: "local" | "worktree";
  }) => Promise<void> | void;
}

export function IssueThreadDialog({
  open,
  cwd,
  initialReference,
  onOpenChange,
  onStartThread,
}: IssueThreadDialogProps) {
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState(initialReference ?? "");
  const [referenceDirty, setReferenceDirty] = useState(false);
  const [startingMode, setStartingMode] = useState<"local" | "worktree" | null>(null);
  const [debouncedReference, referenceDebouncer] = useDebouncedValue(
    reference,
    { wait: 450 },
    (debouncerState) => ({ isPending: debouncerState.isPending }),
  );

  useEffect(() => {
    if (!open) return;
    setReference(initialReference ?? "");
    setReferenceDirty(false);
    setStartingMode(null);
  }, [initialReference, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      referenceInputRef.current?.focus();
      referenceInputRef.current?.select();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  const parsedReference = parseIssueReferenceParts(reference);
  const parsedDebouncedReference = parseIssueReferenceParts(debouncedReference);
  const parsedNumber = parsedReference ? Number(parsedReference.number) : null;
  const parsedDebouncedNumber = parsedDebouncedReference
    ? Number(parsedDebouncedReference.number)
    : null;

  const resolveIssueQuery = useQuery(
    githubGetIssueQueryOptions({
      cwd,
      number: open ? parsedDebouncedNumber : null,
    }),
  );

  const resolvedIssue: GitHubIssueDetail | null =
    parsedNumber !== null && parsedNumber === parsedDebouncedNumber
      ? (resolveIssueQuery.data?.issue ?? null)
      : null;

  const isResolving =
    open &&
    parsedNumber !== null &&
    resolvedIssue === null &&
    (referenceDebouncer.state.isPending ||
      parsedNumber !== parsedDebouncedNumber ||
      resolveIssueQuery.isPending ||
      resolveIssueQuery.isFetching);

  const statusTone = useMemo(() => {
    switch (resolvedIssue?.state) {
      case "closed":
        return "text-violet-600 dark:text-violet-300/90";
      case "open":
        return "text-emerald-600 dark:text-emerald-300/90";
      default:
        return "text-muted-foreground";
    }
  }, [resolvedIssue?.state]);

  const handleConfirm = useCallback(
    async (mode: "local" | "worktree") => {
      if (!parsedNumber) {
        setReferenceDirty(true);
        return;
      }
      if (!resolvedIssue || !cwd) {
        return;
      }
      setStartingMode(mode);
      try {
        await onStartThread({ issue: resolvedIssue, mode });
        onOpenChange(false);
      } finally {
        setStartingMode(null);
      }
    },
    [cwd, onOpenChange, onStartThread, parsedNumber, resolvedIssue],
  );

  const validationMessage = !referenceDirty
    ? null
    : reference.trim().length === 0
      ? "Paste a GitHub issue URL or enter 123 / #123."
      : parsedReference === null
        ? "Use a GitHub issue URL, 123, or #123."
        : null;
  const errorMessage =
    validationMessage ??
    (resolvedIssue === null && resolveIssueQuery.isError
      ? resolveIssueQuery.error instanceof Error
        ? resolveIssueQuery.error.message
        : "Failed to resolve issue."
      : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!startingMode) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogPopup className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Start Thread from Issue</DialogTitle>
          <DialogDescription>
            Resolve a GitHub issue, then create a new coding thread with its context pre-loaded for
            the AI agent.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-foreground">Issue</span>
            <Input
              ref={referenceInputRef}
              placeholder="https://github.com/owner/repo/issues/42, #42, or 42"
              value={reference}
              onChange={(event) => {
                setReferenceDirty(true);
                setReference(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                if (!isResolving && !startingMode) {
                  void handleConfirm("local");
                }
              }}
            />
          </label>

          {resolvedIssue ? (
            <div className="rounded-xl border border-border/70 bg-muted/24 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">{resolvedIssue.title}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    #{resolvedIssue.number}
                    {resolvedIssue.author ? ` · ${resolvedIssue.author.login}` : ""}
                    {resolvedIssue.commentsCount > 0
                      ? ` · ${resolvedIssue.commentsCount} comment${resolvedIssue.commentsCount !== 1 ? "s" : ""}`
                      : ""}
                  </p>
                </div>
                <span className={cn("shrink-0 text-xs capitalize", statusTone)}>
                  {resolvedIssue.state}
                </span>
              </div>
              {resolvedIssue.labels.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {resolvedIssue.labels.map((label) => (
                    <span
                      key={label.name}
                      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ring-border/50 bg-muted/40 text-muted-foreground"
                    >
                      {label.color ? (
                        <span
                          className="mr-1 inline-block size-2 rounded-full"
                          style={{ backgroundColor: `#${label.color}` }}
                        />
                      ) : null}
                      {label.name}
                    </span>
                  ))}
                </div>
              ) : null}
              {resolvedIssue.body ? (
                <p className="text-muted-foreground text-xs line-clamp-3 whitespace-pre-line">
                  {resolvedIssue.body.slice(0, 300)}
                  {resolvedIssue.body.length > 300 ? "..." : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {isResolving ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Spinner className="size-3.5" />
              Resolving issue...
            </div>
          ) : null}

          {errorMessage ? <p className="text-destructive text-xs">{errorMessage}</p> : null}
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={!!startingMode}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void handleConfirm("local");
            }}
            disabled={!cwd || !resolvedIssue || isResolving || !!startingMode}
          >
            {startingMode === "local" ? "Starting..." : "Start Thread"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void handleConfirm("worktree");
            }}
            disabled={!cwd || !resolvedIssue || isResolving || !!startingMode}
          >
            {startingMode === "worktree" ? "Starting in worktree..." : "Start in Worktree"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
