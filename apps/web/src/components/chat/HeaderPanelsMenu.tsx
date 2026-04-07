import {
  FileCodeIcon,
  FileDiffIcon,
  FolderIcon,
  MonitorIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { type RightPanelTab, useRightPanelStore } from "~/rightPanelStore";
import { Toggle, ToggleGroup, ToggleGroupSeparator } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface HeaderPanelsMenuProps {
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  previewAvailable: boolean;
  previewOpen: boolean;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
}

export const HeaderPanelsMenu = memo(function HeaderPanelsMenu({
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  previewAvailable,
  previewOpen,
  onToggleTerminal,
  onTogglePreview,
}: HeaderPanelsMenuProps) {
  const rightPanelOpen = useRightPanelStore((s) => s.isOpen);
  const rightPanelTab = useRightPanelStore((s) => s.activeTab);
  const openRightPanel = useRightPanelStore((s) => s.open);
  const closeRightPanel = useRightPanelStore((s) => s.close);

  const toggleRightPanelTab = useCallback(
    (tab: RightPanelTab) => {
      if (rightPanelOpen && rightPanelTab === tab) {
        closeRightPanel();
      } else {
        openRightPanel(tab);
      }
    },
    [rightPanelOpen, rightPanelTab, openRightPanel, closeRightPanel],
  );

  const value = useMemo(() => {
    const v: string[] = [];
    if (terminalOpen) v.push("terminal");
    if (rightPanelOpen) {
      if (rightPanelTab === "files") v.push("files");
      if (rightPanelTab === "editor") v.push("code-viewer");
      if (rightPanelTab === "diffs") v.push("diff-viewer");
    }
    if (previewOpen) v.push("preview");
    return v;
  }, [terminalOpen, rightPanelOpen, rightPanelTab, previewOpen]);

  return (
    <ToggleGroup value={value} variant="outline" size="xs" className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="terminal"
              disabled={!terminalAvailable}
              onClick={onToggleTerminal}
              aria-label="Toggle terminal"
            >
              <TerminalSquareIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">
          Terminal
          {terminalToggleShortcutLabel ? ` ${terminalToggleShortcutLabel}` : ""}
        </TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="files"
              onClick={() => toggleRightPanelTab("files")}
              aria-label="Toggle file tree"
            >
              <FolderIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Files</TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="code-viewer"
              onClick={() => toggleRightPanelTab("editor")}
              aria-label="Toggle code viewer"
            >
              <FileCodeIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Code viewer</TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="diff-viewer"
              onClick={() => toggleRightPanelTab("diffs")}
              aria-label="Toggle diffs viewer"
            >
              <FileDiffIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Diffs viewer</TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="preview"
              disabled={!previewAvailable}
              onClick={onTogglePreview}
              aria-label="Toggle preview"
            >
              <MonitorIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Preview</TooltipPopup>
      </Tooltip>
    </ToggleGroup>
  );
});
