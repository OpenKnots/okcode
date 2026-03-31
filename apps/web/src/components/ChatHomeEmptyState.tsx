import { DEFAULT_MODEL_BY_PROVIDER } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  FolderOpenIcon,
  FolderIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  SettingsIcon,
  SquarePenIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAppSettings } from "../appSettings";
import { isElectron } from "../env";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { newCommandId, newProjectId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { CloneRepositoryDialog } from "./CloneRepositoryDialog";
import { sortProjectsForSidebar } from "./Sidebar.logic";
import { ProviderSetupCard } from "./chat/ProviderSetupCard";
import { Button } from "./ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import { toastManager } from "./ui/toast";

export function ChatHomeEmptyState() {
  const navigate = useNavigate();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const providers = serverConfigQuery.data?.providers ?? [];
  const hasReadyProvider = providers.some((provider) => provider.status === "ready");
  const { settings: appSettings } = useAppSettings();
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const { handleNewThread } = useHandleNewThread();
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

  const recentProjects = useMemo(
    () =>
      sortProjectsForSidebar(projects, threads, appSettings.sidebarProjectSortOrder).slice(0, 4),
    [appSettings.sidebarProjectSortOrder, projects, threads],
  );

  const latestProject = recentProjects[0] ?? null;
  const threadCountByProjectId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads) {
      counts.set(thread.projectId, (counts.get(thread.projectId) ?? 0) + 1);
    }
    return counts;
  }, [threads]);

  const openProjectFolder = useCallback(async () => {
    const api = readNativeApi();
    if (!api || isOpeningProject) {
      return;
    }

    setIsOpeningProject(true);
    let pickedPath: string | null = null;
    try {
      pickedPath = await api.dialogs.pickFolder();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not open folder picker",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
      setIsOpeningProject(false);
      return;
    }

    if (!pickedPath) {
      setIsOpeningProject(false);
      return;
    }

    const existingProject = projects.find((project) => project.cwd === pickedPath);
    if (existingProject) {
      await handleNewThread(existingProject.id, {
        envMode: appSettings.defaultThreadEnvMode,
      }).catch(() => undefined);
      setIsOpeningProject(false);
      return;
    }

    const title = pickedPath.split(/[/\\]/).findLast((segment) => segment.length > 0) ?? pickedPath;
    try {
      const projectId = newProjectId();
      await api.orchestration.dispatchCommand({
        type: "project.create",
        commandId: newCommandId(),
        projectId,
        title,
        workspaceRoot: pickedPath,
        defaultModel: DEFAULT_MODEL_BY_PROVIDER.codex,
        createdAt: new Date().toISOString(),
      });
      await handleNewThread(projectId, {
        envMode: appSettings.defaultThreadEnvMode,
      }).catch(() => undefined);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to add project",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while adding the project.",
      });
    }

    setIsOpeningProject(false);
  }, [appSettings.defaultThreadEnvMode, handleNewThread, isOpeningProject, projects]);

  const handleCloned = useCallback(
    async (result: { path: string; branch: string; repoName: string }) => {
      const api = readNativeApi();
      if (!api) return;

      const existingProject = projects.find((project) => project.cwd === result.path);
      if (existingProject) {
        await handleNewThread(existingProject.id, {
          envMode: appSettings.defaultThreadEnvMode,
        }).catch(() => undefined);
        return;
      }

      try {
        const projectId = newProjectId();
        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          title: result.repoName,
          workspaceRoot: result.path,
          defaultModel: DEFAULT_MODEL_BY_PROVIDER.codex,
          createdAt: new Date().toISOString(),
        });
        await handleNewThread(projectId, {
          envMode: appSettings.defaultThreadEnvMode,
        }).catch(() => undefined);
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Failed to add project",
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred while adding the project.",
        });
      }
    },
    [appSettings.defaultThreadEnvMode, handleNewThread, projects],
  );

  const startLatestThread = useCallback(async () => {
    if (!latestProject) {
      await openProjectFolder();
      return;
    }

    await handleNewThread(latestProject.id, {
      envMode: appSettings.defaultThreadEnvMode,
    }).catch(() => undefined);
  }, [appSettings.defaultThreadEnvMode, handleNewThread, latestProject, openProjectFolder]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {!isElectron && (
        <header className="border-b border-border px-3 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0" />
            <span className="text-sm font-medium text-foreground">Home</span>
          </div>
        </header>
      )}

      {isElectron && (
        <div className="drag-region flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4 pl-[90px] sm:px-5 sm:pl-[90px]">
          <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            OK Code
          </span>
          <span className="text-[11px] text-muted-foreground/55">Home</span>
        </div>
      )}

      <div className="flex flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-8">
          {!hasReadyProvider && providers.length > 0 ? (
            <div className="mx-auto w-full max-w-xl">
              <ProviderSetupCard providers={providers} />
            </div>
          ) : (
            <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-3xl border border-border/70 bg-card/80 p-5 shadow-sm sm:p-7">
                <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground/60 uppercase">
                  Start here
                </p>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Pick up a project or start a fresh thread.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  Open a project folder, jump back into something recent, or create a new thread
                  without digging through the sidebar first.
                </p>

                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <Button className="justify-start gap-2" onClick={() => void startLatestThread()}>
                    <SquarePenIcon className="size-4" />
                    {latestProject ? `New thread in ${latestProject.name}` : "Open project folder"}
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => void openProjectFolder()}
                    disabled={isOpeningProject}
                  >
                    <FolderOpenIcon className="size-4" />
                    {isOpeningProject ? "Opening…" : "Open project folder"}
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => setCloneDialogOpen(true)}
                  >
                    <GitBranchIcon className="size-4" />
                    Clone from GitHub
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => void navigate({ to: "/pr-review" })}
                  >
                    <GitPullRequestIcon className="size-4" />
                    Review pull requests
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => void navigate({ to: "/merge-conflicts" })}
                  >
                    <GitMergeIcon className="size-4" />
                    Resolve merge conflicts
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start gap-2"
                    onClick={() => void navigate({ to: "/settings" })}
                  >
                    <SettingsIcon className="size-4" />
                    Settings
                  </Button>
                </div>
              </section>

              <aside className="rounded-3xl border border-border/70 bg-card/55 p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Recent projects</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Jump back in without hunting through the sidebar.
                    </p>
                  </div>
                </div>

                {recentProjects.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {recentProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        className="flex w-full items-start gap-3 rounded-2xl border border-transparent bg-background/70 px-3 py-3 text-left transition-colors hover:border-border hover:bg-accent/40"
                        onClick={() =>
                          void handleNewThread(project.id, {
                            envMode: appSettings.defaultThreadEnvMode,
                          })
                        }
                      >
                        <FolderIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {project.name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {project.cwd}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                          {threadCountByProjectId.get(project.id) ?? 0} threads
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background/40 px-4 py-6 text-sm text-muted-foreground">
                    No projects yet. Open your first folder to get started.
                  </div>
                )}
              </aside>
            </div>
          )}
        </div>
      </div>

      <CloneRepositoryDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onCloned={handleCloned}
      />
    </div>
  );
}
