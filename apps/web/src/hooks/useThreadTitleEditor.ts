import type { ThreadId } from "@okcode/contracts";
import { useCallback, useRef, useState } from "react";

import { newCommandId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { toastManager } from "~/components/ui/toast";

interface ThreadTitleEditorSession {
  threadId: ThreadId;
  originalTitle: string;
  draftTitle: string;
  isDraft: boolean;
}

export interface StartThreadTitleEditInput {
  threadId: ThreadId;
  title: string;
  isDraft?: boolean;
}

export function useThreadTitleEditor(options?: {
  onRenameDraftThread?: (threadId: ThreadId, title: string) => void | Promise<void>;
}) {
  const [session, setSession] = useState<ThreadTitleEditorSession | null>(null);
  const sessionRef = useRef<ThreadTitleEditorSession | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setEditingSession = useCallback((nextSession: ThreadTitleEditorSession | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  const cancelEditing = useCallback(() => {
    inputRef.current = null;
    setEditingSession(null);
  }, [setEditingSession]);

  const bindInputRef = useCallback((node: HTMLInputElement | null) => {
    if (!node) {
      inputRef.current = null;
      return;
    }
    if (inputRef.current === node) {
      return;
    }
    inputRef.current = node;
    node.focus();
    node.select();
  }, []);

  const startEditing = useCallback(
    (input: StartThreadTitleEditInput) => {
      setEditingSession({
        threadId: input.threadId,
        originalTitle: input.title,
        draftTitle: input.title,
        isDraft: input.isDraft === true,
      });
    },
    [setEditingSession],
  );

  const setDraftTitle = useCallback(
    (draftTitle: string) => {
      setEditingSession(
        sessionRef.current
          ? {
              ...sessionRef.current,
              draftTitle,
            }
          : null,
      );
    },
    [setEditingSession],
  );

  const commitEditing = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!currentSession) {
      return;
    }

    const trimmedTitle = currentSession.draftTitle.trim();
    if (trimmedTitle.length === 0) {
      toastManager.add({ type: "warning", title: "Thread title cannot be empty" });
      cancelEditing();
      return;
    }
    if (trimmedTitle === currentSession.originalTitle) {
      cancelEditing();
      return;
    }

    try {
      if (currentSession.isDraft) {
        await options?.onRenameDraftThread?.(currentSession.threadId, trimmedTitle);
      } else {
        const api = readNativeApi();
        if (!api) {
          cancelEditing();
          return;
        }
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: currentSession.threadId,
          title: trimmedTitle,
        });
      }
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to rename thread",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    }

    cancelEditing();
  }, [cancelEditing, options]);

  return {
    editingThreadId: session?.threadId ?? null,
    draftTitle: session?.draftTitle ?? "",
    bindInputRef,
    cancelEditing,
    commitEditing,
    setDraftTitle,
    startEditing,
  };
}
