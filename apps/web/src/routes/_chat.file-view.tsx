import { createFileRoute } from "@tanstack/react-router";
import { FileCodeIcon } from "lucide-react";

import { FileViewShell } from "~/components/file-view/FileViewShell";
import { ProjectSubpageShell } from "~/components/review/ProjectSubpageShell";

interface FileViewSearch {
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
  validateSearch: (search: Record<string, unknown>): FileViewSearch => ({
    cwd: typeof search.cwd === "string" ? search.cwd : undefined,
    path: typeof search.path === "string" ? search.path : undefined,
  }),
  component: FileViewRouteView,
});
