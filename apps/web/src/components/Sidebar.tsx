import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ThreadId as ThreadIdType } from "@okcode/contracts";
import {
  DEFAULT_MODEL_BY_PROVIDER,
  type DesktopUpdateState,
  type GitStatusResult,
  type ProjectId,
  type ResolvedKeybindingsConfig,
  ThreadId,
} from "@okcode/contracts";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { isNonEmpty as isNonEmptyString } from "effect/String";
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  CheckCircleIcon,
  CircleDotIcon,
  CloudUploadIcon,
  ExternalLinkIcon,
  FolderIcon,
  GitBranchIcon,
  GitMergeIcon,
  GitPullRequestIcon,
  LinkIcon,
  PanelLeftCloseIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  TriangleAlertIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react";
import { type MouseEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloneRepositoryDialog } from "~/components/CloneRepositoryDialog";
import { EditableThreadTitle } from "~/components/EditableThreadTitle";
import { useClientMode } from "~/hooks/useClientMode";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useProjectTitleEditor } from "~/hooks/useProjectTitleEditor";
import { useTheme } from "~/hooks/useTheme";
import { useThreadTitleEditor } from "~/hooks/useThreadTitleEditor";
import { resolveImportedProjectScripts } from "~/lib/projectImport";
import { getProjectColor } from "~/projectColors";
import { useRightPanelStore } from "~/rightPanelStore";
import {
  type SidebarProjectSortOrder,
  type SidebarThreadSortOrder,
  useAppSettings,
} from "../appSettings";
import { APP_BASE_NAME, APP_VERSION } from "../branding";
import { useComposerDraftStore } from "../composerDraftStore";
import { isElectron } from "../env";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { shortcutLabelForCommand } from "../keybindings";
import { gitRemoveWorktreeMutationOptions, gitStatusQueryOptions } from "../lib/gitReactQuery";
import { serverConfigQueryOptions, serverUpdateQueryOptions } from "../lib/serverReactQuery";
import { cn, isLinuxPlatform, isMacPlatform, newCommandId, newProjectId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { derivePendingApprovals, derivePendingUserInputs } from "../session-logic";
import { useStore } from "../store";
import { useTerminalStateStore } from "../terminalStateStore";
import { useThreadSelectionStore } from "../threadSelectionStore";
import type { Thread } from "../types";
import { formatWorktreePathForDisplay, getOrphanedWorktreePathForThread } from "../worktreeCleanup";
import {
  getArm64IntelBuildWarningDescription,
  getDesktopUpdateActionError,
  getDesktopUpdateButtonTooltip,
  isDesktopUpdateButtonDisabled,
  resolveDesktopUpdateButtonAction,
  shouldHighlightDesktopUpdateError,
  shouldShowArm64IntelBuildWarning,
  shouldShowDesktopUpdateButton,
  shouldToastDesktopUpdateActionResult,
} from "./desktopUpdate.logic";
import { OkCodeMark } from "./OkCodeMark";
import {
  getVisibleThreadsForProject,
  isActionableThreadStatus,
  resolveSidebarNewThreadEnvMode,
  resolveThreadStatusPill,
  shouldClearThreadSelectionOnMouseDown,
  sortProjectsForSidebar,
  sortThreadsForSidebar,
} from "./Sidebar.logic";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Collapsible, CollapsibleContent } from "./ui/collapsible";
import { Menu, MenuGroup, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "./ui/menu";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./ui/sidebar";
import { toastManager } from "./ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const THREAD_PREVIEW_LIMIT = 10;
const SIDEBAR_SORT_LABELS: Record<SidebarProjectSortOrder, string> = {
  updated_at: "Last user message",
  created_at: "Created at",
  manual: "Manual",
};
const SIDEBAR_THREAD_SORT_LABELS: Record<SidebarThreadSortOrder, string> = {
  updated_at: "Last user message",
  created_at: "Created at",
};
interface PrStatusIndicator {
  label: "PR open" | "PR closed" | "PR merged";
  colorClass: string;
  tooltip: string;
  url: string;
  icon: typeof GitPullRequestIcon;
}

type ThreadPr = GitStatusResult["pr"];

function prStatusIndicator(pr: ThreadPr): PrStatusIndicator | null {
  if (!pr) return null;

  if (pr.state === "open") {
    return {
      label: "PR open",
      colorClass: "text-emerald-600 dark:text-emerald-300/90",
      tooltip: `#${pr.number} PR open: ${pr.title}`,
      url: pr.url,
      icon: GitPullRequestIcon,
    };
  }
  if (pr.state === "closed") {
    return {
      label: "PR closed",
      colorClass: "text-zinc-500 dark:text-zinc-400/80",
      tooltip: `#${pr.number} PR closed: ${pr.title}`,
      url: pr.url,
      icon: XCircleIcon,
    };
  }
  if (pr.state === "merged") {
    return {
      label: "PR merged",
      colorClass: "text-violet-600 dark:text-violet-300/90",
      tooltip: `#${pr.number} PR merged: ${pr.title}`,
      url: pr.url,
      icon: GitMergeIcon,
    };
  }
  return null;
}

type SortableProjectHandleProps = Pick<
  ReturnType<typeof useSortable>,
  "attributes" | "listeners" | "setActivatorNodeRef"
>;

function ProjectSortMenu({
  projectSortOrder,
  threadSortOrder,
  onProjectSortOrderChange,
  onThreadSortOrderChange,
}: {
  projectSortOrder: SidebarProjectSortOrder;
  threadSortOrder: SidebarThreadSortOrder;
  onProjectSortOrderChange: (sortOrder: SidebarProjectSortOrder) => void;
  onThreadSortOrderChange: (sortOrder: SidebarThreadSortOrder) => void;
}) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground" />
          }
        >
          <ArrowUpDownIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup side="right">Sort projects</TooltipPopup>
      </Tooltip>
      <MenuPopup align="end" side="bottom" className="min-w-44">
        <MenuGroup>
          <div className="px-2 py-1 sm:text-xs font-medium text-muted-foreground">
            Sort projects
          </div>
          <MenuRadioGroup
            value={projectSortOrder}
            onValueChange={(value) => {
              onProjectSortOrderChange(value as SidebarProjectSortOrder);
            }}
          >
            {(Object.entries(SIDEBAR_SORT_LABELS) as Array<[SidebarProjectSortOrder, string]>).map(
              ([value, label]) => (
                <MenuRadioItem key={value} value={value} className="min-h-7 py-1 sm:text-xs">
                  {label}
                </MenuRadioItem>
              ),
            )}
          </MenuRadioGroup>
        </MenuGroup>
        <MenuGroup>
          <div className="px-2 pt-2 pb-1 sm:text-xs font-medium text-muted-foreground">
            Sort threads
          </div>
          <MenuRadioGroup
            value={threadSortOrder}
            onValueChange={(value) => {
              onThreadSortOrderChange(value as SidebarThreadSortOrder);
            }}
          >
            {(
              Object.entries(SIDEBAR_THREAD_SORT_LABELS) as Array<[SidebarThreadSortOrder, string]>
            ).map(([value, label]) => (
              <MenuRadioItem key={value} value={value} className="min-h-7 py-1 sm:text-xs">
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

function SortableProjectItem({
  projectId,
  disabled = false,
  children,
}: {
  projectId: ProjectId;
  disabled?: boolean;
  children: (handleProps: SortableProjectHandleProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: projectId, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={`group/menu-item relative rounded-md mt-0.5 first:mt-0 ${
        isDragging ? "z-20 opacity-80" : ""
      } ${isOver && !isDragging ? "ring-1 ring-primary/40" : ""}`}
      data-sidebar="menu-item"
      data-slot="sidebar-menu-item"
    >
      {children({ attributes, listeners, setActivatorNodeRef })}
    </li>
  );
}

interface MemoizedThreadRowProps {
  thread: Thread;
  isActive: boolean;
  isSelected: boolean;
  prByThreadId: Map<ThreadIdType, ThreadPr>;
  orderedProjectThreadIds: ThreadIdType[];
  selectedThreadIds: ReadonlySet<ThreadIdType>;
  editingThreadId: ThreadIdType | null;
  editingThreadTitle: string;
  bindInputRef: (node: HTMLInputElement | null) => void;
  startEditing: (opts: { threadId: ThreadIdType; title: string }) => void;
  setDraftTitle: (title: string) => void;
  commitEditing: () => Promise<void> | void;
  cancelEditing: () => void;
  navigate: ReturnType<typeof useNavigate>;
  clearSelection: () => void;
  setSelectionAnchor: (threadId: ThreadIdType) => void;
  handleThreadClick: (
    event: MouseEvent,
    threadId: ThreadIdType,
    orderedProjectThreadIds: readonly ThreadIdType[],
  ) => void;
  handleThreadContextMenu: (
    threadId: ThreadIdType,
    position: { x: number; y: number },
  ) => Promise<void>;
  handleMultiSelectContextMenu: (position: { x: number; y: number }) => Promise<void>;
}

const MemoizedThreadRow = memo(
  function ThreadRow({
    thread,
    isActive,
    isSelected,
    prByThreadId,
    orderedProjectThreadIds,
    selectedThreadIds,
    editingThreadId,
    editingThreadTitle,
    bindInputRef,
    startEditing,
    setDraftTitle,
    commitEditing,
    cancelEditing,
    navigate,
    clearSelection,
    setSelectionAnchor,
    handleThreadClick,
    handleThreadContextMenu,
    handleMultiSelectContextMenu,
  }: MemoizedThreadRowProps) {
    const threadStatus = resolveThreadStatusPill({
      thread,
      hasPendingApprovals: derivePendingApprovals(thread.activities).length > 0,
      hasPendingUserInput: derivePendingUserInputs(thread.activities).length > 0,
    });
    const prStatus = prStatusIndicator(prByThreadId.get(thread.id) ?? null);

    // Derive a type-based icon for the thread row
    const ThreadIcon = prStatus
      ? prStatus.icon
      : threadStatus?.label === "Completed"
        ? CheckCircleIcon
        : threadStatus?.label === "Error"
          ? XCircleIcon
          : threadStatus?.label === "Working" || threadStatus?.label === "Connecting"
            ? CircleDotIcon
            : threadStatus?.label === "Pending Approval" || threadStatus?.label === "Awaiting Input"
              ? UserIcon
              : threadStatus?.label === "Plan Ready"
                ? LinkIcon
                : CircleDotIcon;

    const threadIconColor = prStatus
      ? prStatus.colorClass
      : threadStatus
        ? threadStatus.colorClass
        : "text-muted-foreground/50";

    return (
      <SidebarMenuSubItem key={thread.id} className="relative w-full" data-thread-item>
        <SidebarMenuSubButton
          render={<div role="button" tabIndex={0} />}
          size="sm"
          isActive={isActive}
          className={cn(
            "h-auto min-h-7 translate-x-0 items-center gap-2 rounded-md px-2 py-1 text-left",
            isActive
              ? "bg-accent/60 text-foreground"
              : isSelected
                ? "bg-accent/40 text-foreground"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
          onClick={(event) => {
            handleThreadClick(event, thread.id, orderedProjectThreadIds);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (selectedThreadIds.size > 0) {
              clearSelection();
            }
            setSelectionAnchor(thread.id);
            void navigate({
              to: "/$threadId",
              params: { threadId: thread.id },
            });
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            if (selectedThreadIds.size > 0 && selectedThreadIds.has(thread.id)) {
              void handleMultiSelectContextMenu({
                x: event.clientX,
                y: event.clientY,
              });
            } else {
              if (selectedThreadIds.size > 0) {
                clearSelection();
              }
              void handleThreadContextMenu(thread.id, {
                x: event.clientX,
                y: event.clientY,
              });
            }
          }}
        >
          <ThreadIcon className={cn("size-3.5 shrink-0", threadIconColor)} />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
            <EditableThreadTitle
              title={thread.title}
              isEditing={editingThreadId === thread.id}
              draftTitle={editingThreadTitle}
              inputRef={bindInputRef}
              containerClassName="min-w-0 flex-1"
              titleClassName="min-w-0 flex-1 truncate text-xs"
              inputClassName="h-6 px-1 text-xs"
              onStartEditing={() => {
                startEditing({
                  threadId: thread.id,
                  title: thread.title,
                });
              }}
              onDraftTitleChange={setDraftTitle}
              onCommit={() => void commitEditing()}
              onCancel={cancelEditing}
            />
          </div>
          <CloudUploadIcon className="size-3.5 shrink-0 text-muted-foreground/30" />
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    );
  },
  (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.thread.title !== next.thread.title) return false;
    if (prev.thread.updatedAt !== next.thread.updatedAt) return false;
    if (prev.thread.createdAt !== next.thread.createdAt) return false;
    if ((prev.editingThreadId === prev.thread.id) !== (next.editingThreadId === next.thread.id))
      return false;
    if (prev.editingThreadTitle !== next.editingThreadTitle) return false;
    // Check PR status for this specific thread
    if (prev.prByThreadId.get(prev.thread.id) !== next.prByThreadId.get(next.thread.id))
      return false;
    // Check thread activities (for status pill)
    if (prev.thread.activities !== next.thread.activities) return false;
    return true;
  },
);

export default function Sidebar() {
  const clientMode = useClientMode();
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);
  const markThreadUnread = useStore((store) => store.markThreadUnread);
  const toggleProject = useStore((store) => store.toggleProject);
  const reorderProjects = useStore((store) => store.reorderProjects);
  const clearComposerDraftForThread = useComposerDraftStore((store) => store.clearDraftThread);
  const getDraftThreadByProjectId = useComposerDraftStore(
    (store) => store.getDraftThreadByProjectId,
  );
  const clearTerminalState = useTerminalStateStore((state) => state.clearTerminalState);
  const clearProjectDraftThreadId = useComposerDraftStore(
    (store) => store.clearProjectDraftThreadId,
  );
  const clearProjectDraftThreadById = useComposerDraftStore(
    (store) => store.clearProjectDraftThreadById,
  );
  const navigate = useNavigate();
  const pathname = useLocation({ select: (loc) => loc.pathname });
  const isOnSubPage =
    pathname === "/settings" || pathname === "/pr-review" || pathname === "/merge-conflicts";
  const { settings: appSettings, updateSettings } = useAppSettings();
  const { resolvedTheme } = useTheme();
  const { toggleSidebar } = useSidebar();
  const { handleNewThread } = useHandleNewThread();
  const routeThreadId = useParams({
    strict: false,
    select: (params) => (params.threadId ? ThreadId.makeUnsafe(params.threadId) : null),
  });
  const { data: keybindings = EMPTY_KEYBINDINGS } = useQuery({
    ...serverConfigQueryOptions(),
    select: (config) => config.keybindings,
  });
  const queryClient = useQueryClient();
  const removeWorktreeMutation = useMutation(gitRemoveWorktreeMutationOptions({ queryClient }));
  const [addingProject, setAddingProject] = useState(false);
  const [newCwd, setNewCwd] = useState("");
  const [isPickingFolder, setIsPickingFolder] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [addProjectError, setAddProjectError] = useState<string | null>(null);
  const [manualProjectPathEntry, setManualProjectPathEntry] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const addProjectInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedThreadListsByProject, setExpandedThreadListsByProject] = useState<
    ReadonlySet<ProjectId>
  >(() => new Set());
  const dragInProgressRef = useRef(false);
  const suppressProjectClickAfterDragRef = useRef(false);
  const [desktopUpdateState, setDesktopUpdateState] = useState<DesktopUpdateState | null>(null);
  const { data: serverUpdateInfo } = useQuery({
    ...serverUpdateQueryOptions(),
    // Only run the update check in web (non-electron) mode; the desktop bridge
    // already handles updates for the Electron app.
    enabled: !isElectron,
  });
  const selectedThreadIds = useThreadSelectionStore((s) => s.selectedThreadIds);
  const toggleThreadSelection = useThreadSelectionStore((s) => s.toggleThread);
  const rangeSelectTo = useThreadSelectionStore((s) => s.rangeSelectTo);
  const clearSelection = useThreadSelectionStore((s) => s.clearSelection);
  const removeFromSelection = useThreadSelectionStore((s) => s.removeFromSelection);
  const setSelectionAnchor = useThreadSelectionStore((s) => s.setAnchor);
  const isLinuxDesktop = isElectron && isLinuxPlatform(navigator.platform);
  const shouldBrowseForProjectImmediately = isElectron && !isLinuxDesktop;
  const shouldShowProjectPathEntry = addingProject && !shouldBrowseForProjectImmediately;
  const {
    editingThreadId,
    draftTitle: editingThreadTitle,
    bindInputRef,
    cancelEditing,
    commitEditing,
    setDraftTitle,
    startEditing,
  } = useThreadTitleEditor();
  const {
    editingProjectId,
    draftProjectTitle,
    bindProjectInputRef,
    cancelProjectEditing,
    commitProjectEditing,
    setDraftProjectTitle,
    startProjectEditing,
  } = useProjectTitleEditor();
  const projectCwdById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.cwd] as const)),
    [projects],
  );
  const threadGitTargets = useMemo(
    () =>
      threads.map((thread) => ({
        threadId: thread.id,
        branch: thread.branch,
        cwd: thread.worktreePath ?? projectCwdById.get(thread.projectId) ?? null,
      })),
    [projectCwdById, threads],
  );
  const threadGitStatusCwds = useMemo(
    () => [
      ...new Set(
        threadGitTargets
          .filter((target) => target.branch !== null)
          .map((target) => target.cwd)
          .filter((cwd): cwd is string => cwd !== null),
      ),
    ],
    [threadGitTargets],
  );
  const threadGitStatusQueries = useQueries({
    queries: threadGitStatusCwds.map((cwd) => ({
      ...gitStatusQueryOptions(cwd),
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });
  const prByThreadId = useMemo(() => {
    const statusByCwd = new Map<string, GitStatusResult>();
    for (let index = 0; index < threadGitStatusCwds.length; index += 1) {
      const cwd = threadGitStatusCwds[index];
      if (!cwd) continue;
      const status = threadGitStatusQueries[index]?.data;
      if (status) {
        statusByCwd.set(cwd, status);
      }
    }

    const map = new Map<ThreadId, ThreadPr>();
    for (const target of threadGitTargets) {
      const status = target.cwd ? statusByCwd.get(target.cwd) : undefined;
      const branchMatches =
        target.branch !== null && status?.branch !== null && status?.branch === target.branch;
      map.set(target.threadId, branchMatches ? (status?.pr ?? null) : null);
    }
    return map;
  }, [threadGitStatusCwds, threadGitStatusQueries, threadGitTargets]);

  const focusMostRecentThreadForProject = useCallback(
    (projectId: ProjectId) => {
      const latestThread = sortThreadsForSidebar(
        threads.filter((thread) => thread.projectId === projectId),
        appSettings.sidebarThreadSortOrder,
      )[0];
      if (!latestThread) return;

      void navigate({
        to: "/$threadId",
        params: { threadId: latestThread.id },
      });
    },
    [appSettings.sidebarThreadSortOrder, navigate, threads],
  );

  const addProjectFromPath = useCallback(
    async (rawCwd: string) => {
      const cwd = rawCwd.trim();
      if (!cwd || isAddingProject) return;
      const api = readNativeApi();
      if (!api) return;

      setIsAddingProject(true);
      const finishAddingProject = () => {
        setIsAddingProject(false);
        setNewCwd("");
        setAddProjectError(null);
        setAddingProject(false);
      };

      const existing = projects.find((project) => project.cwd === cwd);
      if (existing) {
        focusMostRecentThreadForProject(existing.id);
        finishAddingProject();
        return;
      }

      const projectId = newProjectId();
      const createdAt = new Date().toISOString();
      const title = cwd.split(/[/\\]/).findLast(isNonEmptyString) ?? cwd;
      try {
        const { scripts: projectScripts, warning: packageScriptWarning } =
          await resolveImportedProjectScripts(api, cwd);

        await api.orchestration.dispatchCommand({
          type: "project.create",
          commandId: newCommandId(),
          projectId,
          title,
          workspaceRoot: cwd,
          defaultModel: DEFAULT_MODEL_BY_PROVIDER.codex,
          ...(projectScripts ? { scripts: projectScripts } : {}),
          createdAt,
        });
        if (packageScriptWarning) {
          toastManager.add({
            type: "warning",
            title: "Project actions need a package manager choice",
            description: packageScriptWarning,
          });
        }
        await handleNewThread(projectId, {
          envMode: appSettings.defaultThreadEnvMode,
        }).catch(() => undefined);
      } catch (error) {
        const description =
          error instanceof Error ? error.message : "An error occurred while adding the project.";
        setIsAddingProject(false);
        if (shouldBrowseForProjectImmediately) {
          toastManager.add({
            type: "error",
            title: "Failed to add project",
            description,
          });
        } else {
          setAddProjectError(description);
        }
        return;
      }
      finishAddingProject();
    },
    [
      focusMostRecentThreadForProject,
      handleNewThread,
      isAddingProject,
      projects,
      shouldBrowseForProjectImmediately,
      appSettings.defaultThreadEnvMode,
    ],
  );

  const handleAddProject = () => {
    void addProjectFromPath(newCwd);
  };

  const canAddProject = newCwd.trim().length > 0 && !isAddingProject;

  const createNewThreadForProject = useCallback(
    (projectId: ProjectId) => {
      return handleNewThread(projectId, {
        envMode: resolveSidebarNewThreadEnvMode({
          defaultEnvMode: appSettings.defaultThreadEnvMode,
        }),
      });
    },
    [appSettings.defaultThreadEnvMode, handleNewThread],
  );

  const handlePickFolder = async () => {
    const api = readNativeApi();
    if (!api || isPickingFolder) return;
    setIsPickingFolder(true);
    let pickedPath: string | null = null;
    try {
      pickedPath = await api.dialogs.pickFolder();
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Could not open folder picker",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    }
    if (pickedPath) {
      await addProjectFromPath(pickedPath);
    } else if (!shouldBrowseForProjectImmediately) {
      addProjectInputRef.current?.focus();
    }
    setIsPickingFolder(false);
  };

  const handleStartAddProject = () => {
    setAddProjectError(null);
    if (shouldBrowseForProjectImmediately) {
      void handlePickFolder();
      return;
    }
    setManualProjectPathEntry(false);
    setAddingProject((prev) => !prev);
  };

  const handleCloneComplete = useCallback(
    async (result: { path: string; branch: string; repoName: string }) => {
      await addProjectFromPath(result.path);
    },
    [addProjectFromPath],
  );

  /**
   * Delete a single thread: stop session, close terminal, dispatch delete,
   * clean up drafts/state, and optionally remove orphaned worktree.
   * Callers handle thread-level confirmation; this still prompts for worktree removal.
   */
  const deleteThread = useCallback(
    async (
      threadId: ThreadId,
      opts: { deletedThreadIds?: ReadonlySet<ThreadId> } = {},
    ): Promise<void> => {
      const api = readNativeApi();
      if (!api) return;
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      const threadProject = projects.find((project) => project.id === thread.projectId);
      // When bulk-deleting, exclude the other threads being deleted so
      // getOrphanedWorktreePathForThread correctly detects that no surviving
      // threads will reference this worktree.
      const deletedIds = opts.deletedThreadIds;
      const survivingThreads =
        deletedIds && deletedIds.size > 0
          ? threads.filter((t) => t.id === threadId || !deletedIds.has(t.id))
          : threads;
      const orphanedWorktreePath = getOrphanedWorktreePathForThread(survivingThreads, threadId);
      const displayWorktreePath = orphanedWorktreePath
        ? formatWorktreePathForDisplay(orphanedWorktreePath)
        : null;
      const canDeleteWorktree = orphanedWorktreePath !== null && threadProject !== undefined;
      const shouldDeleteWorktree =
        canDeleteWorktree &&
        (await api.dialogs.confirm(
          [
            "This thread is the only one linked to this worktree:",
            displayWorktreePath ?? orphanedWorktreePath,
            "",
            "Delete the worktree too?",
          ].join("\n"),
        ));

      if (thread.session && thread.session.status !== "closed") {
        await api.orchestration
          .dispatchCommand({
            type: "thread.session.stop",
            commandId: newCommandId(),
            threadId,
            createdAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }

      try {
        await api.terminal.close({ threadId, deleteHistory: true });
      } catch {
        // Terminal may already be closed
      }

      const allDeletedIds = deletedIds ?? new Set<ThreadId>();
      const shouldNavigateToFallback = routeThreadId === threadId;
      const fallbackThreadId =
        threads.find((entry) => entry.id !== threadId && !allDeletedIds.has(entry.id))?.id ?? null;
      await api.orchestration.dispatchCommand({
        type: "thread.delete",
        commandId: newCommandId(),
        threadId,
      });
      clearComposerDraftForThread(threadId);
      clearProjectDraftThreadById(thread.projectId, thread.id);
      clearTerminalState(threadId);
      if (shouldNavigateToFallback) {
        if (fallbackThreadId) {
          void navigate({
            to: "/$threadId",
            params: { threadId: fallbackThreadId },
            replace: true,
          });
        } else {
          void navigate({ to: "/", replace: true });
        }
      }

      if (!shouldDeleteWorktree || !orphanedWorktreePath || !threadProject) {
        return;
      }

      try {
        await removeWorktreeMutation.mutateAsync({
          cwd: threadProject.cwd,
          path: orphanedWorktreePath,
          force: true,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error removing worktree.";
        console.error("Failed to remove orphaned worktree after thread deletion", {
          threadId,
          projectCwd: threadProject.cwd,
          worktreePath: orphanedWorktreePath,
          error,
        });
        toastManager.add({
          type: "error",
          title: "Thread deleted, but worktree removal failed",
          description: `Could not remove ${displayWorktreePath ?? orphanedWorktreePath}. ${message}`,
        });
      }
    },
    [
      clearComposerDraftForThread,
      clearProjectDraftThreadById,
      clearTerminalState,
      navigate,
      projects,
      removeWorktreeMutation,
      routeThreadId,
      threads,
    ],
  );

  const { copyToClipboard: copyThreadIdToClipboard } = useCopyToClipboard<{
    threadId: ThreadId;
  }>({
    onCopy: (ctx) => {
      toastManager.add({
        type: "success",
        title: "Thread ID copied",
        description: ctx.threadId,
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Failed to copy thread ID",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    },
  });
  const { copyToClipboard: copyPathToClipboard } = useCopyToClipboard<{
    path: string;
  }>({
    onCopy: () => {
      toastManager.add({
        type: "success",
        title: "Path copied",
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Failed to copy path",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    },
  });
  const handleThreadContextMenu = useCallback(
    async (threadId: ThreadId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      const threadWorkspacePath =
        thread.worktreePath ?? projectCwdById.get(thread.projectId) ?? null;
      const clicked = await api.contextMenu.show(
        [
          { id: "rename", label: "Rename thread" },
          { id: "mark-unread", label: "Mark unread" },
          { id: "copy-path", label: "Copy Path" },
          { id: "copy-thread-id", label: "Copy Thread ID" },
          { id: "delete", label: "Delete", destructive: true },
        ],
        position,
      );

      if (clicked === "rename") {
        startEditing({
          threadId,
          title: thread.title,
        });
        return;
      }

      if (clicked === "mark-unread") {
        markThreadUnread(threadId);
        return;
      }
      if (clicked === "copy-path") {
        if (!threadWorkspacePath) {
          toastManager.add({
            type: "error",
            title: "Path unavailable",
            description: "This thread does not have a workspace path to copy.",
          });
          return;
        }
        copyPathToClipboard(threadWorkspacePath, { path: threadWorkspacePath });
        return;
      }
      if (clicked === "copy-thread-id") {
        copyThreadIdToClipboard(threadId, { threadId });
        return;
      }
      if (clicked !== "delete") return;
      if (appSettings.confirmThreadDelete) {
        const confirmed = await api.dialogs.confirm(
          [
            `Delete thread "${thread.title}"?`,
            "This permanently clears conversation history for this thread.",
          ].join("\n"),
        );
        if (!confirmed) {
          return;
        }
      }
      await deleteThread(threadId);
    },
    [
      appSettings.confirmThreadDelete,
      copyPathToClipboard,
      copyThreadIdToClipboard,
      deleteThread,
      markThreadUnread,
      projectCwdById,
      startEditing,
      threads,
    ],
  );

  const handleMultiSelectContextMenu = useCallback(
    async (position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const ids = [...selectedThreadIds];
      if (ids.length === 0) return;
      const count = ids.length;

      const clicked = await api.contextMenu.show(
        [
          { id: "mark-unread", label: `Mark unread (${count})` },
          { id: "delete", label: `Delete (${count})`, destructive: true },
        ],
        position,
      );

      if (clicked === "mark-unread") {
        for (const id of ids) {
          markThreadUnread(id);
        }
        clearSelection();
        return;
      }

      if (clicked !== "delete") return;

      if (appSettings.confirmThreadDelete) {
        const confirmed = await api.dialogs.confirm(
          [
            `Delete ${count} thread${count === 1 ? "" : "s"}?`,
            "This permanently clears conversation history for these threads.",
          ].join("\n"),
        );
        if (!confirmed) return;
      }

      const deletedIds = new Set<ThreadId>(ids);
      for (const id of ids) {
        await deleteThread(id, { deletedThreadIds: deletedIds });
      }
      removeFromSelection(ids);
    },
    [
      appSettings.confirmThreadDelete,
      clearSelection,
      deleteThread,
      markThreadUnread,
      removeFromSelection,
      selectedThreadIds,
    ],
  );

  const handleThreadClick = useCallback(
    (event: MouseEvent, threadId: ThreadId, orderedProjectThreadIds: readonly ThreadId[]) => {
      const isMac = isMacPlatform(navigator.platform);
      const isModClick = isMac ? event.metaKey : event.ctrlKey;
      const isShiftClick = event.shiftKey;

      if (isModClick) {
        event.preventDefault();
        toggleThreadSelection(threadId);
        return;
      }

      if (isShiftClick) {
        event.preventDefault();
        rangeSelectTo(threadId, orderedProjectThreadIds);
        return;
      }

      // Plain click — clear selection, set anchor for future shift-clicks, and navigate
      if (selectedThreadIds.size > 0) {
        clearSelection();
      }
      setSelectionAnchor(threadId);
      void navigate({
        to: "/$threadId",
        params: { threadId },
      });
    },
    [
      clearSelection,
      navigate,
      rangeSelectTo,
      selectedThreadIds.size,
      setSelectionAnchor,
      toggleThreadSelection,
    ],
  );

  const handleProjectContextMenu = useCallback(
    async (projectId: ProjectId, position: { x: number; y: number }) => {
      const api = readNativeApi();
      if (!api) return;
      const clicked = await api.contextMenu.show(
        [
          { id: "rename", label: "Rename project" },
          { id: "delete", label: "Remove project", destructive: true },
        ],
        position,
      );

      if (clicked === "rename") {
        const project = projects.find((entry) => entry.id === projectId);
        if (!project) return;
        startProjectEditing({
          projectId: project.id,
          title: project.name,
        });
        return;
      }

      if (clicked !== "delete") return;

      const project = projects.find((entry) => entry.id === projectId);
      if (!project) return;

      const projectThreads = threads.filter((thread) => thread.projectId === projectId);
      if (projectThreads.length > 0) {
        toastManager.add({
          type: "warning",
          title: "Project is not empty",
          description: "Delete all threads in this project before removing it.",
        });
        return;
      }

      const confirmed = await api.dialogs.confirm(`Remove project "${project.name}"?`);
      if (!confirmed) return;

      try {
        const projectDraftThread = getDraftThreadByProjectId(projectId);
        if (projectDraftThread) {
          clearComposerDraftForThread(projectDraftThread.threadId);
        }
        clearProjectDraftThreadId(projectId);
        await api.orchestration.dispatchCommand({
          type: "project.delete",
          commandId: newCommandId(),
          projectId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error removing project.";
        console.error("Failed to remove project", { projectId, error });
        toastManager.add({
          type: "error",
          title: `Failed to remove "${project.name}"`,
          description: message,
        });
      }
    },
    [
      clearComposerDraftForThread,
      clearProjectDraftThreadId,
      getDraftThreadByProjectId,
      projects,
      startProjectEditing,
      threads,
    ],
  );

  const projectDnDSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );
  const projectCollisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    return closestCorners(args);
  }, []);

  const handleProjectDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (appSettings.sidebarProjectSortOrder !== "manual") {
        dragInProgressRef.current = false;
        return;
      }
      dragInProgressRef.current = false;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const activeProject = projects.find((project) => project.id === active.id);
      const overProject = projects.find((project) => project.id === over.id);
      if (!activeProject || !overProject) return;
      reorderProjects(activeProject.id, overProject.id);
    },
    [appSettings.sidebarProjectSortOrder, projects, reorderProjects],
  );

  const handleProjectDragStart = useCallback(
    (_event: DragStartEvent) => {
      if (appSettings.sidebarProjectSortOrder !== "manual") {
        return;
      }
      dragInProgressRef.current = true;
      suppressProjectClickAfterDragRef.current = true;
    },
    [appSettings.sidebarProjectSortOrder],
  );

  const handleProjectDragCancel = useCallback((_event: DragCancelEvent) => {
    dragInProgressRef.current = false;
  }, []);

  const handleProjectTitlePointerDownCapture = useCallback(() => {
    suppressProjectClickAfterDragRef.current = false;
  }, []);

  const sortedProjects = useMemo(
    () => sortProjectsForSidebar(projects, threads, appSettings.sidebarProjectSortOrder),
    [appSettings.sidebarProjectSortOrder, projects, threads],
  );
  const attentionThreads = useMemo(() => {
    return threads
      .map((thread) => {
        const status = resolveThreadStatusPill({
          thread,
          hasPendingApprovals: derivePendingApprovals(thread.activities).length > 0,
          hasPendingUserInput: derivePendingUserInputs(thread.activities).length > 0,
        });
        if (!isActionableThreadStatus(status)) {
          return null;
        }
        const project = projects.find((entry) => entry.id === thread.projectId);
        return {
          thread,
          projectName: project?.name ?? "Unknown project",
          status,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          thread: Thread;
          projectName: string;
          status: NonNullable<ReturnType<typeof resolveThreadStatusPill>>;
        } => entry !== null,
      )
      .toSorted((a, b) => {
        const leftPriority = a.status ? (a.status.label === "Error" ? 6 : 5) : 0;
        const rightPriority = b.status ? (b.status.label === "Error" ? 6 : 5) : 0;
        if (leftPriority !== rightPriority) {
          return rightPriority - leftPriority;
        }
        return (
          Date.parse(b.thread.updatedAt ?? b.thread.createdAt) -
          Date.parse(a.thread.updatedAt ?? a.thread.createdAt)
        );
      });
  }, [projects, threads]);
  const isManualProjectSorting = appSettings.sidebarProjectSortOrder === "manual";

  function renderProjectItem(
    project: (typeof sortedProjects)[number],
    dragHandleProps: SortableProjectHandleProps | null,
  ) {
    const projectThreads = sortThreadsForSidebar(
      threads.filter((thread) => thread.projectId === project.id),
      appSettings.sidebarThreadSortOrder,
    );
    const activeThreadId = routeThreadId ?? undefined;
    const isThreadListExpanded = expandedThreadListsByProject.has(project.id);
    const pinnedCollapsedThread =
      !project.expanded && activeThreadId
        ? (projectThreads.find((thread) => thread.id === activeThreadId) ?? null)
        : null;
    const shouldShowThreadPanel = project.expanded || pinnedCollapsedThread !== null;
    const { hasHiddenThreads, visibleThreads } = getVisibleThreadsForProject({
      threads: projectThreads,
      activeThreadId,
      isThreadListExpanded,
      previewLimit: THREAD_PREVIEW_LIMIT,
    });
    const orderedProjectThreadIds = projectThreads.map((thread) => thread.id);
    const renderedThreads = pinnedCollapsedThread ? [pinnedCollapsedThread] : visibleThreads;
    const pColor = getProjectColor(project.id);
    const isDark = resolvedTheme === "dark";

    return (
      <Collapsible className="group/collapsible" open={shouldShowThreadPanel}>
        <div
          className="group/project-header relative flex items-center gap-1 rounded-md"
          style={{ backgroundColor: isDark ? pColor.bgDark : pColor.bg }}
        >
          <SidebarMenuButton
            ref={isManualProjectSorting ? dragHandleProps?.setActivatorNodeRef : undefined}
            size="sm"
            className={cn(
              "min-w-0 flex-1 gap-0 rounded-md px-2 py-1.5 text-left hover:bg-transparent",
              isManualProjectSorting ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            )}
            {...(isManualProjectSorting && dragHandleProps ? dragHandleProps.attributes : {})}
            {...(isManualProjectSorting && dragHandleProps ? dragHandleProps.listeners : {})}
            onPointerDownCapture={handleProjectTitlePointerDownCapture}
            onClick={(event) => handleProjectTitleClick(event, project.id)}
            onKeyDown={(event) => handleProjectTitleKeyDown(event, project.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              void handleProjectContextMenu(project.id, {
                x: event.clientX,
                y: event.clientY,
              });
            }}
          >
            {editingProjectId === project.id ? (
              <input
                ref={bindProjectInputRef}
                type="text"
                value={draftProjectTitle}
                className="min-w-0 flex-1 rounded border border-primary/40 bg-background px-1 text-xs font-medium outline-none focus:border-primary"
                onChange={(e) => setDraftProjectTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitProjectEditing();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelProjectEditing();
                  }
                }}
                onBlur={() => void commitProjectEditing()}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-xs font-semibold"
                  style={{ color: isDark ? pColor.textDark : pColor.text }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startProjectEditing({
                      projectId: project.id,
                      title: project.name,
                    });
                  }}
                >
                  {project.name}
                </span>
              </span>
            )}
          </SidebarMenuButton>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="New thread"
                  data-testid="new-thread-button"
                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void createNewThreadForProject(project.id);
                  }}
                >
                  <PlusIcon className="size-3.5" />
                </button>
              }
            />
            <TooltipPopup side="right">
              {newThreadShortcutLabel ? `New thread (${newThreadShortcutLabel})` : "New thread"}
            </TooltipPopup>
          </Tooltip>
        </div>

        <CollapsibleContent>
          <SidebarMenuSub className="relative mx-0 my-0 w-auto translate-x-0 gap-0 border-none bg-transparent px-1 py-0">
            {renderedThreads.map((thread) => (
              <MemoizedThreadRow
                key={thread.id}
                thread={thread}
                isActive={routeThreadId === thread.id}
                isSelected={selectedThreadIds.has(thread.id)}
                prByThreadId={prByThreadId}
                orderedProjectThreadIds={orderedProjectThreadIds}
                selectedThreadIds={selectedThreadIds}
                editingThreadId={editingThreadId}
                editingThreadTitle={editingThreadTitle}
                bindInputRef={bindInputRef}
                startEditing={startEditing}
                setDraftTitle={setDraftTitle}
                commitEditing={commitEditing}
                cancelEditing={cancelEditing}
                navigate={navigate}
                clearSelection={clearSelection}
                setSelectionAnchor={setSelectionAnchor}
                handleThreadClick={handleThreadClick}
                handleThreadContextMenu={handleThreadContextMenu}
                handleMultiSelectContextMenu={handleMultiSelectContextMenu}
              />
            ))}

            {project.expanded && hasHiddenThreads && !isThreadListExpanded && (
              <SidebarMenuSubItem className="w-full">
                <SidebarMenuSubButton
                  render={<button type="button" />}
                  data-thread-selection-safe
                  size="sm"
                  className="h-6 w-full translate-x-0 justify-start px-2 text-left text-[10px] text-muted-foreground/60 hover:bg-accent hover:text-muted-foreground/80"
                  onClick={() => {
                    expandThreadListForProject(project.id);
                  }}
                >
                  <span>Show more</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
            {project.expanded && hasHiddenThreads && isThreadListExpanded && (
              <SidebarMenuSubItem className="w-full">
                <SidebarMenuSubButton
                  render={<button type="button" />}
                  data-thread-selection-safe
                  size="sm"
                  className="h-6 w-full translate-x-0 justify-start px-2 text-left text-[10px] text-muted-foreground/60 hover:bg-accent hover:text-muted-foreground/80"
                  onClick={() => {
                    collapseThreadListForProject(project.id);
                  }}
                >
                  <span>Show less</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const handleProjectTitleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, projectId: ProjectId) => {
      if (dragInProgressRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (suppressProjectClickAfterDragRef.current) {
        // Consume the synthetic click emitted after a drag release.
        suppressProjectClickAfterDragRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (selectedThreadIds.size > 0) {
        clearSelection();
      }
      // When expanding a project with exactly one thread, navigate directly to it.
      const project = projects.find((p) => p.id === projectId);
      if (project && !project.expanded) {
        const projectThreads = threads.filter((t) => t.projectId === projectId);
        if (projectThreads.length === 1) {
          toggleProject(projectId);
          void navigate({
            to: "/$threadId",
            params: { threadId: projectThreads[0]!.id },
          });
          return;
        }
      }
      toggleProject(projectId);
    },
    [clearSelection, navigate, projects, selectedThreadIds.size, threads, toggleProject],
  );

  const handleProjectTitleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, projectId: ProjectId) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      if (dragInProgressRef.current) {
        return;
      }
      // When expanding a project with exactly one thread, navigate directly to it.
      const project = projects.find((p) => p.id === projectId);
      if (project && !project.expanded) {
        const projectThreads = threads.filter((t) => t.projectId === projectId);
        if (projectThreads.length === 1) {
          toggleProject(projectId);
          void navigate({
            to: "/$threadId",
            params: { threadId: projectThreads[0]!.id },
          });
          return;
        }
      }
      toggleProject(projectId);
    },
    [navigate, projects, threads, toggleProject],
  );

  useEffect(() => {
    const onMouseDown = (event: globalThis.MouseEvent) => {
      if (selectedThreadIds.size === 0) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!shouldClearThreadSelectionOnMouseDown(target)) return;
      clearSelection();
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [clearSelection, selectedThreadIds.size]);

  useEffect(() => {
    if (!isElectron) return;
    const bridge = window.desktopBridge;
    if (
      !bridge ||
      typeof bridge.getUpdateState !== "function" ||
      typeof bridge.onUpdateState !== "function"
    ) {
      return;
    }

    let disposed = false;
    let receivedSubscriptionUpdate = false;
    const unsubscribe = bridge.onUpdateState((nextState) => {
      if (disposed) return;
      receivedSubscriptionUpdate = true;
      setDesktopUpdateState(nextState);
    });

    void bridge
      .getUpdateState()
      .then((nextState) => {
        if (disposed || receivedSubscriptionUpdate) return;
        setDesktopUpdateState(nextState);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const showDesktopUpdateButton = isElectron && shouldShowDesktopUpdateButton(desktopUpdateState);

  const desktopUpdateTooltip = desktopUpdateState
    ? getDesktopUpdateButtonTooltip(desktopUpdateState)
    : "Update available";

  const desktopUpdateButtonDisabled = isDesktopUpdateButtonDisabled(desktopUpdateState);
  const desktopUpdateButtonAction = desktopUpdateState
    ? resolveDesktopUpdateButtonAction(desktopUpdateState)
    : "none";
  const showArm64IntelBuildWarning =
    isElectron && shouldShowArm64IntelBuildWarning(desktopUpdateState);
  const arm64IntelBuildWarningDescription =
    desktopUpdateState && showArm64IntelBuildWarning
      ? getArm64IntelBuildWarningDescription(desktopUpdateState)
      : null;
  const desktopUpdateButtonInteractivityClasses = desktopUpdateButtonDisabled
    ? "cursor-not-allowed opacity-60"
    : "hover:bg-accent hover:text-foreground";
  const desktopUpdateButtonClasses =
    desktopUpdateState?.status === "downloaded"
      ? "text-emerald-500"
      : desktopUpdateState?.status === "downloading"
        ? "text-sky-400"
        : shouldHighlightDesktopUpdateError(desktopUpdateState)
          ? "text-rose-500 animate-pulse"
          : "text-amber-500 animate-pulse";
  const newThreadShortcutLabel =
    shortcutLabelForCommand(keybindings, "chat.newLocal") ??
    shortcutLabelForCommand(keybindings, "chat.new");

  const handleDesktopUpdateButtonClick = useCallback(() => {
    const bridge = window.desktopBridge;
    if (!bridge || !desktopUpdateState) return;
    if (desktopUpdateButtonDisabled || desktopUpdateButtonAction === "none") return;

    if (desktopUpdateButtonAction === "download") {
      void bridge
        .downloadUpdate()
        .then((result) => {
          if (result.completed) {
            toastManager.add({
              type: "success",
              title: "Update downloaded",
              description: "Restart the app from the update button to install it.",
            });
          }
          if (!shouldToastDesktopUpdateActionResult(result)) return;
          const actionError = getDesktopUpdateActionError(result);
          if (!actionError) return;
          toastManager.add({
            type: "error",
            title: "Could not download update",
            description: actionError,
          });
        })
        .catch((error) => {
          toastManager.add({
            type: "error",
            title: "Could not start update download",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          });
        });
      return;
    }

    if (desktopUpdateButtonAction === "install") {
      void bridge
        .installUpdate()
        .then((result) => {
          if (!shouldToastDesktopUpdateActionResult(result)) return;
          const actionError = getDesktopUpdateActionError(result);
          if (!actionError) return;
          toastManager.add({
            type: "error",
            title: "Could not install update",
            description: actionError,
          });
        })
        .catch((error) => {
          toastManager.add({
            type: "error",
            title: "Could not install update",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          });
        });
    }
  }, [desktopUpdateButtonAction, desktopUpdateButtonDisabled, desktopUpdateState]);

  const expandThreadListForProject = useCallback((projectId: ProjectId) => {
    setExpandedThreadListsByProject((current) => {
      if (current.has(projectId)) return current;
      const next = new Set(current);
      next.add(projectId);
      return next;
    });
  }, []);

  const collapseThreadListForProject = useCallback((projectId: ProjectId) => {
    setExpandedThreadListsByProject((current) => {
      if (!current.has(projectId)) return current;
      const next = new Set(current);
      next.delete(projectId);
      return next;
    });
  }, []);

  const wordmark = (
    <div className="flex items-center gap-2 w-full">
      <SidebarTrigger className="shrink-0 md:hidden" />
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="wordmark-stitch flex min-w-0 flex-1 items-center justify-center gap-1.5 cursor-pointer mx-auto px-2.5 py-1 rounded-md">
              <OkCodeMark className="size-5 text-foreground drop-shadow-[0_1px_0_rgba(255,255,255,0.15)]" />
              <span className="truncate text-sm font-semibold tracking-wide text-foreground drop-shadow-[0_1px_0_rgba(255,255,255,0.15)]">
                {APP_BASE_NAME}
              </span>
            </div>
          }
        />
        <TooltipPopup side="bottom" sideOffset={2}>
          Version {APP_VERSION}
        </TooltipPopup>
      </Tooltip>
    </div>
  );

  return (
    <>
      {isElectron ? (
        <>
          <SidebarHeader className="drag-region h-[42px] flex-row items-center gap-2 px-4 py-0 pl-[90px]">
            {wordmark}
            <div className="ml-auto flex items-center gap-1">
              {showDesktopUpdateButton && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={desktopUpdateTooltip}
                        aria-disabled={desktopUpdateButtonDisabled || undefined}
                        disabled={desktopUpdateButtonDisabled}
                        className={`inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors ${desktopUpdateButtonInteractivityClasses} ${desktopUpdateButtonClasses}`}
                        onClick={handleDesktopUpdateButtonClick}
                      >
                        <RocketIcon className="size-3.5" />
                      </button>
                    }
                  />
                  <TooltipPopup side="bottom">{desktopUpdateTooltip}</TooltipPopup>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Collapse sidebar"
                      className="hidden md:inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-90"
                      onClick={toggleSidebar}
                    >
                      <PanelLeftCloseIcon className="size-3.5" />
                    </button>
                  }
                />
                <TooltipPopup side="bottom">Collapse sidebar</TooltipPopup>
              </Tooltip>
            </div>
          </SidebarHeader>
        </>
      ) : (
        <SidebarHeader className="gap-2 px-3 py-1.5 sm:gap-2 sm:px-4 sm:py-2">
          <div className="flex flex-row items-center gap-2">
            {wordmark}
            <div className="ml-auto flex items-center gap-1">
              {serverUpdateInfo?.updateAvailable && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Update available: ${serverUpdateInfo.latestVersion}`}
                        className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-foreground text-amber-500 animate-pulse"
                        onClick={() => {
                          toastManager.add({
                            type: "info",
                            title: `${APP_BASE_NAME} ${serverUpdateInfo.latestVersion} available`,
                            description: `Update with: npm install -g okcodes@latest`,
                          });
                        }}
                      >
                        <RocketIcon className="size-3.5" />
                      </button>
                    }
                  />
                  <TooltipPopup side="bottom">
                    Update {serverUpdateInfo.latestVersion} available
                  </TooltipPopup>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Collapse sidebar"
                      className="hidden md:inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-90"
                      onClick={toggleSidebar}
                    >
                      <PanelLeftCloseIcon className="size-3.5" />
                    </button>
                  }
                />
                <TooltipPopup side="bottom">Collapse sidebar</TooltipPopup>
              </Tooltip>
            </div>
          </div>
        </SidebarHeader>
      )}

      <SidebarContent className="gap-0">
        {showArm64IntelBuildWarning && arm64IntelBuildWarningDescription ? (
          <SidebarGroup className="px-2 pt-2 pb-0">
            <Alert variant="warning" className="rounded-2xl border-warning/40 bg-warning/8">
              <TriangleAlertIcon />
              <AlertTitle>Intel build on Apple Silicon</AlertTitle>
              <AlertDescription>{arm64IntelBuildWarningDescription}</AlertDescription>
              {desktopUpdateButtonAction !== "none" ? (
                <AlertAction>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={desktopUpdateButtonDisabled}
                    onClick={handleDesktopUpdateButtonClick}
                  >
                    {desktopUpdateButtonAction === "download"
                      ? "Download ARM build"
                      : "Install ARM build"}
                  </Button>
                </AlertAction>
              ) : null}
            </Alert>
          </SidebarGroup>
        ) : null}
        {attentionThreads.length > 0 ? (
          <SidebarGroup className="px-2 pt-2 pb-0">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                Needs Attention
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {attentionThreads.length}
              </span>
            </div>
            <SidebarMenu>
              {attentionThreads
                .slice(0, clientMode === "mobile" ? 6 : 4)
                .map(({ thread, projectName, status }) => {
                  const isActive = routeThreadId === thread.id;
                  return (
                    <SidebarMenuItem key={`attention:${thread.id}`} className="mt-1 first:mt-0">
                      <SidebarMenuButton
                        render={<button type="button" />}
                        size="sm"
                        isActive={isActive}
                        className={cn(
                          "h-auto min-h-10 translate-x-0 items-start gap-2 px-2 py-2 text-left",
                          isActive
                            ? "bg-accent/85 text-foreground dark:bg-accent/55"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                        onClick={() => {
                          void navigate({
                            to: "/$threadId",
                            params: { threadId: thread.id },
                          });
                        }}
                      >
                        <span
                          className={cn(
                            "mt-1 inline-flex size-2 shrink-0 rounded-full",
                            status.dotClass,
                            status.pulse ? "animate-pulse" : "",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-foreground">
                            {thread.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/65">
                            {projectName}
                          </span>
                        </span>
                        <span className={cn("shrink-0 text-[10px]", status.colorClass)}>
                          {status.label}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
        <SidebarGroup className="px-2 py-2">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Projects
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Open file tree"
                      className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                      onClick={() => {
                        useRightPanelStore.getState().open("files");
                      }}
                    />
                  }
                >
                  <FolderIcon className="size-3.5" />
                </TooltipTrigger>
                <TooltipPopup side="top">Open file tree</TooltipPopup>
              </Tooltip>
              <ProjectSortMenu
                projectSortOrder={appSettings.sidebarProjectSortOrder}
                threadSortOrder={appSettings.sidebarThreadSortOrder}
                onProjectSortOrderChange={(sortOrder) => {
                  updateSettings({ sidebarProjectSortOrder: sortOrder });
                }}
                onThreadSortOrderChange={(sortOrder) => {
                  updateSettings({ sidebarThreadSortOrder: sortOrder });
                }}
              />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={shouldShowProjectPathEntry ? "Cancel add project" : "Add project"}
                      aria-pressed={shouldShowProjectPathEntry}
                      className="inline-flex size-5 cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
                      onClick={handleStartAddProject}
                    />
                  }
                >
                  <PlusIcon
                    className={`size-3.5 transition-transform duration-150 ${
                      shouldShowProjectPathEntry ? "rotate-45" : "rotate-0"
                    }`}
                  />
                </TooltipTrigger>
                <TooltipPopup side="right">
                  {shouldShowProjectPathEntry ? "Cancel add project" : "Add project"}
                </TooltipPopup>
              </Tooltip>
            </div>
          </div>

          {shouldShowProjectPathEntry && (
            <div className="mb-2 px-1">
              <button
                type="button"
                className="mb-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary py-1.5 text-xs text-foreground/80 transition-[background-color,border-color,color] duration-150 ease-out hover:border-border/80 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handlePickFolder()}
                disabled={isPickingFolder || isAddingProject}
              >
                <FolderIcon className="size-3.5" />
                {isPickingFolder ? "Picking folder..." : "Browse for folder"}
              </button>
              <button
                type="button"
                className="mb-1.5 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary py-1.5 text-xs text-foreground/80 transition-[background-color,border-color,color] duration-150 ease-out hover:border-border/80 hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => setCloneDialogOpen(true)}
                disabled={isAddingProject}
              >
                <GitBranchIcon className="size-3.5" />
                Clone from GitHub
              </button>
              {!manualProjectPathEntry && (
                <button
                  type="button"
                  className="mb-1.5 w-full text-left text-[11px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
                  onClick={() => {
                    setManualProjectPathEntry(true);
                    queueMicrotask(() => addProjectInputRef.current?.focus());
                  }}
                >
                  Type path instead
                </button>
              )}
              <div className="flex gap-1.5">
                <input
                  ref={addProjectInputRef}
                  className={`min-w-0 flex-1 rounded-md border bg-secondary px-2 py-1 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none transition-[border-color,box-shadow] duration-150 ease-out ${
                    addProjectError
                      ? "border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                      : "border-border focus:border-ring focus:ring-1 focus:ring-ring/20"
                  } ${!manualProjectPathEntry ? "cursor-pointer" : ""}`}
                  readOnly={!manualProjectPathEntry}
                  placeholder={
                    manualProjectPathEntry ? "/path/to/project" : "Click to choose folder"
                  }
                  value={newCwd}
                  onChange={(event) => {
                    setNewCwd(event.target.value);
                    setAddProjectError(null);
                  }}
                  onClick={() => {
                    if (!manualProjectPathEntry) {
                      void handlePickFolder();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAddProject();
                    if (event.key === "Escape") {
                      setAddingProject(false);
                      setAddProjectError(null);
                      setManualProjectPathEntry(false);
                    }
                  }}
                  autoFocus={manualProjectPathEntry}
                />
                <Button
                  type="button"
                  size="xs"
                  className="rounded-md"
                  onClick={handleAddProject}
                  disabled={!canAddProject}
                >
                  {isAddingProject ? "Adding..." : "Add"}
                </Button>
              </div>
              {addProjectError && (
                <p className="mt-1 px-0.5 text-[11px] leading-tight text-red-400">
                  {addProjectError}
                </p>
              )}
              <div className="mt-1.5 px-0.5">
                <button
                  type="button"
                  className="text-[11px] text-muted-foreground/50 transition-colors hover:text-muted-foreground"
                  onClick={() => {
                    setAddingProject(false);
                    setAddProjectError(null);
                    setManualProjectPathEntry(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isManualProjectSorting ? (
            <DndContext
              sensors={projectDnDSensors}
              collisionDetection={projectCollisionDetection}
              modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
              onDragStart={handleProjectDragStart}
              onDragEnd={handleProjectDragEnd}
              onDragCancel={handleProjectDragCancel}
            >
              <SidebarMenu>
                <SortableContext
                  items={sortedProjects.map((project) => project.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedProjects.map((project) => (
                    <SortableProjectItem key={project.id} projectId={project.id}>
                      {(dragHandleProps) => renderProjectItem(project, dragHandleProps)}
                    </SortableProjectItem>
                  ))}
                </SortableContext>
              </SidebarMenu>
            </DndContext>
          ) : (
            <SidebarMenu className="gap-0.5">
              {sortedProjects.map((project) => (
                <SidebarMenuItem key={project.id} className="rounded-md">
                  {renderProjectItem(project, null)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          )}

          {projects.length === 0 && !shouldShowProjectPathEntry && (
            <div className="px-2 pt-4 text-center text-xs text-muted-foreground/60">
              No projects yet
            </div>
          )}
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        <SidebarMenu>
          {isOnSubPage ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="sm"
                className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                onClick={() => window.history.back()}
              >
                <ArrowLeftIcon className="size-3.5" />
                <span className="text-xs">Back</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="sm"
                  className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  onClick={() => void navigate({ to: "/pr-review" })}
                >
                  <ExternalLinkIcon className="size-3.5" />
                  <span className="text-xs">Open Workspace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="sm"
                  className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  onClick={() => void navigate({ to: "/settings" })}
                >
                  <SettingsIcon className="size-3.5" />
                  <span className="text-xs">Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>

      <CloneRepositoryDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        onCloned={handleCloneComplete}
      />
    </>
  );
}
