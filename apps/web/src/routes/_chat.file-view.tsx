import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useCodeViewerStore } from "~/codeViewerStore";
import { useStore } from "~/store";

export interface FileViewSearch {
  cwd?: string;
  path?: string;
}

/**
 * Legacy route — the standalone file-view page has been removed.
 * If a file was requested via search params, open it in the code-viewer
 * side panel and redirect to the most recent thread.
 */
function FileViewRouteRedirect() {
  const { cwd, path } = Route.useSearch();
  const openFile = useCodeViewerStore((s) => s.openFile);
  const navigate = useNavigate();
  const threads = useStore((s) => s.threads);

  useEffect(() => {
    // Open the requested file in the side-panel store
    if (cwd && path) {
      openFile(cwd, path);
    }

    // Navigate to the most recent thread (or home)
    const sorted = threads.toSorted((a, b) =>
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
    );
    const latest = sorted[0];
    if (latest) {
      void navigate({ to: "/$threadId", params: { threadId: latest.id }, replace: true });
    } else {
      void navigate({ to: "/", replace: true });
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export const Route = createFileRoute("/_chat/file-view")({
  validateSearch: (search: Record<string, unknown>): FileViewSearch => {
    const validatedSearch: FileViewSearch = {};

    if (typeof search.cwd === "string") {
      validatedSearch.cwd = search.cwd;
    }
    if (typeof search.path === "string") {
      validatedSearch.path = search.path;
    }

    return validatedSearch;
  },
  component: FileViewRouteRedirect,
});
