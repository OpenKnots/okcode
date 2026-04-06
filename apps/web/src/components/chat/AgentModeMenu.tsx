import { memo, type ReactNode } from "react";
import {
  BlocksIcon,
  BugIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  DiamondIcon,
  ImageIcon,
  PlusIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "~/components/ui/badge";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "~/components/ui/menu";

interface AgentModeMenuProps {
  activeMode: string | null; // "plan" | "debug" | "ask" | null
  onModeChange: (mode: string | null) => void;
}

const modeConfig: Record<string, { icon: ReactNode; label: string }> = {
  plan: { icon: <SlidersHorizontalIcon className="size-3.5" />, label: "Plan" },
  debug: { icon: <BugIcon className="size-3.5" />, label: "Debug" },
  ask: { icon: <CircleHelpIcon className="size-3.5" />, label: "Ask" },
};

export const AgentModeMenu = memo(function AgentModeMenu({
  activeMode,
  onModeChange,
}: AgentModeMenuProps) {
  const activeModeInfo = activeMode ? modeConfig[activeMode] : null;

  return (
    <div className="flex items-center gap-1.5">
      <Menu>
        <MenuTrigger
          render={
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/70 hover:text-foreground/80 hover:bg-accent transition-colors [-webkit-app-region:no-drag]"
              aria-label="Add agent mode"
            />
          }
        >
          <PlusIcon className="size-4" />
        </MenuTrigger>
        <MenuPopup side="top" align="start" className="w-48">
          <MenuRadioGroup
            value={activeMode ?? ""}
            onValueChange={(value) => onModeChange(value || null)}
          >
            <MenuRadioItem value="plan">
              <SlidersHorizontalIcon className="size-4 mr-2" /> Plan
            </MenuRadioItem>
            <MenuRadioItem value="debug">
              <BugIcon className="size-4 mr-2" /> Debug
            </MenuRadioItem>
            <MenuRadioItem value="ask">
              <CircleHelpIcon className="size-4 mr-2" /> Ask
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem>
            <ImageIcon className="size-4 mr-2" /> Image
          </MenuItem>
          <MenuItem>
            <BlocksIcon className="size-4 mr-2" /> Skills{" "}
            <ChevronRightIcon className="size-3 ml-auto" />
          </MenuItem>
          <MenuItem>
            <DiamondIcon className="size-4 mr-2" /> MCP Servers{" "}
            <ChevronRightIcon className="size-3 ml-auto" />
          </MenuItem>
        </MenuPopup>
      </Menu>

      {activeMode && activeModeInfo && (
        <Badge
          variant="outline"
          className="gap-1 rounded-lg border-primary/20 bg-primary/5 text-primary text-xs"
        >
          {activeModeInfo.icon} {activeModeInfo.label}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onModeChange(null);
            }}
            className="ml-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 hover:text-foreground transition-colors"
            aria-label={`Remove ${activeModeInfo.label} mode`}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      )}
    </div>
  );
});
