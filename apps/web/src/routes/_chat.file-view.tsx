import { createFileRoute } from "@tanstack/react-router";
import { FileCodeIcon } from "lucide-react";

import { FileViewShell } from "~/components/file-view/FileViewShell";
import { ProjectSubpageShell } from "~/components/review/ProjectSubpageShell";

export interface FileViewSearch {
  cwd?: string;
  path?: string;
}

function FileViewRouteView() {
  const { cwd, path } = Route.useSearch();

  return (
    <ProjectSubpageShell
      emptyMessage="Open a file to view it here."
      icon={FileCodeIcon}
      title="File View"
    >
      {({ project }) => (
        <FileViewShell initialCwd={cwd ?? project.cwd} initialPath={path ?? null} />
      )}
    </ProjectSubpageShell>
  );
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
  component: FileViewRouteView,
});
