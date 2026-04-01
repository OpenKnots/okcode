import {
  type ProjectScript,
  type ThreadId,
  type ResolvedKeybindingsConfig,
} from "@okcode/contracts";
import { memo, useEffect } from "react";
import type { ProjectScriptDraft } from "~/projectScriptDefaults";
import GitActionsControl from "../GitActionsControl";
import {
  ArrowLeftRightIcon,
  ArrowUpDownIcon,
  DiffIcon,
  MonitorIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { EditableThreadTitle } from "../EditableThreadTitle";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import ProjectScriptsControl, { type NewProjectScriptInput } from "../ProjectScriptsControl";
import { Toggle } from "../ui/toggle";
import { SidebarTrigger } from "../ui/sidebar";
import { useThreadTitleEditor } from "~/hooks/useThreadTitleEditor";
import { OpenInPicker } from "./OpenInPicker";
import { useCodeViewerStore } from "~/codeViewerStore";
import type { ClientMode } from "~/lib/clientMode";

import type { PreviewDock } from "~/previewStateStore";

interface ChatHeaderProps {
  activeThreadId: ThreadId;
  activeThreadTitle: string;
  activeProjectName: string | undefined;
  activeProjectCwd: string | undefined;
  isGitRepo: boolean;
  isLocalDraftThread: boolean;
  openInCwd: string | null;
  activeProjectScripts: ProjectScript[] | undefined;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  diffToggleShortcutLabel: string | null;
  previewAvailable: boolean;
  previewOpen: boolean;
  previewDock: PreviewDock;
  gitCwd: string | null;
  diffOpen: boolean;
  clientMode: ClientMode;
  onRenameDraftThreadTitle: (title: string) => void;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<void>;
  onUpdateProjectScript: (scriptId: string, input: NewProjectScriptInput) => Promise<void>;
  onDeleteProjectScript: (scriptId: string) => Promise<void>;
  onImportProjectScripts: (scripts: ProjectScriptDraft[]) => Promise<void>;
  onToggleTerminal: () => void;
  onToggleDiff: () => void;
  onTogglePreview: () => void;
  onTogglePreviewLayout: () => void;
  onToggleCodeViewer: () => void;
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadId,
  activeThreadTitle,
  activeProjectName,
  activeProjectCwd,
  isGitRepo,
  isLocalDraftThread,
  openInCwd: _openInCwd,
  activeProjectScripts,
  preferredScriptId,
  keybindings,
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  diffToggleShortcutLabel,
  previewAvailable,
  previewOpen,
  previewDock,
  gitCwd,
  diffOpen,
  clientMode,
  onRenameDraftThreadTitle,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
  onImportProjectScripts,
  onToggleTerminal,
  onToggleDiff,
  onTogglePreview,
  onTogglePreviewLayout,
  onToggleCodeViewer,
}: ChatHeaderProps) {
  const isMobileCompanion = clientMode === "mobile";
  const codeViewerOpen = useCodeViewerStore((state) => state.isOpen);
  const hasCodeViewerTabs = useCodeViewerStore((state) => state.tabs.length > 0);
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

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        <SidebarTrigger className="size-7 shrink-0 md:hidden" />
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
          <Badge variant="outline" className="min-w-0 shrink truncate">
            {activeProjectName}
          </Badge>
        )}
        {activeProjectName && !isGitRepo && (
          <Badge variant="outline" className="shrink-0 text-[10px] text-amber-700">
            No Git
          </Badge>
        )}
      </div>
      <div className="@container/header-actions flex min-w-0 flex-1 items-center justify-end gap-2 @sm/header-actions:gap-3">
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
        {activeProjectName && hasCodeViewerTabs && (
          <OpenInPicker codeViewerOpen={codeViewerOpen} onToggleCodeViewer={onToggleCodeViewer} />
        )}
        {!isMobileCompanion && activeProjectName && (
          <GitActionsControl gitCwd={gitCwd} activeThreadId={activeThreadId} />
        )}
        {!isMobileCompanion && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  className="shrink-0"
                  pressed={terminalOpen}
                  onPressedChange={onToggleTerminal}
                  aria-label="Toggle terminal drawer"
                  variant="outline"
                  size="xs"
                  disabled={!terminalAvailable}
                >
                  <TerminalSquareIcon className="size-3" />
                </Toggle>
              }
            />
            <TooltipPopup side="bottom">
              {!terminalAvailable
                ? "Terminal is unavailable until this thread has an active project."
                : terminalToggleShortcutLabel
                  ? `Toggle terminal drawer (${terminalToggleShortcutLabel})`
                  : "Toggle terminal drawer"}
            </TooltipPopup>
          </Tooltip>
        )}
        {!isMobileCompanion && previewOpen && previewAvailable ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  className="shrink-0"
                  pressed={previewDock === "top" || previewDock === "bottom"}
                  onPressedChange={onTogglePreviewLayout}
                  aria-label="Toggle preview split orientation"
                  variant="outline"
                  size="xs"
                >
                  {previewDock === "top" || previewDock === "bottom" ? (
                    <ArrowUpDownIcon className="size-3" />
                  ) : (
                    <ArrowLeftRightIcon className="size-3" />
                  )}
                </Toggle>
              }
            />
            <TooltipPopup side="bottom">
              {previewDock === "top" || previewDock === "bottom"
                ? "Switch to side-by-side preview"
                : "Switch to stacked preview"}
            </TooltipPopup>
          </Tooltip>
        ) : null}
        {!isMobileCompanion && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Toggle
                  className="shrink-0"
                  pressed={previewOpen}
                  onPressedChange={onTogglePreview}
                  aria-label="Toggle preview panel"
                  variant="outline"
                  size="xs"
                  disabled={!previewAvailable}
                >
                  <MonitorIcon className="size-3" />
                </Toggle>
              }
            />
            <TooltipPopup side="bottom">
              {!previewAvailable
                ? "Preview is available in the desktop app when this thread has an active project."
                : previewOpen
                  ? "Hide preview panel"
                  : "Show preview panel"}
            </TooltipPopup>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Toggle
                className="shrink-0"
                pressed={diffOpen}
                onPressedChange={onToggleDiff}
                aria-label="Toggle diff panel"
                variant="outline"
                size="xs"
                disabled={!isGitRepo}
              >
                <DiffIcon className="size-3" />
              </Toggle>
            }
          />
          <TooltipPopup side="bottom">
            {!isGitRepo
              ? "Diff panel is unavailable because this project is not a git repository."
              : diffToggleShortcutLabel
                ? `Toggle diff panel (${diffToggleShortcutLabel})`
                : "Toggle diff panel"}
          </TooltipPopup>
        </Tooltip>
      </div>
    </div>
  );
});
