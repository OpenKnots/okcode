import { useEffect, useRef, useState } from "react";
import type { Project } from "~/types";
import { readNativeApi } from "~/nativeApi";

import { normalizeProjectIconPath, resolveSuggestedProjectIconPath } from "~/lib/projectIcons";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { ProjectIcon } from "./ProjectIcon";

export function ProjectIconEditorDialog({
  project,
  open,
  onOpenChange,
  onSave,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (iconPath: string | null) => Promise<void>;
}) {
  const projectId = project?.id ?? null;
  const projectCwd = project?.cwd ?? null;
  const projectIconPath = normalizeProjectIconPath(project?.iconPath);
  const [draft, setDraft] = useState("");
  const [suggestedIconPath, setSuggestedIconPath] = useState<string | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const draftWasTouchedRef = useRef(false);

  useEffect(() => {
    if (!open || !projectId || !projectCwd) {
      setDraft("");
      setSuggestedIconPath(null);
      setIsLoadingSuggestion(false);
      draftWasTouchedRef.current = false;
      return;
    }

    draftWasTouchedRef.current = false;
    setDraft(projectIconPath ?? "");
    setSuggestedIconPath(null);

    if (projectIconPath) {
      setIsLoadingSuggestion(false);
      return;
    }

    const api = readNativeApi();
    if (!api) {
      setIsLoadingSuggestion(false);
      return;
    }

    let cancelled = false;
    setIsLoadingSuggestion(true);
    void resolveSuggestedProjectIconPath(api, projectCwd)
      .then((nextSuggestion) => {
        if (cancelled) return;
        setSuggestedIconPath(nextSuggestion);
        if (!draftWasTouchedRef.current && !projectIconPath && nextSuggestion) {
          setDraft(nextSuggestion);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestedIconPath(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSuggestion(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectCwd, projectIconPath, projectId]);

  const resolvedDraft = normalizeProjectIconPath(draft);
  const currentValue = projectIconPath;
  const canSave = Boolean(project) && resolvedDraft !== currentValue;
  const effectivePreviewIconPath = resolvedDraft ?? suggestedIconPath ?? currentValue ?? null;

  if (!project || !projectId || !projectCwd) {
    return null;
  }

  const commit = async (iconPath: string | null) => {
    await onSave(iconPath);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Project icon</DialogTitle>
          <DialogDescription>
            Set a path relative to the project root or an absolute image URL. Leave it blank to fall
            back to the detected favicon or icon file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-2">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
            <ProjectIcon
              cwd={project.cwd}
              iconPath={effectivePreviewIconPath}
              className="size-10 rounded-md"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{project.name}</div>
              <div className="text-xs text-muted-foreground">
                {isLoadingSuggestion
                  ? "Looking for an icon file..."
                  : suggestedIconPath
                    ? `Suggested: ${suggestedIconPath}`
                    : "No obvious icon file found. Leave blank to use the fallback icon."}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="project-icon-path"
            >
              Icon path
            </label>
            <Input
              id="project-icon-path"
              value={draft}
              onChange={(event) => {
                draftWasTouchedRef.current = true;
                setDraft(event.target.value);
              }}
              placeholder={
                suggestedIconPath ?? "public/favicon.svg or https://example.com/icon.png"
              }
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void commit(null);
            }}
            disabled={!project}
          >
            Use auto-detected
          </Button>
          <div className="ms-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void commit(resolvedDraft);
              }}
              disabled={!project || !canSave}
            >
              Save icon
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
