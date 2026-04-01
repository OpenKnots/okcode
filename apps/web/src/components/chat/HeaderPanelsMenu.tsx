import { memo } from "react";
import {
  DiffIcon,
  EllipsisIcon,
  FileCodeIcon,
  MonitorIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Menu, MenuCheckboxItem, MenuPopup, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface HeaderPanelsMenuProps {
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  previewAvailable: boolean;
  previewOpen: boolean;
  diffOpen: boolean;
  diffToggleShortcutLabel: string | null;
  isGitRepo: boolean;
  codeViewerOpen: boolean;
  hasCodeViewerTabs: boolean;
  hasProject: boolean;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
  onToggleDiff: () => void;
  onToggleCodeViewer: () => void;
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
  codeViewerOpen,
  hasCodeViewerTabs,
  hasProject,
  onToggleTerminal,
  onTogglePreview,
  onToggleDiff,
  onToggleCodeViewer,
}: HeaderPanelsMenuProps) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <Button variant="outline" size="xs" className="shrink-0" aria-label="Toggle panels">
                  <EllipsisIcon className="size-3.5" />
                </Button>
              }
            />
          }
        />
        <TooltipPopup side="bottom">Panels</TooltipPopup>
      </Tooltip>
      <MenuPopup side="bottom" align="end" sideOffset={6}>
        <MenuCheckboxItem
          checked={terminalOpen}
          onCheckedChange={onToggleTerminal}
          disabled={!terminalAvailable}
          variant="switch"
        >
          <span className="inline-flex items-center gap-2">
            <TerminalSquareIcon className="size-3.5 opacity-80" />
            Terminal
            {terminalToggleShortcutLabel ? (
              <kbd className="ml-auto text-[10px] text-muted-foreground">
                {terminalToggleShortcutLabel}
              </kbd>
            ) : null}
          </span>
        </MenuCheckboxItem>
        <MenuCheckboxItem
          checked={previewOpen}
          onCheckedChange={onTogglePreview}
          disabled={!previewAvailable}
          variant="switch"
        >
          <span className="inline-flex items-center gap-2">
            <MonitorIcon className="size-3.5 opacity-80" />
            Preview
          </span>
        </MenuCheckboxItem>
        <MenuSeparator />
        <MenuCheckboxItem
          checked={diffOpen}
          onCheckedChange={onToggleDiff}
          disabled={!isGitRepo}
          variant="switch"
        >
          <span className="inline-flex items-center gap-2">
            <DiffIcon className="size-3.5 opacity-80" />
            Diff
            {diffToggleShortcutLabel ? (
              <kbd className="ml-auto text-[10px] text-muted-foreground">
                {diffToggleShortcutLabel}
              </kbd>
            ) : null}
          </span>
        </MenuCheckboxItem>
        {hasProject && hasCodeViewerTabs ? (
          <MenuCheckboxItem
            checked={codeViewerOpen}
            onCheckedChange={onToggleCodeViewer}
            variant="switch"
          >
            <span className="inline-flex items-center gap-2">
              <FileCodeIcon className="size-3.5 opacity-80" />
              Code viewer
            </span>
          </MenuCheckboxItem>
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
