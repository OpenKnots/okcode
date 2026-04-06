import { memo } from "react";
import { Menu, MenuTrigger, MenuPopup, MenuItem, MenuSeparator } from "~/components/ui/menu";
import { Switch } from "~/components/ui/switch";
import { EllipsisIcon } from "lucide-react";
import type { CodeViewerTab } from "~/codeViewerStore";
import { isMacPlatform } from "~/lib/utils";

interface TabContextMenuProps {
  tab: CodeViewerTab;
  onSave: () => void;
  onDiscard: () => void;
  onToggleDiffView: (enabled: boolean) => void;
  onToggleLineNumbers: (enabled: boolean) => void;
  onToggleWordWrap: (enabled: boolean) => void;
}

export const TabContextMenu = memo(function TabContextMenu({
  tab,
  onSave,
  onDiscard,
  onToggleDiffView,
  onToggleLineNumbers,
  onToggleWordWrap,
}: TabContextMenuProps) {
  return (
    <Menu>
      <MenuTrigger
        className="shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-accent/80 group-hover:opacity-100"
      >
        <EllipsisIcon className="size-3" />
      </MenuTrigger>
      <MenuPopup side="bottom" align="start" className="w-52">
        <MenuItem disabled={!tab.isDirty} onClick={onSave}>
          Save File
          <span className="ml-auto text-xs text-muted-foreground">
            {isMacPlatform(navigator.platform) ? "\u2318S" : "Ctrl+S"}
          </span>
        </MenuItem>
        <MenuItem disabled={!tab.isDirty} onClick={onDiscard}>
          Discard Changes
        </MenuItem>
        <MenuItem onClick={() => void navigator.clipboard.writeText(tab.relativePath)}>
          Copy Relative Path
        </MenuItem>
        <MenuSeparator />
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="text-sm">Diff View</span>
          <Switch checked={tab.showDiffView} onCheckedChange={onToggleDiffView} />
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="text-sm">Line Numbers</span>
          <Switch checked={tab.showLineNumbers} onCheckedChange={onToggleLineNumbers} />
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 text-sm">
          <span className="text-sm">Word Wrap</span>
          <Switch checked={tab.wordWrap} onCheckedChange={onToggleWordWrap} />
        </div>
      </MenuPopup>
    </Menu>
  );
});
