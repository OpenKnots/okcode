import type {
  ProjectId,
  ProjectScript,
  ResolvedKeybindingsConfig,
  ThreadId,
} from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ExternalLinkIcon, GitPullRequestIcon } from "lucide-react";
import { memo, useCallback, useEffect } from "react";
import { useThreadTitleEditor } from "~/hooks/useThreadTitleEditor";
import { shortcutLabelsForCommand } from "~/keybindings";
import type { ClientMode } from "~/lib/clientMode";
import { gitStatusQueryOptions } from "~/lib/gitReactQuery";
import { openGitHubUrl } from "~/lib/openGitHubUrl";
import type { PreviewDock } from "~/previewStateStore";
import type { ProjectScriptDraft } from "~/projectScriptDefaults";
import { EditableThreadTitle } from "../EditableThreadTitle";
import GitActionsControl from "../GitActionsControl";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { HeaderPanelsMenu } from "./HeaderPanelsMenu";

interface ChatHeaderProps {
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  threadKind: "thread" | "project-chat";
  activeProjectId: ProjectId | undefined;
  activeProjectName: string | undefined;
  activeProjectCwd: string | undefined;
  isLocalDraftThread: boolean;
  openInCwd: string | null;
  activeProjectScripts: ProjectScript[] | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  previewAvailable: boolean;
  previewOpen: boolean;
  previewDock: PreviewDock;
  threadBranch: string | null;
  gitCwd: string | null;
  clientMode: ClientMode;
  onRenameDraftThreadTitle: (title: string) => void;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  onUpdateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  onDeleteProjectScript: (scriptId: string) => Promise<void>;
  onImportProjectScripts: (scripts: ProjectScriptDraft[]) => Promise<void>;
  onToggleTerminal: () => void;
  onPrefetchTerminal: () => void;
  onTogglePreview: () => void;
  onTogglePreviewLayout: () => void;
  onMinimize?: (() => void) | undefined;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadId,
  activeThreadTitle,
  threadKind,
  activeProjectId,
  activeProjectName,
  activeProjectCwd,
  isLocalDraftThread,
  threadBranch,
  openInCwd: _openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  previewAvailable,
  previewOpen,
  previewDock: _previewDock,
  gitCwd,
  clientMode,
  onRenameDraftThreadTitle,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onImportProjectScripts,
  onToggleTerminal,
  onPrefetchTerminal,
  onTogglePreview,
  onTogglePreviewLayout: _onTogglePreviewLayout,
  onMinimize,
}: ChatHeaderProps) {
  const isMobileCompanion = clientMode === "mobile";
  const {
    editingThreadId,
    draftTitle,
    bindInputRef,
    cancelEditing,
    commitEditing,
    setDraftTitle,
    startEditing,
  } = useThreadTitleEditor({
    onRenameDraftThread: (_threadId, title) => {
      onRenameDraftThreadTitle(title);
    },
  });
  const isEditingTitle = editingThreadId === activeThreadId;

  useEffect(() => {
    cancelEditing();
  }, [activeThreadId, cancelEditing]);

  // Derive PR status from git status when the thread has an associated branch
  const { data: gitStatus = null } = useQuery({
    ...gitStatusQueryOptions(gitCwd),
    // Only need git status for PR info when thread has a branch
    enabled: gitCwd !== null && threadBranch !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const threadPr =
    threadBranch !== null && gitStatus?.branch === threadBranch ? (gitStatus?.pr ?? null) : null;
  const pullRequestShortcutLabels = shortcutLabelsForCommand(keybindings, "git.pullRequest");
  const primaryPullRequestShortcutLabel = pullRequestShortcutLabels[0] ?? null;

  const openPrLink = useCallback(
    (url: string) => {
      void openGitHubUrl({
        url,
        projectId: activeProjectId ?? null,
        threadId: activeThreadId,
      }).catch((error) => {
        toastManager.add({
          type: "error",
          title: "Unable to open PR link",
          description: error instanceof Error ? error.message : "An error occurred.",
        });
      });
    },
    [activeProjectId, activeThreadId],
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Left: Identity — thread title + project context */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        {onMinimize && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-label="Minimize chat"
            className="size-7 shrink-0"
            onClick={onMinimize}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        )}
        {threadKind === "project-chat" ? (
          <div className="min-w-0 shrink [-webkit-app-region:no-drag]">
            <div className="truncate text-sm font-semibold text-foreground">
              {activeProjectName ?? activeThreadTitle}
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Project chat
            </div>
          </div>
        ) : (
          <EditableThreadTitle
            title={activeThreadTitle}
            isEditing={isEditingTitle}
            draftTitle={draftTitle}
            inputRef={bindInputRef}
            containerClassName="min-w-0 shrink [-webkit-app-region:no-drag]"
            titleClassName="min-w-0 truncate text-sm font-medium text-foreground"
            inputClassName="h-7 text-sm"
            showEditButton
            editButtonClassName="size-6"
            onStartEditing={() => {
              startEditing({
                threadId: activeThreadId,
                title: activeThreadTitle,
                isDraft: isLocalDraftThread,
              });
            }}
            onDraftTitleChange={setDraftTitle}
            onCommit={() => void commitEditing()}
            onCancel={cancelEditing}
          />
        )}
      </div>

      {/* Right: Actions — only primary actions visible, panels in overflow */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {!isMobileCompanion && activeProjectScripts && (
          <ProjectScriptsControl
            projectCwd={activeProjectCwd ?? ""}
            scripts={activeProjectScripts}
            keybindings={keybindings}
            preferredScriptId={preferredScriptId}
            onRunScript={onRunProjectScript}
            onAddScript={onAddProjectScript}
            onUpdateScript={onUpdateProjectScript}
            onDeleteScript={onDeleteProjectScript}
            onImportScripts={onImportProjectScripts}
          />
        )}
        {!isMobileCompanion && threadPr && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  aria-label={`Open PR #${threadPr.number}: ${threadPr.title}`}
                  className={`gap-1.5 pr-1.5 ${
                    threadPr.state === "open"
                      ? "border-emerald-500/40 text-emerald-700 dark:border-emerald-400/35 dark:text-emerald-200"
                      : threadPr.state === "merged"
                        ? "border-violet-500/40 text-violet-700 dark:border-violet-400/35 dark:text-violet-200"
                        : "border-border text-foreground"
                  }`}
                  onClick={() => openPrLink(threadPr.url)}
                >
                  <GitPullRequestIcon className="size-3.5" />
                  <span className="max-w-40 truncate">View PR #{threadPr.number}</span>
                  <ExternalLinkIcon className="size-3" />
                  {primaryPullRequestShortcutLabel ? (
                    <Kbd className="ml-0.5 hidden sm:inline-flex">
                      {primaryPullRequestShortcutLabel}
                    </Kbd>
                  ) : null}
                </Button>
              }
            />
            <TooltipPopup side="bottom">
              #{threadPr.number} PR {threadPr.state}: {threadPr.title}
              {pullRequestShortcutLabels.length > 0
                ? ` (${pullRequestShortcutLabels.join(" or ")})`
                : ""}
            </TooltipPopup>
          </Tooltip>
        )}
        {!isMobileCompanion && activeProjectName && (
          <GitActionsControl
            gitCwd={gitCwd}
            activeThreadId={activeThreadId}
            activeProjectId={activeProjectId ?? null}
          />
        )}
        {/* Overflow menu: all panel toggles consolidated */}
        {!isMobileCompanion && (
          <HeaderPanelsMenu
            terminalAvailable={terminalAvailable}
            terminalOpen={terminalOpen}
            terminalToggleShortcutLabel={terminalToggleShortcutLabel}
            onPrefetchTerminal={onPrefetchTerminal}
            previewAvailable={previewAvailable}
            previewOpen={previewOpen}
            onToggleTerminal={onToggleTerminal}
            onTogglePreview={onTogglePreview ?? (() => {})}
          />
        )}
      </div>
    </div>
  );
});
