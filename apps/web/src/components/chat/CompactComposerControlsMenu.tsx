import { ProviderInteractionMode, RuntimeMode } from "@okcode/contracts";
import { memo, type ReactNode } from "react";
import { CheckIcon, EllipsisIcon, ListTodoIcon, SparklesIcon } from "lucide-react";
import { Button } from "../ui/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuTrigger,
} from "../ui/menu";
import { PROMPT_ENHANCEMENTS, type PromptEnhancementId } from "../../promptEnhancement";

export const CompactComposerControlsMenu = memo(function CompactComposerControlsMenu(props: {
  activePlan: boolean;
  interactionMode: ProviderInteractionMode;
  planSidebarOpen: boolean;
  runtimeMode: RuntimeMode;
  traitsMenuContent?: ReactNode;
  promptEnhancement?: PromptEnhancementId | null;
  promptEnhancementAvailable?: boolean;
  promptEnhancementBusy?: boolean;
  onPromptEnhancementChange?: (next: PromptEnhancementId | null) => void | Promise<void>;
  onInteractionModeChange: (mode: ProviderInteractionMode) => void;
  onTogglePlanSidebar: () => void;
  onToggleRuntimeMode: () => void;
}) {
  const showPromptEnhancement =
    typeof props.onPromptEnhancementChange === "function" &&
    props.promptEnhancementAvailable !== false;
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 px-2 text-muted-foreground/70 hover:text-foreground/80"
            aria-label="More composer controls"
          />
        }
      >
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </MenuTrigger>
      <MenuPopup align="start">
        {props.traitsMenuContent ? (
          <>
            {props.traitsMenuContent}
            <MenuDivider />
          </>
        ) : null}
        <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Mode</div>
        <MenuRadioGroup
          value={props.interactionMode}
          onValueChange={(value) => {
            if (!value || value === props.interactionMode) return;
            if (value === "code" || value === "plan") {
              props.onInteractionModeChange(value);
            }
          }}
        >
          <MenuRadioItem value="code">Code</MenuRadioItem>
          <MenuRadioItem value="plan">Plan</MenuRadioItem>
        </MenuRadioGroup>
        <MenuDivider />
        <div className="px-2 py-1.5 font-medium text-muted-foreground text-xs">Access</div>
        <MenuRadioGroup
          value={props.runtimeMode}
          onValueChange={(value) => {
            if (!value || value === props.runtimeMode) return;
            props.onToggleRuntimeMode();
          }}
        >
          <MenuRadioItem value="approval-required">Supervised</MenuRadioItem>
          <MenuRadioItem value="full-access">Full access</MenuRadioItem>
        </MenuRadioGroup>
        {props.activePlan ? (
          <>
            <MenuDivider />
            <MenuItem onClick={props.onTogglePlanSidebar}>
              <ListTodoIcon className="size-4 shrink-0" />
              {props.planSidebarOpen ? "Hide plan sidebar" : "Show plan sidebar"}
            </MenuItem>
          </>
        ) : null}
        {showPromptEnhancement ? (
          <>
            <MenuDivider />
            <div className="flex items-center gap-1.5 px-2 py-1.5 font-medium text-muted-foreground text-xs">
              <SparklesIcon className="size-3.5" aria-hidden="true" />
              <span>Prompt enhancement</span>
            </div>
            {PROMPT_ENHANCEMENTS.map((enhancement) => {
              const isSelected = props.promptEnhancement === enhancement.id;
              return (
                <MenuItem
                  key={enhancement.id}
                  disabled={props.promptEnhancementBusy === true}
                  onClick={() => {
                    void props.onPromptEnhancementChange?.(isSelected ? null : enhancement.id);
                  }}
                >
                  {isSelected ? (
                    <CheckIcon className="size-3.5 shrink-0 text-green-500" />
                  ) : (
                    <span className="size-3.5 shrink-0" />
                  )}
                  <span className="flex flex-col">
                    <span>{enhancement.label}</span>
                    <span className="text-muted-foreground/70 text-xs">
                      {enhancement.description}
                    </span>
                  </span>
                </MenuItem>
              );
            })}
          </>
        ) : null}
      </MenuPopup>
    </Menu>
  );
});
