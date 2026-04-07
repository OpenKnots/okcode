import type { LucideIcon } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import type { Project } from "~/types";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";

interface ProjectSubpageShellProps {
  title: string;
  icon: LucideIcon;
  emptyMessage: string;
  children: (input: {
    project: Project;
    projects: Project[];
    selectedProjectId: string | null;
    onProjectChange: (projectId: string) => void;
  }) => React.ReactNode;
}

export function ProjectSubpageShell({
  title,
  icon: Icon,
  emptyMessage,
  children,
}: ProjectSubpageShellProps) {
  const projects = useStore((store) => store.projects);
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
              <SidebarTrigger className="size-7 shrink-0" />
              <Icon className="size-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{title}</span>
            </div>
          </header>
        ) : (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0" />
              <Icon className="size-3.5 text-muted-foreground/70" />
              <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
                {title}
              </span>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedProject ? (
            children({
              project: selectedProject,
              projects,
              selectedProjectId,
              onProjectChange: setSelectedProjectId,
            })
          ) : (
            <div className="flex h-full items-center justify-center px-6">
              <div className={cn("space-y-2 text-center")}>
                <Icon className="mx-auto size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarInset>
  );
}
