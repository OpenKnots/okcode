import { createFileRoute } from "@tanstack/react-router";
import { BookOpenIcon } from "lucide-react";

import { SmeChatShell } from "~/components/sme/SmeChatShell";
import { ProjectSubpageShell } from "~/components/review/ProjectSubpageShell";

function SmeChatRouteView() {
  return (
    <ProjectSubpageShell
      emptyMessage="Open a project to start chatting with a subject matter expert."
      icon={BookOpenIcon}
      title="SME Chat"
    >
      {({ onProjectChange, project, projects, selectedProjectId }) => (
        <SmeChatShell
          onProjectChange={onProjectChange}
          project={project}
          projects={projects}
          selectedProjectId={selectedProjectId}
        />
      )}
    </ProjectSubpageShell>
  );
}

export const Route = createFileRoute("/_chat/sme-chat")({
  component: SmeChatRouteView,
});
