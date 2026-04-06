import {
  type ProjectId,
  type ProjectScript,
  type ThreadId,
  type ResolvedKeybindingsConfig,
} from "@okcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon, GitPullRequestIcon } from "lucide-react";
import { memo, useCallback, useEffect } from "react";
import type { ProjectScriptDraft } from "~/projectScriptDefaults";
import GitActionsControl from "../GitActionsControl";
import { EditableThreadTitle } from "../EditableThreadTitle";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Kbd } from "../ui/kbd";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { SidebarTrigger } from "../ui/sidebar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useThreadTitleEditor } from "~/hooks/useThreadTitleEditor";
import { gitStatusQueryOptions } from "~/lib/gitReactQuery";
import { shortcutLabelsForCommand } from "~/keybindings";
import { ensureNativeApi } from "~/nativeApi";
import { useProjectColor } from "~/projectColors";
import { useTheme } from "~/hooks/useTheme";
import type { ClientMode } from "~/lib/clientMode";
import type { PreviewDock } from "~/previewStateStore";
import { HeaderPanelsMenu } from "./HeaderPanelsMenu";

interface ChatHeaderProps {
  activeThreadId: ThreadId;
  activeThreadTitle: string;
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
  codeViewerOpen: boolean;
  diffViewerOpen: boolean;
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
  onToggleCodeViewer: () => void;
  onToggleDiffViewer: () => void;
  onTogglePreview: () => void;
  onTogglePreviewLayout: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadId,
  activeThreadTitle,
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
  codeViewerOpen,
  diffViewerOpen,
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
  onToggleCodeViewer,
  onToggleDiffViewer,
  onTogglePreview,
  onTogglePreviewLayout: _onTogglePreviewLayout,
}: ChatHeaderProps) {
  const isMobileCompanion = clientMode === "mobile";
  const projectColor = useProjectColor(activeProjectId);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
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

  const openPrLink = useCallback((url: string) => {
    void ensureNativeApi().shell.openExternal(url);
  }, []);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Left: Identity — thread title + project context */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        <SidebarTrigger className="size-7 shrink-0" />
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
        {activeProjectName && (
          <Badge
            variant="outline"
            className="hidden min-w-0 shrink truncate border-transparent sm:inline-flex"
            style={
              projectColor
                ? {
                    color: isDark ? projectColor.textDark : projectColor.text,
                    backgroundColor: isDark ? projectColor.bgDark : projectColor.bg,
                  }
                : undefined
            }
          >
            {activeProjectName}
          </Badge>
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
                  <span className="max-w-40 truncate">
                    View PR #{threadPr.number}
                  </span>
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
          <GitActionsControl gitCwd={gitCwd} activeThreadId={activeThreadId} />
        )}
        {/* Overflow menu: all panel toggles consolidated */}
        {!isMobileCompanion && (
          <HeaderPanelsMenu
            terminalAvailable={terminalAvailable}
            terminalOpen={terminalOpen}
            terminalToggleShortcutLabel={terminalToggleShortcutLabel}
            codeViewerOpen={codeViewerOpen}
            onToggleCodeViewer={onToggleCodeViewer}
            diffViewerOpen={diffViewerOpen}
            onToggleDiffViewer={onToggleDiffViewer}
            previewAvailable={previewAvailable}
            previewOpen={previewOpen}
            onToggleTerminal={onToggleTerminal}
            onTogglePreview={onTogglePreview}
          />
        )}
      </div>
    </div>
  );
});
