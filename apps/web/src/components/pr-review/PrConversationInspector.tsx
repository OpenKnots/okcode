import type {
  NativeApi,
  PrConflictAnalysis,
  PrReviewConfig,
  PrReviewThread,
} from "@okcode/contracts";
import { useState } from "react";
import { MessageSquareIcon, ShieldCheckIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import { SectionHeading } from "~/components/review/ReviewChrome";
import { projectLabel } from "~/components/review/reviewUtils";
import type { Project } from "~/types";
import type { InspectorTab } from "./pr-review-utils";
import { PrThreadCard } from "./PrThreadCard";
import { PrWorkflowPanel } from "./PrWorkflowPanel";
import { PrUserHoverCard } from "./PrUserHoverCard";

export function PrConversationInspector({
  project,
  dashboard,
  config,
  conflicts,
  workflowId,
  onWorkflowIdChange,
  selectedFilePath,
  selectedThreadId,
  onSelectFilePath,
  onSelectThreadId,
  onResolveThread,
  onReplyToThread,
  onRunStep,
  onOpenRules,
  onOpenWorkflow,
  onOpenConflictDrawer,
}: {
  project: Project;
  dashboard: Awaited<ReturnType<NativeApi["prReview"]["getDashboard"]>> | null | undefined;
  config: PrReviewConfig | undefined;
  conflicts: PrConflictAnalysis | undefined;
  workflowId: string | null;
  onWorkflowIdChange: (workflowId: string) => void;
  selectedFilePath: string | null;
  selectedThreadId: string | null;
  onSelectFilePath: (path: string | null) => void;
  onSelectThreadId: (threadId: string | null) => void;
  onResolveThread: (threadId: string, nextAction: "resolve" | "unresolve") => Promise<void>;
  onReplyToThread: (threadId: string, body: string) => Promise<void>;
  onRunStep: (stepId: string, requiresConfirmation: boolean, title: string) => Promise<void>;
  onOpenRules: () => void;
  onOpenWorkflow: (relativePath: string) => void;
  onOpenConflictDrawer: () => void;
}) {
  const [tab, setTab] = useState<InspectorTab>("threads");

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center px-5 text-center text-sm text-muted-foreground">
        Select a pull request to inspect conversations, repo rules, and workflow state.
      </div>
    );
  }

  const visibleThreads = selectedFilePath
    ? dashboard.threads.filter((thread) => thread.path === selectedFilePath)
    : dashboard.threads;

  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-background/96">
      <div className="border-b border-border/70 px-4 py-4">
        <SectionHeading
          action={
            <Button onClick={onOpenConflictDrawer} size="xs" variant="outline">
              <ShieldCheckIcon className="size-3.5" />
              Conflicts
            </Button>
          }
          detail={`Repo focus: ${projectLabel(project)}. ${selectedFilePath ? `Filtered to ${selectedFilePath}.` : "Showing all files."}`}
          eyebrow="Inspector"
          title="Conversations and rules"
        />
        <ToggleGroup
          className="mt-4"
          size="xs"
          value={[tab]}
          variant="outline"
          onValueChange={(values) => {
            const nextValue = values[values.length - 1];
            if (nextValue === "threads" || nextValue === "workflow" || nextValue === "people") {
              setTab(nextValue);
            }
          }}
        >
          <Toggle value="threads">
            <MessageSquareIcon className="size-3.5" />
            Threads
          </Toggle>
          <Toggle value="workflow">
            <SparklesIcon className="size-3.5" />
            Workflow
          </Toggle>
          <Toggle value="people">
            <UsersIcon className="size-3.5" />
            People
          </Toggle>
        </ToggleGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4">
          {tab === "threads" ? (
            <>
              {selectedFilePath ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/25 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Filtered to {selectedFilePath}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Only conversations on the focused file are shown here.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      onSelectFilePath(null);
                      onSelectThreadId(null);
                    }}
                    size="xs"
                    variant="outline"
                  >
                    Clear focus
                  </Button>
                </div>
              ) : null}
              {visibleThreads.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/18 px-4 py-6 text-sm text-muted-foreground">
                  No conversations are visible for the current scope.
                </div>
              ) : (
                visibleThreads.map((thread) => (
                  <PrThreadCard
                    dashboard={dashboard}
                    key={thread.id}
                    onReplyToThread={onReplyToThread}
                    onResolveThread={onResolveThread}
                    onSelectFilePath={onSelectFilePath}
                    onSelectThreadId={onSelectThreadId}
                    project={project}
                    selectedThreadId={selectedThreadId}
                    thread={thread}
                  />
                ))
              )}
            </>
          ) : null}

          {tab === "workflow" ? (
            <PrWorkflowPanel
              conflicts={conflicts}
              config={config}
              onOpenRules={onOpenRules}
              onOpenWorkflow={onOpenWorkflow}
              onRunStep={onRunStep}
              onWorkflowIdChange={onWorkflowIdChange}
              workflowId={workflowId}
              workflowSteps={dashboard.workflowSteps}
            />
          ) : null}

          {tab === "people" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Participants
                </p>
                <div className="mt-4 grid gap-3">
                  {dashboard.pullRequest.participants.map((participant) => (
                    <div
                      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/22 px-3 py-3"
                      key={`${participant.user.login}:${participant.role}`}
                    >
                      <img
                        alt={participant.user.login}
                        className="size-10 rounded-full border border-border/70"
                        src={participant.user.avatarUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <PrUserHoverCard cwd={project.cwd} login={participant.user.login}>
                          @{participant.user.login}
                        </PrUserHoverCard>
                        <p className="truncate text-xs text-muted-foreground">{participant.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Repo Rules
                </p>
                <div className="mt-4 space-y-3">
                  {config?.rules.blockingRules.map((rule) => (
                    <div key={rule.id}>
                      <p className="font-medium text-sm text-foreground">{rule.title}</p>
                      {rule.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{rule.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
