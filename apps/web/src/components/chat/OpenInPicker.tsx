import { memo } from "react";
import { FileCodeIcon } from "lucide-react";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export const OpenInPicker = memo(function OpenInPicker({
  codeViewerOpen,
  onToggleCodeViewer,
}: {
  codeViewerOpen: boolean;
  onToggleCodeViewer: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Toggle
            className="shrink-0"
            pressed={codeViewerOpen}
            onPressedChange={onToggleCodeViewer}
            aria-label="Toggle code viewer"
            variant="outline"
            size="xs"
          >
            <FileCodeIcon aria-hidden="true" className="size-3" />
          </Toggle>
        }
      />
      <TooltipPopup side="bottom">
        {codeViewerOpen ? "Hide code viewer" : "Show code viewer"}
      </TooltipPopup>
    </Tooltip>
  );
});
