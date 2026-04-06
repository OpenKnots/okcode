import { CheckIcon, SparklesIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "./ui/menu";
import {
  PROMPT_ENHANCEMENTS,
  getPromptEnhancementById,
  type PromptEnhancementId,
} from "../promptEnhancement";

interface PromptEnhancerProps {
  prompt: string;
  value: PromptEnhancementId | null;
  onChange: (nextValue: PromptEnhancementId | null) => void | Promise<void>;
  isEnhancing?: boolean;
  disabled?: boolean;
}

export default function PromptEnhancer({
  prompt,
  value,
  onChange,
  isEnhancing = false,
  disabled,
}: PromptEnhancerProps) {
  const hasPrompt = prompt.trim().length > 0;
  const activeEnhancement = getPromptEnhancementById(value);
  const canOpenMenu = !disabled && !isEnhancing && (hasPrompt || value !== null);

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            className={cn(
              isEnhancing && "text-foreground",
              activeEnhancement
                ? "text-foreground hover:text-foreground"
                : "text-muted-foreground/70 hover:text-foreground/80",
            )}
            disabled={!canOpenMenu}
            title={
              isEnhancing
                ? "Enhancing prompt"
                : activeEnhancement
                  ? `Prompt enhancement: ${activeEnhancement.label}`
                  : "Enhance prompt"
            }
            aria-label={
              isEnhancing
                ? "Enhancing prompt"
                : activeEnhancement
                  ? `Prompt enhancement: ${activeEnhancement.label}`
                  : "Enhance prompt"
            }
          />
        }
      >
        <SparklesIcon className={cn("size-4", isEnhancing && "animate-spin")} />
      </MenuTrigger>
      <MenuPopup align="end" side="top">
        <MenuGroup>
          <MenuGroupLabel>Enhance your prompt</MenuGroupLabel>
          <MenuSeparator />
          {PROMPT_ENHANCEMENTS.map((enhancement) => {
            const isSelected = value === enhancement.id;
            return (
              <MenuItem
                key={enhancement.id}
                disabled={isEnhancing}
                onClick={() => onChange(isSelected ? null : enhancement.id)}
              >
                <div className="flex items-center gap-2">
                  {isSelected ? (
                    <CheckIcon className="size-3.5 text-green-500" />
                  ) : (
                    <span className="size-3.5" />
                  )}
                  <div className="flex flex-col">
                    <span>{enhancement.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {isSelected
                        ? `${enhancement.description} • Select again to revert`
                        : enhancement.description}
                    </span>
                  </div>
                </div>
              </MenuItem>
            );
          })}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}
