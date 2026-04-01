import { DEFAULT_MODEL_BY_PROVIDER } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { FolderOpenIcon, SettingsIcon, TerminalSquareIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAppSettings } from "../appSettings";
import { APP_DISPLAY_NAME } from "../branding";
import { isElectron } from "../env";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { newCommandId, newProjectId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { sortProjectsForSidebar } from "./Sidebar.logic";
import { ProviderSetupCard } from "./chat/ProviderSetupCard";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./ui/empty";
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

  const latestProject = useMemo(
    () => sortProjectsForSidebar(projects, threads, appSettings.sidebarProjectSortOrder)[0] ?? null,
    [appSettings.sidebarProjectSortOrder, projects, threads],
  );

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
            {APP_DISPLAY_NAME}
          </span>
          <span className="text-[11px] text-muted-foreground/55">Home</span>
        </div>
      )}

      <div className="flex flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
          {!hasReadyProvider && providers.length > 0 ? (
            <div className="mx-auto w-full max-w-xl">
              <ProviderSetupCard providers={providers} />
            </div>
          ) : (
            <section className="w-full max-w-3xl rounded-[2rem] border border-border/70 bg-card/75 p-4 shadow-sm sm:p-8">
              <Empty className="gap-0 p-6 sm:p-10">
                <EmptyHeader className="max-w-2xl">
                  <EmptyMedia variant="icon">
                    <TerminalSquareIcon className="size-5" />
                  </EmptyMedia>
                  <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                    {APP_DISPLAY_NAME}
                  </div>
                  <EmptyTitle className="mt-6 text-3xl tracking-tight sm:text-5xl">
                    Create Next App placeholder
                  </EmptyTitle>
                  <EmptyDescription className="mt-3 max-w-xl text-sm leading-6 sm:text-base">
                    Get started by editing
                  </EmptyDescription>
                  <div className="mt-4 rounded-full border border-border/70 bg-background px-4 py-2 font-mono text-sm text-foreground">
                    apps/web/src/components/ChatHomeEmptyState.tsx
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Save and refresh to replace this temporary home screen.
                  </p>
                </EmptyHeader>

                <EmptyContent className="mt-8 max-w-none gap-3">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={() => void startLatestThread()}>
                      <TerminalSquareIcon className="size-4" />
                      {latestProject
                        ? `New thread in ${latestProject.name}`
                        : "Open project folder"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void openProjectFolder()}
                      disabled={isOpeningProject}
                    >
                      <FolderOpenIcon className="size-4" />
                      {isOpeningProject ? "Opening..." : "Open folder"}
                    </Button>
                    <Button variant="ghost" onClick={() => void navigate({ to: "/settings" })}>
                      <SettingsIcon className="size-4" />
                      Settings
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {latestProject
                      ? `Latest project: ${latestProject.name}`
                      : "No projects yet. Open your first folder to get started."}
                  </p>
                </EmptyContent>
              </Empty>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
