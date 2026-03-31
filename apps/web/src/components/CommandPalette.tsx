import { ThreadId } from "@okcode/contracts";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ArrowLeftIcon,
  FolderIcon,
  MessageSquareIcon,
  MoonIcon,
  MonitorIcon,
  PanelLeftIcon,
  PlusIcon,
  SettingsIcon,
  SunIcon,
  GitBranchIcon,
  SearchIcon,
  KeyboardIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { useStore } from "~/store";
import { useCommandPaletteStore } from "~/commandPaletteStore";
import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { useTheme } from "~/hooks/useTheme";
import {
  CommandDialog,
  CommandDialogPopup,
  CommandFooter,
  CommandShortcut,
} from "~/components/ui/command";

// ── Types ───────────────────────────────────────────────────────────

interface PaletteCommand {
  id: string;
  label: string;
  /** Searchable keywords (label is always searched). */
  keywords?: string[];
  icon?: LucideIcon;
  shortcut?: string;
  /** Group header for visual organization. */
  group: string;
  /** Action to perform when selected. */
  onSelect: () => void;
  /** Whether this command is hidden (e.g. conditionally unavailable). */
  hidden?: boolean;
}

// ── Fuzzy match ─────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return true;
  if (t.includes(q)) return true;
  // Simple subsequence match
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function matchScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return 0;
  // Exact prefix match = highest
  if (t.startsWith(q)) return 3;
  // Contains as substring
  if (t.includes(q)) return 2;
  // Subsequence match
  return 1;
}

function commandMatchesQuery(command: PaletteCommand, query: string): boolean {
  if (query.length === 0) return true;
  if (fuzzyMatch(query, command.label)) return true;
  if (command.keywords?.some((kw) => fuzzyMatch(query, kw))) return true;
  if (fuzzyMatch(query, command.group)) return true;
  return false;
}

function commandScore(command: PaletteCommand, query: string): number {
  if (query.length === 0) return 0;
  let best = matchScore(query, command.label);
  if (command.keywords) {
    for (const kw of command.keywords) {
      best = Math.max(best, matchScore(query, kw));
    }
  }
  return best;
}

// ── Command palette component ───────────────────────────────────────

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open);
  const mode = useCommandPaletteStore((s) => s.mode);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) closePalette();
    },
    [closePalette],
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandDialogPopup className="max-h-[min(32rem,80vh)]">
        {mode === "commands" && <CommandsView />}
        {mode === "projects" && <ProjectsView />}
        {mode === "threads" && <ThreadsView />}
      </CommandDialogPopup>
    </CommandDialog>
  );
}

// ── Commands view (default) ─────────────────────────────────────────

function CommandsView() {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const threads = useStore((s) => s.threads);
  const { handleNewThread, activeThread } = useHandleNewThread();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const closePalette = useCommandPaletteStore((s) => s.closePalette);
  const setMode = useCommandPaletteStore((s) => s.setMode);
  const pushMruProject = useCommandPaletteStore((s) => s.pushMruProject);
  const pushMruThread = useCommandPaletteStore((s) => s.pushMruThread);
  const mruThreadIds = useCommandPaletteStore((s) => s.mruThreadIds);
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });

  // Build the command list
  const commands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = [];

    // ── Recent threads (top 3 MRU that aren't the current thread) ──
    const recentThreads = mruThreadIds
      .filter((id) => id !== routeThreadId)
      .slice(0, 3)
      .map((id) => threads.find((t) => t.id === id))
      .filter(Boolean);

    for (const thread of recentThreads) {
      if (!thread) continue;
      const project = projects.find((p) => p.id === thread.projectId);
      cmds.push({
        id: `recent-thread-${thread.id}`,
        label: thread.title || "Untitled thread",
        keywords: [project?.name ?? "", "recent", "thread"],
        icon: MessageSquareIcon,
        group: "Recent",
        onSelect: () => {
          pushMruThread(thread.id);
          if (thread.projectId) pushMruProject(thread.projectId);
          closePalette();
          void navigate({ to: "/$threadId", params: { threadId: thread.id } });
        },
      });
    }

    // ── Navigation ──
    cmds.push({
      id: "nav-projects",
      label: "Switch project...",
      keywords: ["project", "workspace", "folder", "switch"],
      icon: FolderIcon,
      group: "Navigation",
      onSelect: () => setMode("projects"),
    });

    cmds.push({
      id: "nav-threads",
      label: "Go to thread...",
      keywords: ["thread", "conversation", "chat", "search", "find"],
      icon: MessageSquareIcon,
      group: "Navigation",
      onSelect: () => setMode("threads"),
    });

    cmds.push({
      id: "nav-settings",
      label: "Open settings",
      keywords: ["settings", "preferences", "config", "configuration"],
      icon: SettingsIcon,
      shortcut: "⌘,",
      group: "Navigation",
      onSelect: () => {
        closePalette();
        void navigate({ to: "/settings" });
      },
    });

    // ── Project quick-switch (inline, first 5) ──
    for (const project of projects.slice(0, 5)) {
      const projectThreads = threads.filter((t) => t.projectId === project.id);
      const latestThread = projectThreads.toSorted((a, b) =>
        (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt),
      )[0];
      cmds.push({
        id: `project-${project.id}`,
        label: project.name,
        keywords: ["project", "switch", project.cwd],
        icon: FolderIcon,
        group: "Projects",
        onSelect: () => {
          pushMruProject(project.id);
          closePalette();
          if (latestThread) {
            pushMruThread(latestThread.id);
            void navigate({ to: "/$threadId", params: { threadId: latestThread.id } });
          }
        },
      });
    }

    // ── Actions ──
    const currentProjectId = activeThread?.projectId ?? projects[0]?.id;

    cmds.push({
      id: "action-new-thread",
      label: "New thread",
      keywords: ["create", "new", "thread", "chat", "conversation"],
      icon: PlusIcon,
      shortcut: "⌘N",
      group: "Actions",
      hidden: !currentProjectId,
      onSelect: () => {
        if (!currentProjectId) return;
        closePalette();
        void handleNewThread(currentProjectId);
      },
    });

    cmds.push({
      id: "action-new-worktree-thread",
      label: "New worktree thread",
      keywords: ["create", "new", "worktree", "branch", "git", "isolated"],
      icon: GitBranchIcon,
      group: "Actions",
      hidden: !currentProjectId,
      onSelect: () => {
        if (!currentProjectId) return;
        closePalette();
        void handleNewThread(currentProjectId, { envMode: "worktree" });
      },
    });

    // ── Appearance ──
    cmds.push({
      id: "appearance-theme-light",
      label: "Switch to light theme",
      keywords: ["theme", "light", "bright", "day", "appearance"],
      icon: SunIcon,
      group: "Appearance",
      hidden: resolvedTheme === "light" && theme === "light",
      onSelect: () => {
        setTheme("light");
        closePalette();
      },
    });

    cmds.push({
      id: "appearance-theme-dark",
      label: "Switch to dark theme",
      keywords: ["theme", "dark", "night", "appearance"],
      icon: MoonIcon,
      group: "Appearance",
      hidden: resolvedTheme === "dark" && theme === "dark",
      onSelect: () => {
        setTheme("dark");
        closePalette();
      },
    });

    cmds.push({
      id: "appearance-theme-system",
      label: "Use system theme",
      keywords: ["theme", "system", "auto", "os", "appearance"],
      icon: MonitorIcon,
      group: "Appearance",
      hidden: theme === "system",
      onSelect: () => {
        setTheme("system");
        closePalette();
      },
    });

    cmds.push({
      id: "appearance-toggle-sidebar",
      label: "Toggle sidebar",
      keywords: ["sidebar", "panel", "navigation", "show", "hide", "collapse"],
      icon: PanelLeftIcon,
      shortcut: "⌘\\",
      group: "Appearance",
      onSelect: () => {
        closePalette();
        // Dispatch a custom event that the sidebar provider can listen to
        document.dispatchEvent(new CustomEvent("command-palette:toggle-sidebar"));
      },
    });

    // ── Help ──
    cmds.push({
      id: "help-keyboard-shortcuts",
      label: "Keyboard shortcuts",
      keywords: ["keyboard", "shortcuts", "keybindings", "hotkeys", "help"],
      icon: KeyboardIcon,
      shortcut: "⌘/",
      group: "Help",
      onSelect: () => {
        closePalette();
        void navigate({ to: "/settings" });
      },
    });

    return cmds.filter((cmd) => !cmd.hidden);
  }, [
    projects,
    threads,
    activeThread,
    mruThreadIds,
    routeThreadId,
    theme,
    resolvedTheme,
    navigate,
    handleNewThread,
    closePalette,
    setMode,
    setTheme,
    pushMruProject,
    pushMruThread,
  ]);

  // Filter commands by query
  const filtered = useMemo(() => {
    if (query.length === 0) return commands;
    return commands
      .filter((cmd) => commandMatchesQuery(cmd, query))
      .toSorted((a, b) => commandScore(b, query) - commandScore(a, query));
  }, [commands, query]);

  // Group filtered commands
  const grouped = useMemo(() => {
    const groups: { label: string; items: PaletteCommand[] }[] = [];
    const groupMap = new Map<string, PaletteCommand[]>();

    for (const cmd of filtered) {
      let items = groupMap.get(cmd.group);
      if (!items) {
        items = [];
        groupMap.set(cmd.group, items);
        groups.push({ label: cmd.group, items });
      }
      items.push(cmd);
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // Clamp highlighted index
  const clampedIndex = Math.min(highlightedIndex, Math.max(0, flatItems.length - 1));

  const scrollToIndex = useCallback((index: number) => {
    const listEl = listRef.current;
    if (!listEl) return;
    const items = listEl.querySelectorAll("[data-palette-item]");
    const item = items[index] as HTMLElement | undefined;
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(clampedIndex + 1, flatItems.length - 1);
        setHighlightedIndex(next);
        scrollToIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(clampedIndex - 1, 0);
        setHighlightedIndex(next);
        scrollToIndex(next);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[clampedIndex];
        if (item) item.onSelect();
      }
    },
    [clampedIndex, flatItems, scrollToIndex],
  );

  return (
    <div onKeyDown={handleKeyDown}>
      <PaletteInput
        placeholder="Type a command or search..."
        value={query}
        onChange={setQuery}
        onChangeIndex={setHighlightedIndex}
      />
      <PalettePanel>
        <div
          ref={listRef}
          className="not-empty:scroll-py-2 not-empty:p-2 overflow-y-auto max-h-[min(20rem,60vh)]"
        >
          {flatItems.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No matching commands.
            </div>
          )}
          {grouped.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((item) => {
                const itemIndex = flatItems.indexOf(item);
                const isHighlighted = itemIndex === clampedIndex;
                return (
                  <PaletteItem
                    key={item.id}
                    command={item}
                    highlighted={isHighlighted}
                    onSelect={item.onSelect}
                    onHover={() => setHighlightedIndex(itemIndex)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </PalettePanel>
      <CommandFooter>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ↑↓
            </kbd>
            <span>navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              ↵
            </kbd>
            <span>select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
              esc
            </kbd>
            <span>close</span>
          </span>
        </div>
      </CommandFooter>
    </div>
  );
}

// ── Projects view ───────────────────────────────────────────────────

function ProjectsView() {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const threads = useStore((s) => s.threads);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);
  const setMode = useCommandPaletteStore((s) => s.setMode);
  const pushMruProject = useCommandPaletteStore((s) => s.pushMruProject);
  const pushMruThread = useCommandPaletteStore((s) => s.pushMruThread);
  const mruProjectIds = useCommandPaletteStore((s) => s.mruProjectIds);

  // Sort: MRU first, then alphabetical
  const sortedProjects = useMemo(() => {
    const filtered =
      query.length > 0
        ? projects.filter((p) => fuzzyMatch(query, p.name) || fuzzyMatch(query, p.cwd))
        : projects;

    return [...filtered].toSorted((a, b) => {
      const aIndex = mruProjectIds.indexOf(a.id);
      const bIndex = mruProjectIds.indexOf(b.id);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [projects, query, mruProjectIds]);

  const clampedIndex = Math.min(highlightedIndex, Math.max(0, sortedProjects.length - 1));

  const scrollToIndex = useCallback((index: number) => {
    const listEl = listRef.current;
    if (!listEl) return;
    const items = listEl.querySelectorAll("[data-palette-item]");
    (items[index] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, []);

  const selectProject = useCallback(
    (project: (typeof projects)[number]) => {
      pushMruProject(project.id);
      const projectThreads = threads
        .filter((t) => t.projectId === project.id)
        .toSorted((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));
      const latestThread = projectThreads[0];
      closePalette();
      if (latestThread) {
        pushMruThread(latestThread.id);
        void navigate({ to: "/$threadId", params: { threadId: latestThread.id } });
      }
    },
    [threads, navigate, closePalette, pushMruProject, pushMruThread],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(clampedIndex + 1, sortedProjects.length - 1);
        setHighlightedIndex(next);
        scrollToIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(clampedIndex - 1, 0);
        setHighlightedIndex(next);
        scrollToIndex(next);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const project = sortedProjects[clampedIndex];
        if (project) selectProject(project);
      } else if (e.key === "Backspace" && query.length === 0) {
        e.preventDefault();
        setMode("commands");
      }
    },
    [clampedIndex, sortedProjects, selectProject, query, setMode, scrollToIndex],
  );

  return (
    <div onKeyDown={handleKeyDown}>
      <PaletteInput
        placeholder="Search projects..."
        value={query}
        onChange={setQuery}
        onChangeIndex={setHighlightedIndex}
        backLabel="Back"
        onBack={() => setMode("commands")}
      />
      <PalettePanel>
        <div
          ref={listRef}
          className="not-empty:scroll-py-2 not-empty:p-2 overflow-y-auto max-h-[min(20rem,60vh)]"
        >
          {sortedProjects.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No projects found.</div>
          )}
          {sortedProjects.map((project, index) => {
            const isHighlighted = index === clampedIndex;
            const threadCount = threads.filter((t) => t.projectId === project.id).length;
            return (
              <button
                key={project.id}
                type="button"
                data-palette-item
                className={cn(
                  "flex w-full cursor-default select-none items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors",
                  isHighlighted && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectProject(project)}
              >
                <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{project.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{project.cwd}</div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {threadCount} {threadCount === 1 ? "thread" : "threads"}
                </span>
              </button>
            );
          })}
        </div>
      </PalettePanel>
      <PaletteFooterWithBack />
    </div>
  );
}

// ── Threads view ────────────────────────────────────────────────────

function ThreadsView() {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const threads = useStore((s) => s.threads);
  const closePalette = useCommandPaletteStore((s) => s.closePalette);
  const setMode = useCommandPaletteStore((s) => s.setMode);
  const scopedProjectId = useCommandPaletteStore((s) => s.scopedProjectId);
  const pushMruThread = useCommandPaletteStore((s) => s.pushMruThread);
  const pushMruProject = useCommandPaletteStore((s) => s.pushMruProject);
  const mruThreadIds = useCommandPaletteStore((s) => s.mruThreadIds);
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });

  const filteredThreads = useMemo(() => {
    let list = scopedProjectId ? threads.filter((t) => t.projectId === scopedProjectId) : threads;

    if (query.length > 0) {
      list = list.filter((t) => {
        const project = projects.find((p) => p.id === t.projectId);
        return fuzzyMatch(query, t.title || "Untitled") || fuzzyMatch(query, project?.name ?? "");
      });
    }

    // Sort: MRU first, then by updated_at
    return [...list]
      .filter((t) => t.id !== routeThreadId)
      .toSorted((a, b) => {
        const aIndex = mruThreadIds.indexOf(a.id);
        const bIndex = mruThreadIds.indexOf(b.id);
        if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
        if (aIndex >= 0) return -1;
        if (bIndex >= 0) return 1;
        return (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt);
      });
  }, [threads, projects, query, scopedProjectId, mruThreadIds, routeThreadId]);

  const clampedIndex = Math.min(highlightedIndex, Math.max(0, filteredThreads.length - 1));

  const scrollToIndex = useCallback((index: number) => {
    const listEl = listRef.current;
    if (!listEl) return;
    const items = listEl.querySelectorAll("[data-palette-item]");
    (items[index] as HTMLElement | undefined)?.scrollIntoView({ block: "nearest" });
  }, []);

  const selectThread = useCallback(
    (thread: (typeof threads)[number]) => {
      pushMruThread(thread.id);
      if (thread.projectId) pushMruProject(thread.projectId);
      closePalette();
      void navigate({ to: "/$threadId", params: { threadId: thread.id } });
    },
    [navigate, closePalette, pushMruThread, pushMruProject],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(clampedIndex + 1, filteredThreads.length - 1);
        setHighlightedIndex(next);
        scrollToIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(clampedIndex - 1, 0);
        setHighlightedIndex(next);
        scrollToIndex(next);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const thread = filteredThreads[clampedIndex];
        if (thread) selectThread(thread);
      } else if (e.key === "Backspace" && query.length === 0) {
        e.preventDefault();
        setMode("commands");
      }
    },
    [clampedIndex, filteredThreads, selectThread, query, setMode, scrollToIndex],
  );

  const scopedProject = scopedProjectId ? projects.find((p) => p.id === scopedProjectId) : null;

  return (
    <div onKeyDown={handleKeyDown}>
      <PaletteInput
        placeholder={
          scopedProject ? `Search threads in ${scopedProject.name}...` : "Search all threads..."
        }
        value={query}
        onChange={setQuery}
        onChangeIndex={setHighlightedIndex}
        backLabel="Back"
        onBack={() => setMode("commands")}
      />
      <PalettePanel>
        <div
          ref={listRef}
          className="not-empty:scroll-py-2 not-empty:p-2 overflow-y-auto max-h-[min(20rem,60vh)]"
        >
          {filteredThreads.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No threads found.</div>
          )}
          {filteredThreads.map((thread, index) => {
            const isHighlighted = index === clampedIndex;
            const project = projects.find((p) => p.id === thread.projectId);
            return (
              <button
                key={thread.id}
                type="button"
                data-palette-item
                className={cn(
                  "flex w-full cursor-default select-none items-center gap-3 rounded-md px-2 py-2 text-left text-sm outline-none transition-colors",
                  isHighlighted && "bg-accent text-accent-foreground",
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectThread(thread)}
              >
                <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{thread.title || "Untitled thread"}</div>
                  {project && !scopedProjectId && (
                    <div className="truncate text-xs text-muted-foreground">{project.name}</div>
                  )}
                </div>
                {thread.branch && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <GitBranchIcon className="size-3" />
                    <span className="max-w-24 truncate">{thread.branch}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PalettePanel>
      <PaletteFooterWithBack />
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────

function PaletteInput(props: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onChangeIndex: (index: number) => void;
  backLabel?: string;
  onBack?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  const setRef = useCallback((el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) {
      requestAnimationFrame(() => el.focus());
    }
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      {props.onBack && (
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={props.onBack}
        >
          <ArrowLeftIcon className="size-3" />
        </button>
      )}
      <SearchIcon className="size-4 shrink-0 text-muted-foreground/80" />
      <input
        ref={setRef}
        type="text"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        placeholder={props.placeholder}
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
          props.onChangeIndex(0);
        }}
      />
    </div>
  );
}

function PalettePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-px relative min-h-0 rounded-t-xl border border-b-0 bg-popover bg-clip-padding shadow-xs/5 [clip-path:inset(0_1px)] before:pointer-events-none before:absolute before:inset-0 before:rounded-t-[calc(var(--radius-xl)-1px)]">
      {children}
    </div>
  );
}

function PaletteItem(props: {
  command: PaletteCommand;
  highlighted: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const Icon = props.command.icon;
  return (
    <button
      type="button"
      data-palette-item
      className={cn(
        "flex w-full cursor-default select-none items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors",
        props.highlighted && "bg-accent text-accent-foreground",
      )}
      onMouseEnter={props.onHover}
      onClick={props.onSelect}
    >
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{props.command.label}</span>
      {props.command.shortcut && <CommandShortcut>{props.command.shortcut}</CommandShortcut>}
    </button>
  );
}

function PaletteFooterWithBack() {
  return (
    <CommandFooter>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ⌫
          </kbd>
          <span>back</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ↑↓
          </kbd>
          <span>navigate</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ↵
          </kbd>
          <span>select</span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            esc
          </kbd>
          <span>close</span>
        </span>
      </div>
    </CommandFooter>
  );
}
