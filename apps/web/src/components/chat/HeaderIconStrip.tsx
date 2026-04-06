import { memo } from "react";
import { SearchIcon, GlobeIcon } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { ToggleGroup, Toggle, ToggleGroupSeparator } from "~/components/ui/toggle-group";

interface HeaderIconStripProps {
  onSearch: () => void;
  onBrowser: () => void;
  previewOpen?: boolean;
}

export const HeaderIconStrip = memo(function HeaderIconStrip({
  onSearch,
  onBrowser,
  previewOpen,
}: HeaderIconStripProps) {
  const value = previewOpen ? ["browser"] : [];

  return (
    <ToggleGroup value={value} variant="outline" size="xs" className="shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle value="search" onClick={onSearch} aria-label="Search">
              <SearchIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Search</TooltipPopup>
      </Tooltip>
      <ToggleGroupSeparator />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle value="browser" onClick={onBrowser} aria-label="Browser">
              <GlobeIcon className="size-3.5" />
            </Toggle>
          }
        />
        <TooltipPopup side="bottom">Browser</TooltipPopup>
      </Tooltip>
    </ToggleGroup>
  );
});
