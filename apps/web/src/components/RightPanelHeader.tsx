import { CodeIcon, FolderIcon, GitCompareIcon, PanelRightCloseIcon } from "lucide-react";
import { memo } from "react";
import { isElectron } from "~/env";
import { cn } from "~/lib/utils";
import { type RightPanelTab, useRightPanelStore } from "~/rightPanelStore";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

const TABS: readonly {
  id: RightPanelTab;
  label: string;
  icon: typeof FolderIcon;
}[] = [
  { id: "files", label: "Files", icon: FolderIcon },
  { id: "editor", label: "Editor", icon: CodeIcon },
  { id: "diffs", label: "Diffs", icon: GitCompareIcon },
];

export const RightPanelHeader = memo(function RightPanelHeader() {
  const activeTab = useRightPanelStore((s) => s.activeTab);
  const setActiveTab = useRightPanelStore((s) => s.setActiveTab);
  const close = useRightPanelStore((s) => s.close);

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-border/60 px-2",
        isElectron ? "drag-region h-[52px]" : "h-10",
      )}
    >
      <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger
                render={<button type="button" />}
                className={cn(
                  "flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground/60 hover:bg-accent/40 hover:text-foreground/80",
                )}
                onClick={() => {
                  if (isActive) {
                    close();
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
              >
                <Icon className="size-3.5" />
                <span className={cn("hidden sm:inline", isActive && "inline")}>{tab.label}</span>
              </TooltipTrigger>
              <TooltipPopup side="bottom" sideOffset={6}>
                {tab.label}
              </TooltipPopup>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" />}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-accent/40 hover:text-foreground/80 [-webkit-app-region:no-drag]"
          onClick={close}
          aria-label="Close panel"
        >
          <PanelRightCloseIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup side="bottom" sideOffset={6}>
          Close panel
        </TooltipPopup>
      </Tooltip>
    </div>
  );
});
