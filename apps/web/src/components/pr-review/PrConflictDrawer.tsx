import type { PrConflictAnalysis } from "@okcode/contracts";
import { useEffect, useState } from "react";
import { ShieldCheckIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "~/components/ui/sheet";
import { projectLabel } from "~/components/review/reviewUtils";
import type { Project } from "~/types";

export function PrConflictDrawer({
  open,
  onOpenChange,
  project,
  conflictAnalysis,
  onApplyResolution,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  conflictAnalysis: PrConflictAnalysis | undefined;
  onApplyResolution: (candidateId: string) => Promise<void>;
}) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedCandidateId(conflictAnalysis?.candidates[0]?.id ?? null);
  }, [conflictAnalysis?.candidates, open]);

  const selectedCandidate =
    conflictAnalysis?.candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetPopup className="max-w-[min(1100px,calc(100vw-3rem))]" side="right" variant="inset">
        <SheetHeader>
          <SheetTitle>Conflict resolution</SheetTitle>
          <SheetDescription>
            {conflictAnalysis?.summary ?? "Merge conflict analysis is unavailable."}
          </SheetDescription>
        </SheetHeader>
        <SheetPanel className="grid min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border/70 bg-background/92 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Repo focus
              </p>
              <p className="mt-2 font-medium text-sm text-foreground">{projectLabel(project)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{project.cwd}</p>
            </div>
            {conflictAnalysis?.candidates.length ? (
              conflictAnalysis.candidates.map((candidate) => (
                <button
                  className={cn(
                    "w-full rounded-2xl border px-4 py-4 text-left transition-colors",
                    selectedCandidateId === candidate.id
                      ? "border-amber-500/30 bg-amber-500/8"
                      : "border-border/70 bg-background/90 hover:bg-muted/35",
                  )}
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">{candidate.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{candidate.path}</p>
                    </div>
                    <Badge
                      className={cn(
                        candidate.confidence === "safe"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {candidate.confidence}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{candidate.description}</p>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/18 px-4 py-6 text-sm text-muted-foreground">
                No candidate resolutions were generated. OK Code will only propose deterministic
                resolutions automatically.
              </div>
            )}
          </div>
          <div className="min-h-0 rounded-[24px] border border-border/70 bg-background/94">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4">
              <div>
                <p className="font-medium text-sm text-foreground">
                  {selectedCandidate?.title ?? "No candidate selected"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preview patch before applying any conflict resolution.
                </p>
              </div>
              {selectedCandidate ? (
                <Button
                  onClick={() => {
                    void onApplyResolution(selectedCandidate.id);
                  }}
                  size="sm"
                >
                  <ShieldCheckIcon className="size-3.5" />
                  Apply candidate
                </Button>
              ) : null}
            </div>
            <ScrollArea className="min-h-0 h-full">
              <div className="p-4">
                {selectedCandidate ? (
                  <pre className="overflow-auto whitespace-pre-wrap rounded-2xl border border-border/70 bg-muted/22 p-4 text-xs leading-6 text-foreground/88">
                    {selectedCandidate.previewPatch}
                  </pre>
                ) : (
                  <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                    Select a candidate to preview the patch.
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetPanel>
      </SheetPopup>
    </Sheet>
  );
}
