import {
  MonitorIcon,
  PanelLeftIcon,
  PanelRightIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { useRightPanelStore } from "~/rightPanelStore";
import { useSidebar } from "../ui/sidebar";
import { Toggle, ToggleGroup, ToggleGroupSeparator } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface HeaderPanelsMenuProps {
  terminalAvailable: boolean;
  terminalOpen: boolean;
  terminalToggleShortcutLabel: string | null;
  onPrefetchTerminal: () => void;
  previewAvailable: boolean;
  previewOpen: boolean;
  onToggleTerminal: () => void;
  onTogglePreview: () => void;
}

export const HeaderPanelsMenu = memo(function HeaderPanelsMenu({
  terminalAvailable,
  terminalOpen,
  terminalToggleShortcutLabel,
  onPrefetchTerminal,
  previewAvailable,
  previewOpen,
  onToggleTerminal,
  onTogglePreview,
}: HeaderPanelsMenuProps) {
  const { open: sidebarOpen, toggleSidebar } = useSidebar();
  const rightPanelOpen = useRightPanelStore((s) => s.isOpen);
  const openRightPanel = useRightPanelStore((s) => s.open);
  const closeRightPanel = useRightPanelStore((s) => s.close);

  const toggleRightPanel = useCallback(() => {
    if (rightPanelOpen) {
      closeRightPanel();
    } else {
      openRightPanel();
    }
  }, [rightPanelOpen, openRightPanel, closeRightPanel]);

  const value = useMemo(() => {
    const v: string[] = [];
    if (sidebarOpen) v.push("sidebar");
    if (terminalOpen) v.push("terminal");
    if (rightPanelOpen) v.push("right-panel");
    if (previewOpen) v.push("preview");
    return v;
  }, [sidebarOpen, terminalOpen, rightPanelOpen, previewOpen]);

  return (
    <ToggleGroup value={value} variant="outline" size="xs" className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="sidebar"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <PanelLeftIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Sidebar</TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              value="terminal"
              disabled={!terminalAvailable}
              onClick={onToggleTerminal}
              onPointerEnter={onPrefetchTerminal}
              onFocus={onPrefetchTerminal}
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
              value="right-panel"
              onClick={toggleRightPanel}
              aria-label="Toggle right panel"
            >
              <PanelRightIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Right panel</TooltipPopup>
      </Tooltip>
    </ToggleGroup>
  );
});
