import type { GitHubUserPreview, PrReviewParticipant } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import {
  prReviewUserPreviewQueryOptions,
  prReviewConfigQueryOptions,
} from "~/lib/prReviewReactQuery";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Textarea } from "~/components/ui/textarea";
import { extractMentionQuery, mergeMentionCandidates } from "./pr-review-utils";

export function PrMentionComposer({
  cwd,
  participants,
  value,
  onChange,
  placeholder,
  disabled = false,
  rows = 4,
  autoFocus = false,
}: {
  cwd: string | null;
  participants: readonly PrReviewParticipant[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  rows?: number;
  autoFocus?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const mentionQueryState = useMemo(
    () => extractMentionQuery(value, selectionStart),
    [selectionStart, value],
  );
  const deferredMentionQuery = useDeferredValue(mentionQueryState?.query ?? "");
  const userSearchQuery = useQuery(
    prReviewUserPreviewQueryOptions({
      cwd: null,
      login: null,
    }),
  );
  void userSearchQuery;
  const searchQuery = useQuery(
    prReviewUserPreviewQueryOptions({
      cwd: null,
      login: null,
    }),
  );
  void searchQuery;
  const remoteSearchQuery = useQuery({
    ...prReviewConfigQueryOptions(null),
    enabled: false,
  });
  void remoteSearchQuery;
  const mentionSearchQuery = useQuery({
    queryKey: ["prReview", "mention-search", cwd, deferredMentionQuery],
    queryFn: async () => {
      if (!cwd || deferredMentionQuery.trim().length === 0) {
        return { users: [] as GitHubUserPreview[] };
      }
      return ensureNativeApi().prReview.searchUsers({
        cwd,
        query: deferredMentionQuery.trim(),
        limit: 8,
      });
    },
    enabled: cwd !== null && deferredMentionQuery.trim().length > 0,
    staleTime: 30_000,
  });

  const suggestions = useMemo(
    () =>
      mergeMentionCandidates(
        participants,
        mentionSearchQuery.data?.users ?? [],
        mentionQueryState?.query ?? "",
      ),
    [mentionQueryState?.query, mentionSearchQuery.data?.users, participants],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [mentionQueryState?.query]);

  const replaceMention = (login: string) => {
    if (!mentionQueryState || !textareaRef.current) return;
    const nextValue =
      value.slice(0, mentionQueryState.from) + `@${login} ` + value.slice(mentionQueryState.to);
    const nextCursor = mentionQueryState.from + login.length + 2;
    onChange(nextValue);
    queueMicrotask(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      setSelectionStart(nextCursor);
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setSelectionStart(event.target.selectionStart);
        }}
        onClick={(event) => setSelectionStart(event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (!mentionQueryState || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            const nextUser = suggestions[activeIndex];
            if (nextUser) replaceMention(nextUser.login);
          }
        }}
        onSelect={(event) => setSelectionStart(event.currentTarget.selectionStart)}
      />
      {mentionQueryState ? (
        <div className="rounded-xl border border-border/70 bg-background/95">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Mention people
            </span>
            {mentionSearchQuery.isFetching ? (
              <LoaderCircleIcon className="size-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No matching collaborators.</p>
          ) : (
            <div className="p-1">
              {suggestions.map((user, index) => (
                <button
                  key={user.login}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/70",
                    index === activeIndex && "bg-muted/70",
                  )}
                  onClick={() => replaceMention(user.login)}
                  type="button"
                >
                  <img
                    alt={user.login}
                    className="size-7 rounded-full border border-border/70"
                    src={user.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {user.name ?? user.login}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">@{user.login}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
