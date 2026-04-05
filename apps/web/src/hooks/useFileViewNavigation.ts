import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { useCodeViewerStore } from "~/codeViewerStore";
import { useStore } from "~/store";

/**
 * Opens a file in the code-viewer side panel of the active thread.
 * If the caller is not on a thread page, navigates to the most recent thread first.
 */
export function useFileViewNavigation() {
  const navigate = useNavigate();
  const openFile = useCodeViewerStore((s) => s.openFile);
  const threadId = useParams({
    strict: false,
    select: (params) => (params as Record<string, string | undefined>).threadId ?? null,
  });
  const threads = useStore((s) => s.threads);

  return useCallback(
    (cwd: string, relativePath: string) => {
      openFile(cwd, relativePath);
      // If not already on a thread page, navigate to the most recent thread
      // so the code-viewer inline sidebar is visible.
      if (!threadId) {
        const sorted = threads.toSorted((a, b) =>
          (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
        );
        const latest = sorted[0];
        if (latest) {
          void navigate({ to: "/$threadId", params: { threadId: latest.id } });
        } else {
          void navigate({ to: "/" });
        }
      }
    },
    [navigate, openFile, threadId, threads],
  );
}
