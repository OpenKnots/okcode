import { type ProjectEntry, type ModelSlug, type ProviderKind } from "@okcode/contracts";
import { memo } from "react";
import { type ComposerSlashCommand, type ComposerTriggerKind } from "../../composer-logic";
import { BotIcon, PuzzleIcon, TerminalSquareIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { Command, CommandItem, CommandList } from "../ui/command";
import { VscodeEntryIcon } from "./VscodeEntryIcon";

export type ComposerCommandItem =
  | {
      id: string;
      type: "path";
      path: string;
      pathKind: ProjectEntry["kind"];
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "slash-command";
      command: ComposerSlashCommand;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "model";
      provider: ProviderKind;
      model: ModelSlug;
      label: string;
      description: string;
    }
  | {
      id: string;
      type: "skill";
      skillName: string;
      scope: "global" | "project";
      label: string;
      description: string;
      tags: readonly string[];
    }
  | {
      id: string;
      type: "skill-subcommand";
      subcommand: string;
      label: string;
      description: string;
      usage: string;
    };

export const ComposerCommandMenu = memo(function ComposerCommandMenu(props: {
  items: ComposerCommandItem[];
  resolvedTheme: "light" | "dark";
  isLoading: boolean;
  triggerKind: ComposerTriggerKind | null;
  activeItemId: string | null;
  onHighlightedItemChange: (itemId: string | null) => void;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  return (
    <Command
      mode="none"
      onItemHighlighted={(highlightedValue) => {
        props.onHighlightedItemChange(
          typeof highlightedValue === "string" ? highlightedValue : null,
        );
      }}
    >
      <div className="relative overflow-hidden rounded-xl border border-border/80 bg-popover/96 shadow-lg/8 backdrop-blur-xs">
        <CommandList className="max-h-64">
          {props.items.map((item) => (
            <ComposerCommandMenuItem
              key={item.id}
              item={item}
              resolvedTheme={props.resolvedTheme}
              isActive={props.activeItemId === item.id}
              onSelect={props.onSelect}
            />
          ))}
        </CommandList>
        {props.items.length === 0 && (
          <p className="px-3 py-2 text-muted-foreground/70 text-xs">
            {props.isLoading
              ? props.triggerKind === "slash-skill"
                ? "Loading skills..."
                : "Searching workspace files..."
              : props.triggerKind === "path"
                ? "No matching files or folders."
                : props.triggerKind === "slash-skill"
                  ? "No matching skills."
                  : "No matching command."}
          </p>
        )}
      </div>
    </Command>
  );
});

const ComposerCommandMenuItem = memo(function ComposerCommandMenuItem(props: {
  item: ComposerCommandItem;
  resolvedTheme: "light" | "dark";
  isActive: boolean;
  onSelect: (item: ComposerCommandItem) => void;
}) {
  return (
    <CommandItem
      value={props.item.id}
      className={cn(
        "cursor-pointer select-none gap-2",
        props.isActive && "bg-accent text-accent-foreground",
      )}
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        props.onSelect(props.item);
      }}
    >
      {props.item.type === "path" ? (
        <VscodeEntryIcon
          pathValue={props.item.path}
          kind={props.item.pathKind}
          theme={props.resolvedTheme}
        />
      ) : null}
      {props.item.type === "slash-command" ? (
        <BotIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      {props.item.type === "model" ? (
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          model
        </Badge>
      ) : null}
      {props.item.type === "skill" ? (
        <div className="flex items-center gap-1">
          <PuzzleIcon className="size-4 text-muted-foreground/80" />
          <Badge variant="outline" className="px-1 py-0 text-[9px] leading-tight">
            {props.item.scope}
          </Badge>
        </div>
      ) : null}
      {props.item.type === "skill-subcommand" ? (
        <TerminalSquareIcon className="size-4 text-muted-foreground/80" />
      ) : null}
      <span className="flex min-w-0 items-center gap-1.5 truncate">
        <span className="truncate">{props.item.label}</span>
      </span>
      <span className="truncate text-muted-foreground/70 text-xs">{props.item.description}</span>
      {props.item.type === "skill" && props.item.tags.length > 0 ? (
        <span className="ml-auto flex gap-1">
          {props.item.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="px-1 py-0 text-[9px]">
              {tag}
            </Badge>
          ))}
        </span>
      ) : null}
    </CommandItem>
  );
});
