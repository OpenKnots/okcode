import { memo, useMemo, useState, useId } from "react";
import {
  buildCollapsedProposedPlanPreviewMarkdown,
  buildProposedPlanMarkdownFilename,
  downloadPlanAsTextFile,
  normalizePlanMarkdownForExport,
  proposedPlanTitle,
  stripDisplayedPlanMarkdown,
} from "../../proposedPlan";
import { extractPlanChecklistItems } from "../../planChecklist";
import ChatMarkdown from "../ChatMarkdown";
import PlanChecklist from "../PlanChecklist";
import { ChevronDownIcon, ChevronRightIcon, EllipsisIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { toastManager } from "../ui/toast";
import { readNativeApi } from "~/nativeApi";

export const ProposedPlanCard = memo(function ProposedPlanCard({
  planMarkdown,
  cwd,
  workspaceRoot,
}: {
  planMarkdown: string;
  cwd: string | undefined;
  workspaceRoot: string | undefined;
}) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [savePath, setSavePath] = useState("");
  const [isSavingToWorkspace, setIsSavingToWorkspace] = useState(false);
  const [markdownExpanded, setMarkdownExpanded] = useState(false);
  const savePathInputId = useId();
  const title = proposedPlanTitle(planMarkdown) ?? "Proposed plan";
  const displayedPlanMarkdown = stripDisplayedPlanMarkdown(planMarkdown);
  const downloadFilename = buildProposedPlanMarkdownFilename(planMarkdown);
  const saveContents = normalizePlanMarkdownForExport(planMarkdown);

  // Extract checklist items from the plan markdown.
  const checklistItems = useMemo(() => {
    const extracted = extractPlanChecklistItems(planMarkdown);
    return extracted.map((item) => ({
      text: item.text,
      status: item.completed ? ("completed" as const) : ("pending" as const),
    }));
  }, [planMarkdown]);

  const hasChecklist = checklistItems.length > 0;

  // Build a preview for the markdown section (only used when checklist is present).
  const markdownPreview = useMemo(() => {
    if (!hasChecklist) return null;
    return buildCollapsedProposedPlanPreviewMarkdown(planMarkdown, { maxLines: 6 });
  }, [planMarkdown, hasChecklist]);

  // When no checklist items are found, fall back to the original markdown-only view.
  const lineCount = planMarkdown.split("\n").length;
  const canCollapseMarkdown = planMarkdown.length > 900 || lineCount > 20;

  const handleDownload = () => {
    downloadPlanAsTextFile(downloadFilename, saveContents);
  };

  const openSaveDialog = () => {
    if (!workspaceRoot) {
      toastManager.add({
        type: "error",
        title: "Workspace path is unavailable",
        description: "This thread does not have a workspace path to save into.",
      });
      return;
    }
    setSavePath((existing) => (existing.length > 0 ? existing : downloadFilename));
    setIsSaveDialogOpen(true);
  };

  const handleSaveToWorkspace = () => {
    const api = readNativeApi();
    const relativePath = savePath.trim();
    if (!api || !workspaceRoot) {
      return;
    }
    if (!relativePath) {
      toastManager.add({
        type: "warning",
        title: "Enter a workspace path",
      });
      return;
    }

    setIsSavingToWorkspace(true);
    void api.projects
      .writeFile({
        cwd: workspaceRoot,
        relativePath,
        contents: saveContents,
      })
      .then((result) => {
        setIsSaveDialogOpen(false);
        toastManager.add({
          type: "success",
          title: "Plan saved to workspace",
          description: result.relativePath,
        });
      })
      .catch((error) => {
        toastManager.add({
          type: "error",
          title: "Could not save plan",
          description: error instanceof Error ? error.message : "An error occurred while saving.",
        });
      })
      .then(
        () => {
          setIsSavingToWorkspace(false);
        },
        () => {
          setIsSavingToWorkspace(false);
        },
      );
  };

  return (
    <div className="rounded-[24px] border border-border/80 bg-card/70 p-4 sm:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary">Plan</Badge>
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
        </div>
        <Menu>
          <MenuTrigger
            render={<Button aria-label="Plan actions" size="icon-xs" variant="outline" />}
          >
            <EllipsisIcon aria-hidden="true" className="size-4" />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={handleDownload}>Download as markdown</MenuItem>
            <MenuItem onClick={openSaveDialog} disabled={!workspaceRoot || isSavingToWorkspace}>
              Save to workspace
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>

      {/* Content: checklist-first when items are available, markdown-only otherwise */}
      {hasChecklist ? (
        <div className="mt-4 space-y-3">
          {/* Checklist (primary view) */}
          <PlanChecklist items={checklistItems} />

          {/* Collapsible markdown detail */}
          <div className="space-y-2">
            <button
              type="button"
              className="group flex w-full items-center gap-1.5 text-left"
              onClick={() => setMarkdownExpanded((v) => !v)}
            >
              {markdownExpanded ? (
                <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground/40 transition-transform" />
              ) : (
                <ChevronRightIcon className="size-3 shrink-0 text-muted-foreground/40 transition-transform" />
              )}
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/40 uppercase group-hover:text-muted-foreground/60">
                Full Plan
              </span>
            </button>
            {markdownExpanded ? (
              <div className="rounded-lg border border-border/50 bg-background/50 p-3">
                <ChatMarkdown text={displayedPlanMarkdown} cwd={cwd} isStreaming={false} />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* Fallback: original markdown-only view when no checklist items */
        <div className="mt-4">
          <div
            className={cn(
              "relative",
              canCollapseMarkdown && !markdownExpanded && "max-h-104 overflow-hidden",
            )}
          >
            {canCollapseMarkdown && !markdownExpanded ? (
              <ChatMarkdown
                text={markdownPreview ?? displayedPlanMarkdown}
                cwd={cwd}
                isStreaming={false}
              />
            ) : (
              <ChatMarkdown text={displayedPlanMarkdown} cwd={cwd} isStreaming={false} />
            )}
            {canCollapseMarkdown && !markdownExpanded ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-card/95 via-card/80 to-transparent" />
            ) : null}
          </div>
          {canCollapseMarkdown ? (
            <div className="mt-4 flex justify-center">
              <Button
                size="sm"
                variant="outline"
                data-scroll-anchor-ignore
                onClick={() => setMarkdownExpanded((value) => !value)}
              >
                {markdownExpanded ? "Collapse plan" : "Expand plan"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <Dialog
        open={isSaveDialogOpen}
        onOpenChange={(open: boolean) => {
          if (!isSavingToWorkspace) {
            setIsSaveDialogOpen(open);
          }
        }}
      >
        <DialogPopup className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Save plan to workspace</DialogTitle>
            <DialogDescription>
              Enter a path relative to <code>{workspaceRoot ?? "the workspace"}</code>.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-3">
            <label htmlFor={savePathInputId} className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Workspace path</span>
              <Input
                id={savePathInputId}
                value={savePath}
                onChange={(event) => setSavePath(event.target.value)}
                placeholder={downloadFilename}
                spellCheck={false}
                disabled={isSavingToWorkspace}
              />
            </label>
          </DialogPanel>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSaveDialogOpen(false)}
              disabled={isSavingToWorkspace}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleSaveToWorkspace()}
              disabled={isSavingToWorkspace}
            >
              {isSavingToWorkspace ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
});
