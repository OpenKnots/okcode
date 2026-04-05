import { memo, useMemo } from "react";
import { FileCodeIcon, FileDiffIcon, MonitorIcon, TerminalSquareIcon } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ToggleGroup, Toggle, ToggleGroupSeparator } from "../ui/toggle-group";

interface HeaderPanelsMenuProps {
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  codeViewerOpen: boolean;
  onToggleCodeViewer: () => void;
  diffViewerOpen: boolean;
  onToggleDiffViewer: () => void;
  previewAvailable: boolean;
  previewOpen: boolean;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
}

export const HeaderPanelsMenu = memo(function HeaderPanelsMenu({
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  codeViewerOpen,
  onToggleCodeViewer,
  diffViewerOpen,
  onToggleDiffViewer,
  previewAvailable,
  previewOpen,
  onToggleTerminal,
  onTogglePreview,
}: HeaderPanelsMenuProps) {
  const value = useMemo(() => {
    const v: string[] = [];
    if (terminalOpen) v.push("terminal");
    if (codeViewerOpen) v.push("code-viewer");
    if (diffViewerOpen) v.push("diff-viewer");
    if (previewOpen) v.push("preview");
    return v;
  }, [terminalOpen, codeViewerOpen, diffViewerOpen, previewOpen]);

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
          Terminal{terminalToggleShortcutLabel ? ` ${terminalToggleShortcutLabel}` : ""}
        </TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="code-viewer"
              onClick={onToggleCodeViewer}
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
              onClick={onToggleDiffViewer}
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
