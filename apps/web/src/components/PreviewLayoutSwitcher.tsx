import type { ProjectId } from "@okcode/contracts";
import { Maximize2Icon, PanelRightIcon, PanelTopIcon, PictureInPicture2Icon } from "lucide-react";

import { readDesktopPreviewBridge } from "~/desktopPreview";
import { cn } from "~/lib/utils";
import { type PreviewLayoutMode, usePreviewStateStore } from "~/previewStateStore";

import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

const LAYOUT_MODE_OPTIONS: {
  id: PreviewLayoutMode;
  label: string;
  Icon: typeof PanelTopIcon;
}[] = [
  { id: "top", label: "Top dock", Icon: PanelTopIcon },
  { id: "side", label: "Side by side", Icon: PanelRightIcon },
  { id: "fullscreen", label: "Full screen", Icon: Maximize2Icon },
  { id: "popout", label: "Pop out", Icon: PictureInPicture2Icon },
];

interface PreviewLayoutSwitcherProps {
  projectId: ProjectId;
}

export function PreviewLayoutSwitcher({ projectId }: PreviewLayoutSwitcherProps) {
  const layoutMode = usePreviewStateStore(
    (state) => state.layoutModeByProjectId[projectId] ?? "top",
  );
  const setProjectLayoutMode = usePreviewStateStore((state) => state.setProjectLayoutMode);

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5">
      {LAYOUT_MODE_OPTIONS.map(({ id, label, Icon }) => {
        const isActive = layoutMode === id;
        return (
          <Tooltip key={id}>
            <TooltipTrigger
              className={cn(
                "inline-flex h-5 w-5 cursor-default items-center justify-center rounded transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground/55 hover:text-foreground",
              )}
              aria-label={label}
              aria-pressed={isActive}
              onClick={() => {
                setProjectLayoutMode(projectId, id);
                // Trigger Electron pop-out/pop-in when switching to/from popout mode.
                const bridge = readDesktopPreviewBridge();
                if (id === "popout") {
                  void bridge?.popOut();
                } else if (layoutMode === "popout") {
                  void bridge?.popIn();
                }
              }}
            >
              <Icon className="size-3" />
            </TooltipTrigger>
            <TooltipPopup side="bottom" sideOffset={6}>
              {label}
            </TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
}
