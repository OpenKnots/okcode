import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { useCodeViewerStore } from "~/codeViewerStore";

export function useFileViewNavigation() {
  const navigate = useNavigate();
  const openFile = useCodeViewerStore((s) => s.openFile);

  return useCallback(
    (cwd: string, relativePath: string) => {
      openFile(cwd, relativePath);
      void navigate({
        to: "/file-view",
        search: { cwd, path: relativePath },
      });
    },
    [navigate, openFile],
  );
}
