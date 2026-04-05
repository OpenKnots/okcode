import { DEFAULT_MODEL_BY_PROVIDER, type ServerProviderStatus } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  FolderGit2Icon,
  FolderOpenIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TerminalSquareIcon,
  WorkflowIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useAppSettings } from "../appSettings";
import { APP_BASE_NAME, APP_DISPLAY_NAME } from "../branding";
import { isElectron } from "../env";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { newCommandId, newProjectId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { sortProjectsForSidebar } from "./Sidebar.logic";
import { OkCodeMark } from "./OkCodeMark";
import { ProviderSetupCard } from "./chat/ProviderSetupCard";
import { Button } from "./ui/button";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { toastManager } from "./ui/toast";

const capabilityHighlights = [
  {
    title: "Project-scoped threads",
    description: "Keep work attached to a repo instead of losing context in a global chat.",
    icon: FolderGit2Icon,
  },
  {
    title: "Predictable execution",
    description: "Launch new work in local or worktree mode with the same defaults every time.",
    icon: WorkflowIcon,
  },
  {
    title: "Built for long sessions",
    description: "Reconnect cleanly and keep provider state legible under restarts or failures.",
    icon: ShieldCheckIcon,
  },
] as const;

const commandPreview = [
  "> Open repository",
  "> Start provider session",
  "> Keep thread context attached to the workspace",
] as const;

const shellStatusItems = ["Agent-ready", "Desktop-native", "Workspace-first"] as const;
const heroGraphicNodes = [
  { className: "left-[8%] top-[14%] h-12 w-24", delay: "0ms" },
  { className: "left-[34%] top-[8%] h-16 w-32", delay: "120ms" },
  { className: "right-[12%] top-[18%] h-12 w-28", delay: "220ms" },
  { className: "left-[18%] bottom-[22%] h-14 w-36", delay: "160ms" },
  { className: "left-[50%] bottom-[12%] h-12 w-24", delay: "280ms" },
  { className: "right-[10%] bottom-[24%] h-16 w-32", delay: "340ms" },
] as const;

function formatEnvModeLabel(envMode: "local" | "worktree") {
  return envMode === "worktree" ? "New worktree" : "Local mode";
}

function getProviderLabel(provider: ServerProviderStatus["provider"]) {
  switch (provider) {
    case "claudeAgent":
      return "Claude";
    case "codex":
      return "Codex";
  }
}

function getProviderStatusLabel(provider: ServerProviderStatus) {
  if (!provider.available) {
    return "Unavailable";
  }
  if (provider.status === "ready") {
    return provider.authStatus === "authenticated" ? "Ready" : "Needs sign-in";
  }
  if (provider.status === "warning") {
    return "Needs attention";
  }
  return "Error";
}

function getProviderStatusClasses(provider: ServerProviderStatus) {
  if (!provider.available || provider.status === "error") {
    return "border-red-500/20 bg-red-500/8 text-red-700 dark:text-red-300";
  }
  if (provider.status === "warning" || provider.authStatus !== "authenticated") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function formatRelativeTimeCompact(value: string | undefined) {
  if (!value) {
    return "Just now";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "Just now";
  }
  if (diffMs < hour) {
    return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  }
  if (diffMs < day) {
    return `${Math.max(1, Math.round(diffMs / hour))}h ago`;
  }
  return `${Math.max(1, Math.round(diffMs / day))}d ago`;
}

function getThreadActivityLabel(input: {
  updatedAt: string | undefined;
  sessionStatus: string | null | undefined;
  hasLatestTurn: boolean;
}) {
  if (input.sessionStatus === "running") {
    return "Running";
  }
  if (input.sessionStatus === "connecting") {
    return "Connecting";
  }
  if (input.sessionStatus === "error") {
    return "Needs attention";
  }
  if (input.hasLatestTurn) {
    return "Ready to resume";
  }
  if (input.updatedAt) {
    return "Recently updated";
  }
  return "New thread";
}

export function ChatHomeEmptyState() {
  const navigate = useNavigate();
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const providers = serverConfigQuery.data?.providers ?? [];
  const hasReadyProvider = providers.some((provider) => provider.status === "ready");
  const readyProviders = providers.filter((provider) => provider.status === "ready");
  const { settings: appSettings } = useAppSettings();
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const { handleNewThread } = useHandleNewThread();
  const [isOpeningProject, setIsOpeningProject] = useState(false);
  const { open: sidebarOpen, isMobile: sidebarIsMobile } = useSidebar();

  const latestProject = useMemo(
    () => sortProjectsForSidebar(projects, threads, appSettings.sidebarProjectSortOrder)[0] ?? null,
    [appSettings.sidebarProjectSortOrder, projects, threads],
  );

  const latestProjectThreadCount = useMemo(
    () =>
      latestProject ? threads.filter((thread) => thread.projectId === latestProject.id).length : 0,
    [latestProject, threads],
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
      {!isElectron && (sidebarIsMobile || !sidebarOpen) && (
        <header className="border-b border-border px-3 py-2">
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
        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-8">
          {!hasReadyProvider && providers.length > 0 ? (
            <div className="mx-auto w-full max-w-xl">
              <ProviderSetupCard providers={providers} />
            </div>
          ) : (
            <section className="relative isolate w-full overflow-hidden rounded-[2rem] border border-border/70 bg-card/[0.82] shadow-[0_40px_120px_-60px_hsl(var(--foreground)/0.45)] backdrop-blur-xl">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_36%),radial-gradient(circle_at_bottom_right,hsl(var(--foreground)/0.08),transparent_32%)]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,hsl(var(--border)/0.18)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.18)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(circle_at_center,black,transparent_82%)]"
              />
              <div
                aria-hidden="true"
                className="absolute left-[-8%] top-[-10%] size-[18rem] rounded-full bg-primary/16 blur-3xl motion-safe:animate-pulse"
              />
              <div
                aria-hidden="true"
                className="absolute bottom-[-14%] right-[-6%] size-[20rem] rounded-full bg-foreground/10 blur-3xl motion-safe:animate-pulse [animation-delay:1200ms]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-primary/40 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-[-3%] top-12 hidden select-none text-[10rem] font-semibold tracking-[-0.08em] text-foreground/[0.045] lg:block"
              >
                OK
              </div>

              <div className="relative grid min-h-[640px] lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
                <div className="flex flex-col justify-between px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
                  <div>
                    <div className="mb-6 flex animate-in fade-in-0 slide-in-from-top-2 flex-wrap items-center gap-2 duration-500">
                      {shellStatusItems.map((item, index) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/45 px-3 py-1.5 text-[11px] tracking-[0.18em] text-muted-foreground uppercase backdrop-blur"
                          style={{ animationDelay: `${index * 60}ms` }}
                        >
                          <span className="size-1.5 rounded-full bg-primary/80" />
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="inline-flex animate-in fade-in-0 slide-in-from-top-2 duration-500 items-center gap-3 rounded-full border border-border/70 bg-background/65 px-3 py-2 shadow-sm backdrop-blur">
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/12 text-primary">
                        <OkCodeMark className="size-4.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                          {APP_DISPLAY_NAME}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A fast local workspace for coding agents
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 max-w-3xl animate-in fade-in-0 slide-in-from-bottom-3 duration-700">
                      <p className="text-sm font-medium text-primary/85">
                        Start from context, not from scratch.
                      </p>
                      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.055em] text-foreground sm:text-5xl lg:text-[4.4rem] lg:leading-[0.94]">
                        Launch a premium coding workspace with reliable agent sessions built in.
                      </h1>
                      <p className="mt-5 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                        {APP_BASE_NAME} keeps threads tied to real repositories, preserves provider state,
                        and gives your desktop a calmer control surface for deep, multi-session
                        work.
                      </p>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3 animate-in fade-in-0 slide-in-from-bottom-4 duration-700 [animation-delay:120ms]">
                      <Button size="lg" onClick={() => void startLatestThread()}>
                        <TerminalSquareIcon className="size-4" />
                        {latestProject
                          ? `New thread in ${latestProject.name}`
                          : "Open your first project"}
                        <ArrowRightIcon className="size-4" />
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => void openProjectFolder()}
                        disabled={isOpeningProject}
                      >
                        <FolderOpenIcon className="size-4" />
                        {isOpeningProject ? "Opening..." : "Open folder"}
                      </Button>
                      <Button
                        size="lg"
                        variant="ghost"
                        onClick={() => void navigate({ to: "/settings" })}
                      >
                        <SettingsIcon className="size-4" />
                        Settings
                      </Button>
                    </div>

                    <div className="mt-8 grid animate-in fade-in-0 slide-in-from-bottom-4 gap-3 duration-700 [animation-delay:180ms] sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1.4rem] border border-border/70 bg-background/55 px-4 py-3 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
                        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                          Providers
                        </p>
                        <p className="mt-1 text-lg font-semibold text-foreground">
                          {providers.length > 0
                            ? `${readyProviders.length}/${providers.length}`
                            : "0/0"}
                        </p>
                      </div>
                      <div className="rounded-[1.4rem] border border-border/70 bg-background/55 px-4 py-3 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
                        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                          Projects
                        </p>
                        <p className="mt-1 text-lg font-semibold text-foreground">
                          {projects.length}
                        </p>
                      </div>
                      <div className="rounded-[1.4rem] border border-border/70 bg-background/55 px-4 py-3 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
                        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                          Threads
                        </p>
                        <p className="mt-1 text-lg font-semibold text-foreground">
                          {threads.length}
                        </p>
                      </div>
                      <div className="rounded-[1.4rem] border border-border/70 bg-background/55 px-4 py-3 backdrop-blur shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
                        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                          New thread mode
                        </p>
                        <p className="mt-1 text-lg font-semibold text-foreground">
                          {formatEnvModeLabel(appSettings.defaultThreadEnvMode)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 max-w-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700 [animation-delay:240ms]">
                      <div className="grid overflow-hidden rounded-[1.75rem] border border-border/70 bg-[linear-gradient(180deg,hsl(var(--background)/0.96),hsl(var(--background)/0.7))] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05),0_28px_70px_-40px_hsl(var(--foreground)/0.55)] sm:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
                        <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-red-400/80" />
                            <span className="size-2 rounded-full bg-amber-400/80" />
                            <span className="size-2 rounded-full bg-emerald-400/80" />
                            <span className="ml-2 text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                              Session flow
                            </span>
                          </div>
                          <div className="mt-4 space-y-3 font-mono text-[12px] text-foreground/85">
                            {commandPreview.map((line, index) => (
                              <div
                                key={line}
                                className="animate-in fade-in-0 slide-in-from-left-2 duration-700"
                                style={{ animationDelay: `${320 + index * 110}ms` }}
                              >
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden bg-[linear-gradient(180deg,hsl(var(--primary)/0.12),transparent)] p-4">
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_62%)]"
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-4 rounded-[1.5rem] border border-white/6"
                          />
                          <div aria-hidden="true" className="absolute inset-0">
                            <div className="absolute left-1/2 top-1/2 h-[68%] w-px -translate-x-1/2 -translate-y-1/2 bg-linear-to-b from-transparent via-primary/45 to-transparent" />
                            <div className="absolute left-1/2 top-1/2 h-px w-[72%] -translate-x-1/2 -translate-y-1/2 bg-linear-to-r from-transparent via-primary/35 to-transparent" />
                            {heroGraphicNodes.map((node) => (
                              <div
                                key={`${node.className}-${node.delay}`}
                                className={`absolute rounded-2xl border border-primary/20 bg-background/70 shadow-[0_16px_40px_-28px_hsl(var(--foreground)/0.85)] backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-700 ${node.className}`}
                                style={{ animationDelay: node.delay }}
                              />
                            ))}
                            <div className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-primary/25 bg-background/85 text-primary shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.95)]">
                              <OkCodeMark className="size-5" />
                            </div>
                          </div>
                          <div className="relative">
                            <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                              Current default
                            </p>
                            <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                              {formatEnvModeLabel(appSettings.defaultThreadEnvMode)}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              Designed to open work with context already attached instead of asking
                              you to reorient each time.
                            </p>
                          </div>
                          <div className="relative mt-5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex size-6 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                              <TerminalSquareIcon className="size-3.5" />
                            </span>
                            Ready for focused desktop sessions
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 grid animate-in fade-in-0 slide-in-from-bottom-4 gap-4 border-t border-border/70 pt-6 duration-700 [animation-delay:300ms] sm:grid-cols-3">
                    {capabilityHighlights.map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.title} className="min-w-0">
                          <div className="flex items-center gap-2 text-foreground">
                            <Icon className="size-4 text-primary/85" />
                            <p className="text-sm font-medium">{item.title}</p>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <aside className="relative border-t border-border/70 bg-background/35 px-6 py-8 backdrop-blur sm:px-8 lg:border-t-0 lg:border-l lg:px-10 lg:py-12">
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-8 top-0 h-20 bg-linear-to-b from-primary/10 to-transparent blur-2xl"
                  />
                  <div className="flex animate-in fade-in-0 slide-in-from-right-3 items-center gap-2 text-sm font-medium text-foreground duration-700 [animation-delay:140ms]">
                    <SparklesIcon className="size-4 text-primary/85" />
                    Workspace overview
                  </div>

                  <div className="mt-6 space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-700 [animation-delay:220ms]">
                    <div className="space-y-3 rounded-[1.7rem] border border-border/70 bg-background/50 p-5 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.05)]">
                      <div>
                        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                          Latest project
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                          {latestProject ? latestProject.name : "No project selected"}
                        </p>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {latestProject
                          ? "Resume quickly in the most recently active workspace or open a different folder."
                          : "Open a repository to create a project-scoped thread and start working with full context."}
                      </p>
                      <div className="rounded-[1.35rem] border border-border/70 bg-background/60 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-muted-foreground">
                            Threads in project
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {latestProject ? latestProjectThreadCount : 0}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-muted-foreground">
                            Workspace root
                          </span>
                          <span className="max-w-[220px] truncate text-right font-mono text-[11px] text-foreground/80">
                            {latestProject ? latestProject.cwd : "Choose a folder to begin"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                          {latestProject ? "Ready to resume" : "Awaiting repository"}
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                          Desktop workspace
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/70 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                            Provider status
                          </p>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Keep both engines visible so handoff and recovery stay predictable.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
                          <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                          {readyProviders.length} ready
                        </span>
                      </div>

                      <div className="space-y-3">
                        {providers.length > 0 ? (
                          providers.map((provider) => (
                            <div
                              key={provider.provider}
                              className="flex items-start justify-between gap-3 rounded-[1.35rem] border border-border/70 bg-background/55 p-4 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`size-2 rounded-full ${
                                      provider.status === "ready"
                                        ? "bg-emerald-400"
                                        : provider.status === "warning"
                                          ? "bg-amber-400"
                                          : "bg-red-400"
                                    }`}
                                  />
                                  <p className="text-sm font-medium text-foreground">
                                    {getProviderLabel(provider.provider)}
                                  </p>
                                </div>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  {provider.message ??
                                    (provider.available
                                      ? "Available for new sessions."
                                      : "Install or configure this provider in Settings.")}
                                </p>
                              </div>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${getProviderStatusClasses(provider)}`}
                              >
                                {getProviderStatusLabel(provider)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-border/70 bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
                            Provider status will appear here after the app finishes loading
                            configuration.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/70 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                          Recent activity
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => void startLatestThread()}>
                          Open recent thread
                        </Button>
                      </div>

                      <div className="grid gap-3">
                        {recentThreads.length > 0 ? (
                          recentThreads.map((thread) => (
                            <div
                              key={thread.id}
                              className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-border/70 bg-background/55 px-4 py-3 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {thread.title}
                                </p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {thread.projectName} · {thread.statusLabel}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {thread.updatedLabel}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[1.35rem] border border-border/70 bg-background/55 p-4 text-sm leading-6 text-muted-foreground">
                            Recent threads will appear here after you start working in a project.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-border/70 pt-6">
                      <p className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
                        Recommended flow
                      </p>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex gap-3">
                          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60 text-xs font-semibold text-foreground">
                            1
                          </span>
                          <p>Open the repository you want to work in.</p>
                        </div>
                        <div className="flex gap-3">
                          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60 text-xs font-semibold text-foreground">
                            2
                          </span>
                          <p>
                            Start a thread using your default{" "}
                            {formatEnvModeLabel(appSettings.defaultThreadEnvMode).toLowerCase()}{" "}
                            setup.
                          </p>
                        </div>
                        <div className="flex gap-3">
                          <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60 text-xs font-semibold text-foreground">
                            3
                          </span>
                          <p>
                            Adjust provider installs, models, and editor integrations from Settings
                            when needed.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
