import type { PrWorkflowStepStatus } from "@okcode/contracts";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

interface WorkflowStep {
  stepId: string;
  status: PrWorkflowStepStatus;
  detail: string | null;
}

interface StepDefinition {
  id: string;
  title: string;
  kind: string;
}

function segmentColor(status: PrWorkflowStepStatus): string {
  switch (status) {
    case "done":
      return "bg-emerald-500";
    case "running":
      return "bg-amber-500 animate-pulse";
    case "blocked":
      return "bg-amber-500/60";
    case "todo":
      return "bg-muted-foreground/20";
    case "failed":
      return "bg-rose-500";
    case "skipped":
      return "bg-muted-foreground/10";
  }
}

function formatStatus(status: PrWorkflowStepStatus): string {
  switch (status) {
    case "done":
      return "Done";
    case "running":
      return "Running";
    case "blocked":
      return "Blocked";
    case "todo":
      return "To do";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
  }
}

export function PrWorkflowProgressBar({
  steps,
  stepDefinitions,
  onStepClick,
}: {
  steps: readonly WorkflowStep[];
  stepDefinitions: readonly StepDefinition[];
  onStepClick: (stepId: string) => void;
}) {
  if (stepDefinitions.length < 2) return null;

  const stepMap = new Map(steps.map((step) => [step.stepId, step]));

  return (
    <div className="flex gap-0.5 rounded-full bg-muted/30 p-0.5">
      {stepDefinitions.map((definition) => {
        const resolution = stepMap.get(definition.id);
        const status: PrWorkflowStepStatus = resolution?.status ?? "todo";
        const label = `${definition.title} \u2014 ${formatStatus(status)}`;

        return (
          <Tooltip key={definition.id}>
            <TooltipTrigger
              className={cn(
                "h-1.5 flex-1 cursor-pointer rounded-full transition-colors",
                segmentColor(status),
              )}
              onClick={() => onStepClick(definition.id)}
              render={<button type="button" aria-label={label} />}
            />
            <TooltipPopup side="bottom" sideOffset={6}>
              {label}
            </TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
}
