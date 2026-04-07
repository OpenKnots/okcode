import { DEFAULT_MODEL_BY_PROVIDER } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

import { useAppSettings } from "../../appSettings";
import { APP_DISPLAY_NAME } from "../../branding";
import { isElectron } from "../../env";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { resolveImportedProjectScripts } from "../../lib/projectImport";
import { serverConfigQueryOptions } from "../../lib/serverReactQuery";
import { newCommandId, newProjectId } from "../../lib/utils";
import { readNativeApi } from "../../nativeApi";
import { useStore } from "../../store";
import { CloneRepositoryDialog } from "../CloneRepositoryDialog";
import { sortProjectsForSidebar } from "../Sidebar.logic";
import { ProviderSetupCard } from "../chat/ProviderSetupCard";
import { SidebarTrigger, useSidebar } from "../ui/sidebar";
import { toastManager } from "../ui/toast";
import { HomeActions } from "./HomeActions";
import { HomeGreeting } from "./HomeGreeting";
import { HomeProviderStatus } from "./HomeProviderStatus";
import { HomeQuickStats } from "./HomeQuickStats";
import { HomeRecentThreads } from "./HomeRecentThreads";
import {
  formatEnvModeLabel,
  formatRelativeTimeCompact,
  getThreadActivityLabel,
} from "./home-utils";

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
  const { open: sidebarOpen, isMobile: sidebarIsMobile } = useSidebar();

  const latestProject = useMemo(
    () => sortProjectsForSidebar(projects, threads, appSettings.sidebarProjectSortOrder)[0] ?? null,
    [appSettings.sidebarProjectSortOrder, projects, threads],
  );

  const recentThreads = useMemo(() => {
    const projectsById = new Map(projects.map((project) => [project.id, project] as const));

    return threads
      .toSorted((a, b) => {
        const aTime = Date.parse(a.updatedAt ?? a.createdAt);
        const bTime = Date.parse(b.updatedAt ?? b.createdAt);
        return bTime - aTime;
      })
      .slice(0, 4)
      .map((thread) => ({
        id: thread.id,
        title: thread.title,
        projectName: projectsById.get(thread.projectId)?.name ?? "Unknown project",
        updatedLabel: formatRelativeTimeCompact(thread.updatedAt ?? thread.createdAt),
        statusLabel: getThreadActivityLabel({
          updatedAt: thread.updatedAt,
          sessionStatus: thread.session?.status ?? null,
          hasLatestTurn: thread.latestTurn !== null,
        }),
      }));
  }, [projects, threads]);

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
      const { scripts: projectScripts, warning: packageScriptWarning } =
        await resolveImportedProjectScripts(api, pickedPath);
      await api.orchestration.dispatchCommand({
        type: "project.create",
        commandId: newCommandId(),
        projectId,
        title,
        workspaceRoot: pickedPath,
        defaultModel: DEFAULT_MODEL_BY_PROVIDER.codex,
        ...(projectScripts ? { scripts: projectScripts } : {}),
        createdAt: new Date().toISOString(),
      });
      if (packageScriptWarning) {
        toastManager.add({
          type: "warning",
          title: "Project actions need a package manager choice",
          description: packageScriptWarning,
        });
      }
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

  const handleCloneComplete = useCallback(
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

      const projectId = newProjectId();
      try {
        const { scripts: projectScripts, warning: packageScriptWarning } =
          await resolveImportedProjectScripts(api, result.path);
        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          title: result.repoName,
          workspaceRoot: result.path,
          defaultModel: DEFAULT_MODEL_BY_PROVIDER.codex,
          ...(projectScripts ? { scripts: projectScripts } : {}),
          createdAt: new Date().toISOString(),
        });
        if (packageScriptWarning) {
          toastManager.add({
            type: "warning",
            title: "Project actions need a package manager choice",
            description: packageScriptWarning,
          });
        }
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
      {!isElectron && (sidebarIsMobile || !sidebarOpen) && (
        <header className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0" />
            <span className="text-sm font-medium text-foreground">Home</span>
          </div>
        </header>
      )}

      {isElectron && (
        <div className="drag-region flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0" />
            <span className="truncate text-xs font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              {APP_DISPLAY_NAME}
            </span>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground/55">Home</span>
        </div>
      )}

      <div className="flex flex-1 items-center overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
          {!hasReadyProvider && providers.length > 0 ? (
            <div className="mx-auto w-full max-w-xl">
              <ProviderSetupCard providers={providers} />
            </div>
          ) : (
            <>
              <HomeGreeting projectName={latestProject?.name ?? null} />

              <HomeActions
                latestProjectName={latestProject?.name ?? null}
                isOpeningProject={isOpeningProject}
                onNewThread={() => void startLatestThread()}
                onOpenFolder={() => void openProjectFolder()}
                onCloneRepo={() => setCloneDialogOpen(true)}
                onSettings={() => void navigate({ to: "/settings" })}
              />

              <CloneRepositoryDialog
                open={cloneDialogOpen}
                onOpenChange={setCloneDialogOpen}
                onCloned={handleCloneComplete}
              />

              <HomeProviderStatus
                providers={providers}
                onSettingsClick={() => void navigate({ to: "/settings" })}
              />

              <HomeRecentThreads
                threads={recentThreads}
                onThreadClick={(id) =>
                  void navigate({ to: "/$threadId", params: { threadId: id } })
                }
              />

              <HomeQuickStats
                projectCount={projects.length}
                threadCount={threads.length}
                envModeLabel={formatEnvModeLabel(appSettings.defaultThreadEnvMode)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
