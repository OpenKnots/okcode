import { createFileRoute } from "@tanstack/react-router";
import { GitPullRequestIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PrReviewShell } from "~/components/pr-review/PrReviewShell";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import type { Project } from "~/types";
import { isElectron } from "~/env";

function useProjects(): Project[] {
  return useStore((store) => store.projects);
}

function PrReviewRouteView() {
  const projects = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId((current) =>
      current && projects.some((project) => project.id === current) ? current : projects[0]!.id,
    );
  }, [projects]);

  const selectedProject =
    (selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : null) ??
    null;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron ? (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <GitPullRequestIcon className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">PR Review</span>
            </div>
          </header>
        ) : (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <div className="flex items-center gap-2">
              <GitPullRequestIcon className="size-3.5 text-muted-foreground/70" />
              <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
                PR Review
              </span>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedProject ? (
            <PrReviewShell
              onProjectChange={setSelectedProjectId}
              project={selectedProject}
              projects={projects}
              selectedProjectId={selectedProjectId}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <div className={cn("space-y-2 text-center")}>
                <GitPullRequestIcon className="mx-auto size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Open a project to review pull requests.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/pr-review")({
  component: PrReviewRouteView,
});
