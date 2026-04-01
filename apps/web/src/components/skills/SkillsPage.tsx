import type {
  SkillCatalogCategory,
  SkillCatalogAnnotatedEntry,
  SkillEntry,
} from "@okcode/contracts";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpenIcon,
  CheckIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  GithubIcon,
  ImageIcon,
  MoreHorizontalIcon,
  PencilRulerIcon,
  PlayIcon,
  PlusIcon,
  PlugIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { toastManager } from "~/components/ui/toast";
import {
  skillCatalogQueryOptions,
  skillListQueryOptions,
  skillQueryKeys,
} from "~/lib/skillReactQuery";
import { ensureNativeApi } from "~/nativeApi";
import { openInPreferredEditor } from "~/editorPreferences";
import { CreateSkillDialog } from "./CreateSkillDialog";

const FILTER_OPTIONS: ReadonlyArray<{
  value: "all" | SkillCatalogCategory | "personal";
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "recommended", label: "Recommended" },
  { value: "system", label: "System" },
  { value: "docs", label: "Docs" },
  { value: "personal", label: "Personal" },
] as const;

function skillIcon(icon: string) {
  switch (icon) {
    case "sheet":
      return FileSpreadsheetIcon;
    case "github":
      return GithubIcon;
    case "play":
      return PlayIcon;
    case "image":
      return ImageIcon;
    case "plug":
      return PlugIcon;
    case "pencil":
      return PencilRulerIcon;
    case "book-open":
      return BookOpenIcon;
    default:
      return FileTextIcon;
  }
}

function SectionHeader(props: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="font-semibold text-lg text-foreground">{props.title}</h2>
      <p className="text-sm text-muted-foreground">{props.description}</p>
    </div>
  );
}

function isCatalogSkill(
  skill: SkillCatalogAnnotatedEntry | SkillEntry,
): skill is SkillCatalogAnnotatedEntry {
  return "installed" in skill;
}

function SkillLibraryTabs(props: { current: "skills" | "plugins" }) {
  const navigate = useNavigate();
  return (
    <div className="inline-flex rounded-xl border bg-muted/35 p-1">
      <Button
        variant={props.current === "plugins" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => void navigate({ to: "/plugins" })}
      >
        Plugins
      </Button>
      <Button
        variant={props.current === "skills" ? "secondary" : "ghost"}
        size="sm"
        onClick={() =>
          void navigate({ to: "/skills", search: { create: undefined, name: undefined } })
        }
      >
        Skills
      </Button>
    </div>
  );
}

function SkillDetailDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill: SkillCatalogAnnotatedEntry | SkillEntry | null;
  cwd: string | null;
  onInstallGlobal: (id: SkillCatalogAnnotatedEntry["id"]) => void;
  onInstallProject: (id: SkillCatalogAnnotatedEntry["id"]) => void;
  onDelete: (skill: SkillEntry) => void;
}) {
  if (!props.skill) return null;
  const skill = props.skill;
  const isCatalog = isCatalogSkill(skill);
  const mutable = isCatalog ? !skill.immutable && skill.installed : skill.mutable;
  const pathValue = skill.path;
  const slashName = isCatalog ? skill.name.toLowerCase().replace(/\s+/g, "-") : skill.name;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {("tags" in skill ? skill.tags : []).map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <div className="rounded-xl border bg-muted/35 p-3 text-sm">
            <p className="font-medium text-foreground">Slash commands</p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">/{slashName}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">/skill read {slashName}</p>
          </div>
          {pathValue ? (
            <div className="rounded-xl border bg-muted/35 p-3 text-sm">
              <p className="font-medium text-foreground">Path</p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{pathValue}</p>
            </div>
          ) : null}
        </DialogPanel>
        <DialogFooter>
          {isCatalog && !skill.installed ? (
            <>
              {props.cwd ? (
                <Button variant="outline" onClick={() => props.onInstallProject(skill.id)}>
                  Install to project
                </Button>
              ) : null}
              <Button onClick={() => props.onInstallGlobal(skill.id)}>Install globally</Button>
            </>
          ) : !isCatalog && mutable ? (
            <Button variant="destructive" onClick={() => props.onDelete(skill)}>
              Delete
            </Button>
          ) : null}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function SkillCard(props: {
  title: string;
  description: string;
  tags: readonly string[];
  scopeLabel?: string | undefined;
  icon: string;
  installed: boolean;
  mutable: boolean;
  onPrimaryAction: () => void;
  onOpenDetail: () => void;
  onOpenInEditor?: (() => void) | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const Icon = skillIcon(props.icon);
  return (
    <div
      className="group rounded-2xl border bg-card/80 p-4 transition-colors hover:border-border/90 hover:bg-card"
      role="button"
      tabIndex={0}
      onClick={props.onOpenDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onOpenDetail();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/70 text-foreground">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-semibold text-foreground">{props.title}</h3>
                {props.scopeLabel ? <Badge variant="outline">{props.scopeLabel}</Badge> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{props.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {props.installed ? (
                <div className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <CheckIcon className="size-4" />
                </div>
              ) : (
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    props.onPrimaryAction();
                  }}
                >
                  <PlusIcon className="size-4" />
                </Button>
              )}
              {props.installed && props.mutable ? (
                <Menu>
                  <MenuTrigger
                    className="inline-flex size-8 items-center justify-center rounded-full border bg-background/80"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </MenuTrigger>
                  <MenuPopup align="end">
                    {props.onOpenInEditor ? (
                      <MenuItem
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onOpenInEditor?.();
                        }}
                      >
                        Open in editor
                      </MenuItem>
                    ) : null}
                    {props.onDelete ? (
                      <MenuItem
                        variant="destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          props.onDelete?.();
                        }}
                      >
                        Remove
                      </MenuItem>
                    ) : null}
                  </MenuPopup>
                </Menu>
              ) : null}
            </div>
          </div>
          {props.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {props.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SkillsPage(props: {
  cwd: string | null;
  initialCreateOpen?: boolean | undefined;
  initialName?: string | undefined;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useState("");
  const [filter, setFilter] = useState<"all" | SkillCatalogCategory | "personal">("all");
  const [createOpen, setCreateOpen] = useState(Boolean(props.initialCreateOpen));
  const [prefillName, setPrefillName] = useState(props.initialName ?? "");
  const [detailSkill, setDetailSkill] = useState<SkillCatalogAnnotatedEntry | SkillEntry | null>(
    null,
  );

  useEffect(() => {
    setCreateOpen(Boolean(props.initialCreateOpen));
    setPrefillName(props.initialName ?? "");
  }, [props.initialCreateOpen, props.initialName]);

  const catalogQuery = useQuery(skillCatalogQueryOptions({ cwd: props.cwd }));
  const installedSkillsQuery = useQuery(skillListQueryOptions({ cwd: props.cwd }));

  const installMutation = useMutation({
    mutationFn: async (input: {
      id: SkillCatalogAnnotatedEntry["id"];
      scope: "global" | "project";
    }) => {
      const api = ensureNativeApi();
      const result = await api.skills.install({
        id: input.id,
        scope: input.scope,
        cwd: input.scope === "project" ? (props.cwd ?? undefined) : undefined,
      });
      try {
        await openInPreferredEditor(api, result.path);
      } catch {
        // Best effort.
      }
      return result;
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });
      toastManager.add({
        type: "success",
        title: `Installed /${result.name}`,
        description: "The skill is now active and available from slash commands.",
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Unable to install skill",
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (input: { name: string; scope: "global" | "project" }) => {
      const api = ensureNativeApi();
      return api.skills.uninstall({
        name: input.name,
        scope: input.scope,
        cwd: input.scope === "project" ? (props.cwd ?? undefined) : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });
      toastManager.add({
        type: "success",
        title: "Removed skill",
        description: "The skill is no longer available from slash commands.",
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Unable to remove skill",
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const recommended = useMemo<SkillCatalogAnnotatedEntry[]>(() => {
    return (catalogQuery.data?.skills ?? []).filter((skill) => !skill.system);
  }, [catalogQuery.data?.skills]);
  const systemSkills = useMemo<SkillCatalogAnnotatedEntry[]>(() => {
    return (catalogQuery.data?.skills ?? []).filter((skill) => skill.system);
  }, [catalogQuery.data?.skills]);
  const personal = useMemo<SkillEntry[]>(() => {
    return (installedSkillsQuery.data?.skills ?? []).filter((skill) => !skill.system);
  }, [installedSkillsQuery.data?.skills]);

  const matchesSearch = (name: string, description: string, tags: readonly string[]) => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return true;
    return (
      name.toLowerCase().includes(query) ||
      description.toLowerCase().includes(query) ||
      tags.some((tag) => tag.toLowerCase().includes(query))
    );
  };

  const filteredRecommended = recommended.filter(
    (skill) =>
      (filter === "all" || filter === "recommended" || filter === skill.category) &&
      matchesSearch(skill.name, skill.description, skill.tags),
  );
  const filteredSystem = systemSkills.filter(
    (skill) =>
      (filter === "all" || filter === "system" || filter === skill.category) &&
      matchesSearch(skill.name, skill.description, skill.tags),
  );
  const filteredPersonal = personal.filter(
    (skill) =>
      (filter === "all" || filter === "personal") &&
      matchesSearch(skill.name, skill.description, skill.tags),
  );

  return (
    <SidebarInset>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <SkillLibraryTabs current="skills" />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <h1 className="font-semibold text-4xl tracking-tight text-foreground">
                  Make OK Code work your way
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Install recommended skills, keep system skills ready, and create your own
                  slash-command workflows.
                </p>
              </div>
              <Button
                onClick={() => {
                  setPrefillName("");
                  setCreateOpen(true);
                  void navigate({ to: "/skills", search: { create: undefined, name: undefined } });
                }}
              >
                <SparklesIcon className="size-4" />
                Create
              </Button>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search skills"
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
                <SelectTrigger className="md:w-52">
                  <SelectValue>
                    {FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "All"}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          </div>

          <section className="space-y-4">
            <SectionHeader
              title="Recommended"
              description="Bundled skills you can install when you need them."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredRecommended.map((skill) =>
                (() => {
                  const skillPath = skill.path;
                  const installedScope = skill.installedScope;
                  return (
                    <SkillCard
                      key={skill.id}
                      title={skill.name}
                      description={skill.description}
                      tags={skill.tags}
                      icon={skill.icon}
                      installed={skill.installed}
                      mutable={!skill.immutable}
                      scopeLabel={installedScope ?? undefined}
                      onPrimaryAction={() =>
                        installMutation.mutate({ id: skill.id, scope: "global" })
                      }
                      onOpenDetail={() => setDetailSkill(skill)}
                      {...(skillPath
                        ? {
                            onOpenInEditor: () => {
                              const api = ensureNativeApi();
                              void openInPreferredEditor(api, skillPath);
                            },
                          }
                        : {})}
                      {...(skill.installed && installedScope
                        ? {
                            onDelete: () =>
                              deleteMutation.mutate({
                                name: skill.name.toLowerCase().replace(/\s+/g, "-"),
                                scope: installedScope,
                              }),
                          }
                        : {})}
                    />
                  );
                })(),
              )}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="System"
              description="Always-on built-ins that ship with OK Code."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredSystem.map((skill) =>
                (() => {
                  const skillPath = skill.path;
                  return (
                    <SkillCard
                      key={skill.id}
                      title={skill.name}
                      description={skill.description}
                      tags={skill.tags}
                      icon={skill.icon}
                      installed={skill.installed}
                      mutable={false}
                      scopeLabel={skill.installedScope ?? "global"}
                      onPrimaryAction={() => undefined}
                      onOpenDetail={() => setDetailSkill(skill)}
                      {...(skillPath
                        ? {
                            onOpenInEditor: () => {
                              const api = ensureNativeApi();
                              void openInPreferredEditor(api, skillPath);
                            },
                          }
                        : {})}
                    />
                  );
                })(),
              )}
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader
              title="Personal"
              description="Custom and imported skills that are already installed."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredPersonal.map((skill) => (
                <SkillCard
                  key={`${skill.scope}:${skill.name}`}
                  title={skill.name}
                  description={skill.description}
                  tags={skill.tags}
                  icon={skill.origin === "imported" ? "plug" : "pencil"}
                  installed
                  mutable={skill.mutable}
                  scopeLabel={skill.scope}
                  onPrimaryAction={() => undefined}
                  onOpenDetail={() => setDetailSkill(skill)}
                  onOpenInEditor={() => {
                    const api = ensureNativeApi();
                    void openInPreferredEditor(api, skill.path);
                  }}
                  onDelete={() => deleteMutation.mutate({ name: skill.name, scope: skill.scope })}
                />
              ))}
              {filteredPersonal.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                  No personal skills yet. Use <span className="font-mono">Create</span> or run{" "}
                  <span className="font-mono">/skill create</span>.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <CreateSkillDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            void navigate({ to: "/skills", search: { create: undefined, name: undefined } });
          }
        }}
        cwd={props.cwd}
        initialName={prefillName}
      />
      <SkillDetailDialog
        open={Boolean(detailSkill)}
        onOpenChange={(open) => {
          if (!open) setDetailSkill(null);
        }}
        skill={detailSkill}
        cwd={props.cwd}
        onInstallGlobal={(id) => installMutation.mutate({ id, scope: "global" })}
        onInstallProject={(id) => installMutation.mutate({ id, scope: "project" })}
        onDelete={(skill) => deleteMutation.mutate({ name: skill.name, scope: skill.scope })}
      />
    </SidebarInset>
  );
}
