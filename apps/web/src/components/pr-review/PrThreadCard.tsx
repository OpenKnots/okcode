import type { PrReviewParticipant, PrReviewThread } from "@okcode/contracts";
import { useState } from "react";
import { ExternalLinkIcon, MessageSquareIcon } from "lucide-react";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";
import { PrUserHoverCard } from "./PrUserHoverCard";
import { PrCommentBody } from "./PrCommentBody";
import { PrMentionComposer } from "./PrMentionComposer";
import { TEXT_DRAFT_SCHEMA, formatRelativeTime, threadTone } from "./pr-review-utils";

export function PrThreadCard({
  thread,
  project,
  dashboard,
  selectedThreadId,
  onSelectFilePath,
  onSelectThreadId,
  onResolveThread,
  onReplyToThread,
}: {
  thread: PrReviewThread;
  project: { id: string; cwd: string | null };
  dashboard: { pullRequest: { number: number; participants: readonly PrReviewParticipant[] } };
  selectedThreadId: string | null;
  onSelectFilePath: (path: string | null) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onResolveThread: (threadId: string, nextAction: "resolve" | "unresolve") => Promise<void>;
  onReplyToThread: (threadId: string, body: string) => Promise<void>;
}) {
  const replyDraftKey = `okcode:pr-review:reply:${project.id}:${dashboard.pullRequest.number}:${thread.id}`;
  const [replyBody, setReplyBody] = useLocalStorage(replyDraftKey, "", TEXT_DRAFT_SCHEMA);
  const [replyingOpen, setReplyingOpen] = useState(false);
  const isSelected = selectedThreadId === thread.id;

  return (
    <div
      className={cn(
        "rounded-[24px] border px-4 py-4",
        threadTone(thread.state),
        isSelected && "ring-1 ring-amber-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            onSelectThreadId(thread.id);
            if (thread.path) onSelectFilePath(thread.path);
          }}
          type="button"
        >
          <p className="font-medium text-sm">
            {thread.path ?? "General conversation"}
            {thread.line ? ` \u00b7 L${thread.line}` : ""}
          </p>
          <p className="mt-1 text-xs text-current/75">
            {thread.comments.length} comment
            {thread.comments.length === 1 ? "" : "s"} \u00b7 {thread.state}
          </p>
        </button>
        <Button
          onClick={() => {
            void onResolveThread(thread.id, thread.isResolved ? "unresolve" : "resolve");
          }}
          size="xs"
          variant="outline"
        >
          {thread.isResolved ? "Reopen" : "Resolve"}
        </Button>
      </div>
      <div className="mt-4 space-y-4">
        {thread.comments.map((comment) => (
          <div
            className="rounded-2xl border border-border/70 bg-background/90 px-3 py-3"
            key={comment.id}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                {comment.author ? (
                  <PrUserHoverCard cwd={project.cwd} login={comment.author.login}>
                    @{comment.author.login}
                  </PrUserHoverCard>
                ) : (
                  <span className="text-sm font-medium text-foreground">Unknown</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(comment.createdAt)}
                </span>
              </div>
              {comment.url ? (
                <Button
                  onClick={() => {
                    void ensureNativeApi().shell.openExternal(comment.url ?? "");
                  }}
                  size="icon-xs"
                  variant="ghost"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <div className="mt-3">
              <PrCommentBody body={comment.body} cwd={project.cwd} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-3 rounded-2xl border border-border/70 bg-background/92 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Reply
          </p>
          <Button
            onClick={() => setReplyingOpen((current) => !current)}
            size="xs"
            variant="outline"
          >
            {replyingOpen ? "Hide" : "Reply"}
          </Button>
        </div>
        {replyingOpen ? (
          <>
            <PrMentionComposer
              cwd={project.cwd}
              participants={dashboard.pullRequest.participants}
              placeholder="Reply to this conversation"
              value={replyBody}
              onChange={setReplyBody}
            />
            <div className="flex justify-end">
              <Button
                disabled={replyBody.trim().length === 0}
                onClick={() => {
                  void onReplyToThread(thread.id, replyBody.trim()).then(() => {
                    setReplyBody("");
                    setReplyingOpen(false);
                  });
                }}
                size="sm"
              >
                <MessageSquareIcon className="size-3.5" />
                Add reply
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
