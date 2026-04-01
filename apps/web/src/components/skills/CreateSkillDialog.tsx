import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { skillQueryKeys } from "~/lib/skillReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { openInPreferredEditor } from "~/editorPreferences";
import { toastManager } from "~/components/ui/toast";

type SkillTemplateKind = "blank" | "docs-helper" | "automation-helper" | "review-helper";
type SkillScope = "global" | "project";

function validateSkillName(name: string): string | null {
  if (name.length === 0) return "Name is required.";
  if (name.length > 64) return "Name must be 64 characters or fewer.";
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(name)) {
    return "Use lowercase letters, numbers, and hyphens only.";
  }
  return null;
}

export function CreateSkillDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cwd: string | null;
  initialName?: string;
  onCreated?: (name: string) => void;
}) {
  const [name, setName] = useState(props.initialName ?? "");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<SkillScope>(props.cwd ? "project" : "global");
  const [tagsValue, setTagsValue] = useState("");
  const [template, setTemplate] = useState<SkillTemplateKind>("blank");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!props.open) return;
    setName(props.initialName ?? "");
    setDescription("");
    setTagsValue("");
    setTemplate("blank");
    setScope(props.cwd ? "project" : "global");
  }, [props.cwd, props.initialName, props.open]);

  const nameError = useMemo(() => validateSkillName(name.trim()), [name]);
  const resolvedPath = useMemo(() => {
    if (!name.trim())
      return scope === "project" && props.cwd
        ? `${props.cwd}/.claude/skills/<name>/SKILL.md`
        : "~/.okcode/skills/<name>/SKILL.md";
    if (scope === "project" && props.cwd)
      return `${props.cwd}/.claude/skills/${name.trim()}/SKILL.md`;
    return `~/.okcode/skills/${name.trim()}/SKILL.md`;
  }, [name, props.cwd, scope]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const api = ensureNativeApi();
      const result = await api.skills.create({
        name: name.trim(),
        description: description.trim(),
        scope,
        cwd: scope === "project" ? (props.cwd ?? undefined) : undefined,
        tags: tagsValue
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        template,
      });
      try {
        await openInPreferredEditor(api, result.path);
      } catch {
        // Opening an editor is best effort.
      }
      return result;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });
      toastManager.add({
        type: "success",
        title: `Created /${result.name}`,
        description: "The skill scaffold was created and opened in your editor if available.",
      });
      props.onOpenChange(false);
      props.onCreated?.(result.name);
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Unable to create skill",
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>Create Skill</DialogTitle>
          <DialogDescription>
            Scaffold a reusable skill and make it available as a slash command immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={name}
              onChange={(event) => setName(event.target.value.trimStart())}
              placeholder="my-skill"
            />
            <p className="text-xs text-muted-foreground">
              {nameError ?? "Lowercase letters, numbers, and hyphens only."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-description">Description</Label>
            <Input
              id="skill-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explain what this skill helps with"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as SkillScope)}>
                <SelectTrigger>
                  <SelectValue>{scope === "project" ? "Project" : "Global"}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="project" disabled={!props.cwd}>
                    Project
                  </SelectItem>
                  <SelectItem value="global">Global</SelectItem>
                </SelectPopup>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={template}
                onValueChange={(value) => setTemplate(value as SkillTemplateKind)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {template === "blank"
                      ? "Blank skill"
                      : template === "docs-helper"
                        ? "Docs helper"
                        : template === "automation-helper"
                          ? "Automation helper"
                          : "Review helper"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="blank">Blank skill</SelectItem>
                  <SelectItem value="docs-helper">Docs helper</SelectItem>
                  <SelectItem value="automation-helper">Automation helper</SelectItem>
                  <SelectItem value="review-helper">Review helper</SelectItem>
                </SelectPopup>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-tags">Tags</Label>
            <Input
              id="skill-tags"
              value={tagsValue}
              onChange={(event) => setTagsValue(event.target.value)}
              placeholder="docs, automation, review"
            />
          </div>
          <div className="rounded-xl border bg-muted/35 p-3">
            <p className="font-medium text-sm text-foreground">Install path</p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{resolvedPath}</p>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={Boolean(nameError) || !description.trim() || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
