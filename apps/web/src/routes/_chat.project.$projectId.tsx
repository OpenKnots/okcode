import { ProjectId } from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getModelSelectionModel } from "@okcode/shared/modelSelection";
import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { readNativeApi } from "../nativeApi";
import { useStore } from "../store";
import { useAppSettings } from "../appSettings";
import { getSelectableThreadProviders } from "../lib/providerAvailability";
import { resolveProjectChatModelSelection, findProjectChatThread } from "../lib/projectChat";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { newCommandId, newThreadId } from "../lib/utils";
import { DEFAULT_INTERACTION_MODE, DEFAULT_RUNTIME_MODE } from "../types";
import { SidebarInset } from "../components/ui/sidebar";
import { Button } from "../components/ui/button";
import { ThreadChatSurface } from "./_chat.$threadId";

function ProjectChatRouteView() {
  const navigate = useNavigate();
  const projectId = Route.useParams({
    select: (params) => ProjectId.makeUnsafe(params.projectId),
  });
  const { settings } = useAppSettings();
  const syncServerReadModel = useStore((store) => store.syncServerReadModel);
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const project = useStore(
    (store) => store.projects.find((entry) => entry.id === projectId) ?? null,
  );
  const projectChatThread = useStore((store) => findProjectChatThread(store.threads, projectId));
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const selectableProviders = useMemo(
    () =>
      getSelectableThreadProviders({
        statuses: serverConfigQuery.data?.providers ?? [],
        openclawGatewayUrl: settings.openclawGatewayUrl,
      }),
    [serverConfigQuery.data?.providers, settings.openclawGatewayUrl],
  );
  const [createAttempt, setCreateAttempt] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!threadsHydrated) return;
    if (project) return;
    void navigate({ to: "/", replace: true });
  }, [navigate, project, threadsHydrated]);

  useEffect(() => {
    if (!threadsHydrated || !project || projectChatThread || creating || createError !== null) {
      return;
    }
    const api = readNativeApi();
    if (!api) return;

    let cancelled = false;
    setCreating(true);
    setCreateError(null);

    const modelSelection = resolveProjectChatModelSelection({
      projectDefaultModelSelection: project.defaultModelSelection,
      projectModel: project.model,
      selectableProviders,
    });

    void api.orchestration
      .dispatchCommand({
        type: "thread.create",
        commandId: newCommandId(),
        threadId: newThreadId(),
        kind: "project-chat",
        projectId,
        title: "Project chat",
        model: getModelSelectionModel(modelSelection),
        modelSelection,
        runtimeMode: DEFAULT_RUNTIME_MODE,
        interactionMode: DEFAULT_INTERACTION_MODE,
        branch: null,
        worktreePath: null,
        createdAt: new Date().toISOString(),
      })
      .catch(async (error: unknown) => {
        try {
          const snapshot = await api.orchestration.getSnapshot();
          syncServerReadModel(snapshot);
        } catch {
          // Ignore refresh failures and surface the original create error below.
        }
        if (cancelled) {
          return;
        }
        setCreateError(error instanceof Error ? error.message : "Unable to start project chat.");
      })
      .finally(() => {
        if (!cancelled) {
          setCreating(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    creating,
    createError,
    project,
    project?.defaultModelSelection,
    project?.model,
    projectId,
    projectChatThread,
    selectableProviders,
    syncServerReadModel,
    threadsHydrated,
    createAttempt,
  ]);

  if (projectChatThread) {
    return <ThreadChatSurface threadId={projectChatThread.id} />;
  }

  return (
    <SidebarInset className="relative h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex h-full items-center justify-center">
        <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
          <Loader2Icon
            className={`size-5 text-muted-foreground ${creating ? "animate-spin" : ""}`}
          />
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-foreground">
              {project?.name ?? "Project"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {createError
                ? createError
                : creating
                  ? "Creating the canonical project chat."
                  : "Preparing project chat."}
            </p>
          </div>
          {createError ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setCreateError(null);
                setCreateAttempt((attempt) => attempt + 1);
              }}
            >
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/project/$projectId")({
  component: ProjectChatRouteView,
});
