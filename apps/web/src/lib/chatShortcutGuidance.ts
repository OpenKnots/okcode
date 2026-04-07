import type { KeybindingCommand, ResolvedKeybindingsConfig } from "@okcode/contracts";

import { shortcutLabelsForCommand } from "~/keybindings";

export interface ChatShortcutGuideDefinition {
  id: string;
  command: KeybindingCommand;
  title: string;
  description: string;
}

export interface ChatShortcutGuide extends ChatShortcutGuideDefinition {
  shortcutLabels: string[];
}

export const CHAT_SHORTCUT_GUIDE_DEFINITIONS = [
  {
    id: "new-thread",
    command: "chat.new",
    title: "New thread",
    description: "Open a fresh conversation without leaving the current project.",
  },
  {
    id: "new-local-thread",
    command: "chat.newLocal",
    title: "Local thread",
    description: "Create a thread in a local or worktree-backed environment.",
  },
  {
    id: "toggle-terminal",
    command: "terminal.toggle",
    title: "Terminal",
    description: "Keep the shell one shortcut away while you chat.",
  },
  {
    id: "favorite-editor",
    command: "editor.openFavorite",
    title: "Favorite editor",
    description: "Jump straight to the editor you last used on this project.",
  },
  {
    id: "pull-request",
    command: "git.pullRequest",
    title: "Pull request",
    description: "Jump to the current PR or start the PR flow for the active branch.",
  },
] as const satisfies readonly ChatShortcutGuideDefinition[];

export function buildChatShortcutGuides(
  keybindings: ResolvedKeybindingsConfig,
  platform: string,
): ChatShortcutGuide[] {
  return CHAT_SHORTCUT_GUIDE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    command: definition.command,
    title: definition.title,
    description: definition.description,
    shortcutLabels: shortcutLabelsForCommand(keybindings, definition.command, platform),
  }));
}
