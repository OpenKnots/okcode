import { createFileRoute } from "@tanstack/react-router";
import { GitMergeIcon } from "lucide-react";

import { MergeConflictShell } from "~/components/merge-conflicts/MergeConflictShell";
import { ProjectSubpageShell } from "~/components/review/ProjectSubpageShell";

function MergeConflictsRouteView() {
  return (
    <ProjectSubpageShell
      emptyMessage="Open a project to resolve merge conflicts."
      icon={GitMergeIcon}
      title="Merge Conflicts"
    >
      {({ onProjectChange, project, projects, selectedProjectId }) => (
        <MergeConflictShell
          onProjectChange={onProjectChange}
          project={project}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />
      )}
    </ProjectSubpageShell>
  );
}

export const Route = createFileRoute("/_chat/merge-conflicts")({
  component: MergeConflictsRouteView,
});
