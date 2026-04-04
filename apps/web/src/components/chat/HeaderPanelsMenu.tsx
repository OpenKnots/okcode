import { memo, useMemo } from "react";
import { DiffIcon, MonitorIcon, TerminalSquareIcon } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { ToggleGroup, Toggle, ToggleGroupSeparator } from "../ui/toggle-group";

interface HeaderPanelsMenuProps {
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  previewAvailable: boolean;
  previewOpen: boolean;
  diffOpen: boolean;
  diffToggleShortcutLabel: string | null;
  isGitRepo: boolean;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
  onToggleDiff: () => void;
}

export const HeaderPanelsMenu = memo(function HeaderPanelsMenu({
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  previewAvailable,
  previewOpen,
  diffOpen,
  diffToggleShortcutLabel,
  isGitRepo,
  onToggleTerminal,
  onTogglePreview,
  onToggleDiff,
}: HeaderPanelsMenuProps) {
  const value = useMemo(() => {
    const v: string[] = [];
    if (terminalOpen) v.push("terminal");
    if (previewOpen) v.push("preview");
    if (diffOpen) v.push("diff");
    return v;
  }, [terminalOpen, previewOpen, diffOpen]);

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
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="diff"
              disabled={!isGitRepo}
              onClick={onToggleDiff}
              aria-label="Toggle diff"
            >
              <DiffIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">
          Diff{diffToggleShortcutLabel ? ` ${diffToggleShortcutLabel}` : ""}
        </TooltipPopup>
      </Tooltip>
    </ToggleGroup>
  );
});
