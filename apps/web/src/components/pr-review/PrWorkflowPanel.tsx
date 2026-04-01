import type { PrReviewConfig, PrConflictAnalysis } from "@okcode/contracts";
import {
  AlertTriangleIcon,
  BookOpenTextIcon,
  CheckCircle2Icon,
  FileCode2Icon,
  SparklesIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { resolveWorkflow } from "./pr-review-utils";

export function PrWorkflowPanel({
  config,
  workflowId,
  onWorkflowIdChange,
  workflowSteps,
  conflicts,
  onRunStep,
  onOpenRules,
  onOpenWorkflow,
}: {
  config: PrReviewConfig | undefined;
  workflowId: string | null;
  onWorkflowIdChange: (workflowId: string) => void;
  workflowSteps: readonly { stepId: string; status: string; detail: string | null }[];
  conflicts: PrConflictAnalysis | undefined;
  onRunStep: (stepId: string, requiresConfirmation: boolean, title: string) => Promise<void>;
  onOpenRules: () => void;
  onOpenWorkflow: (relativePath: string) => void;
}) {
  const workflow = resolveWorkflow(config, workflowId);
  const workflowStepMap = new Map(workflowSteps.map((step) => [step.stepId, step]));
  const isPreviewingNonDefault = workflow?.id !== config?.defaultWorkflowId;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Repo workflow
            </p>
            <h3 className="mt-1 font-semibold text-sm text-foreground">
              {config?.source === "default" ? "Using default repo workflow" : "Loaded from .okcode"}
            </h3>
          </div>
          <Button onClick={onOpenRules} size="xs" variant="outline">
            <BookOpenTextIcon className="size-3.5" />
            Review rules
          </Button>
        </div>
        {config ? (
          <Select value={workflow?.id} onValueChange={(value) => onWorkflowIdChange(String(value))}>
            <SelectTrigger aria-label="Workflow definition" size="sm">
              <SelectValue placeholder="Select workflow" />
            </SelectTrigger>
            <SelectPopup>
              {config.workflows.map((entry) => (
                <SelectItem hideIndicator key={entry.id} value={entry.id}>
                  {entry.title}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        ) : null}
        {workflow ? (
          <div className="rounded-2xl border border-border/70 bg-background/90 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm text-foreground">{workflow.title}</p>
                {workflow.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
                ) : null}
              </div>
              <Button
                onClick={() => onOpenWorkflow(workflow.relativePath)}
                size="xs"
                variant="outline"
              >
                <FileCode2Icon className="size-3.5" />
                Open file
              </Button>
            </div>
            {isPreviewingNonDefault ? (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                The repo default workflow is still the active one. This panel is previewing an
                alternate workflow definition.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {config?.issues.length ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="space-y-1 text-amber-800 dark:text-amber-200">
              {config.issues.map((issue) => (
                <p key={`${issue.path}:${issue.message}`}>
                  {issue.path.split("/").pop() ?? issue.path}: {issue.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {workflow ? (
        <div className="space-y-3">
          {workflow.steps.map((step, index) => {
            const resolution = workflowStepMap.get(step.id);
            const status = resolution?.status ?? "todo";
            return (
              <div
                className="rounded-2xl border border-border/70 bg-background/92 px-3 py-3"
                key={step.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-[11px] font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <p className="font-medium text-sm text-foreground">{step.title}</p>
                      <Badge variant={status === "done" ? "secondary" : "outline"}>{status}</Badge>
                    </div>
                    {step.description ? (
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    ) : null}
                    {resolution?.detail ? (
                      <p className="text-xs text-muted-foreground">{resolution.detail}</p>
                    ) : null}
                    {step.kind === "conflictAnalysis" && conflicts ? (
                      <p className="text-xs text-muted-foreground">{conflicts.summary}</p>
                    ) : null}
                    {step.skillSet ? (
                      <p className="text-xs text-muted-foreground">Skill set: {step.skillSet}</p>
                    ) : null}
                  </div>
                  <Button
                    disabled={isPreviewingNonDefault}
                    onClick={() => {
                      void onRunStep(step.id, step.requiresConfirmation, step.title);
                    }}
                    size="xs"
                    variant={status === "done" ? "secondary" : "outline"}
                  >
                    {status === "done" ? (
                      <CheckCircle2Icon className="size-3.5" />
                    ) : (
                      <SparklesIcon className="size-3.5" />
                    )}
                    Run
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {workflow?.body ? (
        <div className="prose prose-sm max-w-none rounded-2xl border border-border/70 bg-background/92 p-4 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{workflow.body}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}
