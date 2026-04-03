import type { ProjectId } from "@okcode/contracts";
import { useCallback, useRef, useState } from "react";

import { newCommandId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { toastManager } from "~/components/ui/toast";

interface ProjectTitleEditorSession {
  projectId: ProjectId;
  originalTitle: string;
  draftTitle: string;
}

export interface StartProjectTitleEditInput {
  projectId: ProjectId;
  title: string;
}

export function useProjectTitleEditor() {
  const [session, setSession] = useState<ProjectTitleEditorSession | null>(null);
  const sessionRef = useRef<ProjectTitleEditorSession | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const setEditingSession = useCallback((nextSession: ProjectTitleEditorSession | null) => {
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
    (input: StartProjectTitleEditInput) => {
      setEditingSession({
        projectId: input.projectId,
        originalTitle: input.title,
        draftTitle: input.title,
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
      toastManager.add({ type: "warning", title: "Project name cannot be empty" });
      cancelEditing();
      return;
    }
    if (trimmedTitle === currentSession.originalTitle) {
      cancelEditing();
      return;
    }

    try {
      const api = readNativeApi();
      if (!api) {
        cancelEditing();
        return;
      }
      await api.orchestration.dispatchCommand({
        type: "project.meta.update",
        commandId: newCommandId(),
        projectId: currentSession.projectId,
        title: trimmedTitle,
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to rename project",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    }

    cancelEditing();
  }, [cancelEditing]);

  return {
    editingProjectId: session?.projectId ?? null,
    draftProjectTitle: session?.draftTitle ?? "",
    bindProjectInputRef: bindInputRef,
    cancelProjectEditing: cancelEditing,
    commitProjectEditing: commitEditing,
    setDraftProjectTitle: setDraftTitle,
    startProjectEditing: startEditing,
  };
}
