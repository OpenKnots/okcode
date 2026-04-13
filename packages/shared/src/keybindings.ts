import type {
  KeybindingCommand,
  KeybindingRule,
  KeybindingShortcut,
  ResolvedKeybindingsConfig,
} from "@okcode/contracts";

export interface HotkeyCommandDefinition {
  readonly command: KeybindingCommand;
  readonly title: string;
  readonly description: string;
  readonly group: "Workspace" | "Terminal";
  readonly when?: string;
  readonly contextLabel: string;
}

export const DEFAULT_KEYBINDINGS: ReadonlyArray<KeybindingRule> = [
  { key: "mod+j", command: "terminal.toggle" },
  { key: "ctrl+`", command: "terminal.toggle" },
  { key: "mod+d", command: "terminal.split", when: "terminalFocus" },
  { key: "mod+n", command: "terminal.new", when: "terminalFocus" },
  { key: "mod+w", command: "terminal.close", when: "terminalFocus" },
  { key: "mod+n", command: "chat.new", when: "!terminalFocus" },
  { key: "mod+shift+o", command: "chat.new", when: "!terminalFocus" },
  { key: "mod+shift+n", command: "chat.newLocal", when: "!terminalFocus" },
  { key: "mod+down", command: "git.pullRequest", when: "!terminalFocus" },
  { key: "mod+shift+p", command: "git.pullRequest", when: "!terminalFocus" },
  { key: "mod+o", command: "editor.openFavorite" },
] as const;

export const HOTKEY_COMMAND_DEFINITIONS = [
  {
    command: "chat.new",
    title: "New thread",
    description: "Start a fresh conversation in the current project.",
    group: "Workspace",
    when: "!terminalFocus",
    contextLabel: "When the terminal is not focused",
  },
  {
    command: "chat.newLocal",
    title: "New local thread",
    description: "Start a local or worktree-backed thread without leaving the current project.",
    group: "Workspace",
    when: "!terminalFocus",
    contextLabel: "When the terminal is not focused",
  },
  {
    command: "git.pullRequest",
    title: "Pull request",
    description: "Open the active pull request or start the PR flow for the current branch.",
    group: "Workspace",
    when: "!terminalFocus",
    contextLabel: "When the terminal is not focused",
  },
  {
    command: "editor.openFavorite",
    title: "Favorite editor",
    description: "Jump straight to the editor you last used for this project.",
    group: "Workspace",
    contextLabel: "Available anywhere",
  },
  {
    command: "terminal.toggle",
    title: "Toggle terminal",
    description: "Show or hide the terminal drawer from anywhere in the app.",
    group: "Terminal",
    contextLabel: "Available anywhere",
  },
  {
    command: "terminal.split",
    title: "Split terminal",
    description: "Open another terminal pane beside the active one.",
    group: "Terminal",
    when: "terminalFocus",
    contextLabel: "When the terminal is focused",
  },
  {
    command: "terminal.new",
    title: "New terminal",
    description: "Create a fresh terminal session while you stay in context.",
    group: "Terminal",
    when: "terminalFocus",
    contextLabel: "When the terminal is focused",
  },
  {
    command: "terminal.close",
    title: "Close terminal",
    description: "Close the active terminal session.",
    group: "Terminal",
    when: "terminalFocus",
    contextLabel: "When the terminal is focused",
  },
] as const satisfies ReadonlyArray<HotkeyCommandDefinition>;

export interface ShortcutRecordingEventLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

function isMacLikePlatform(platform: string): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function normalizeKeyToken(token: string): string {
  if (token === "space") return " ";
  if (token === "esc") return "escape";
  return token;
}

export function parseKeybindingShortcut(value: string): KeybindingShortcut | null {
  const rawTokens = value
    .toLowerCase()
    .split("+")
    .map((token) => token.trim());
  const tokens = [...rawTokens];
  let trailingEmptyCount = 0;
  while (tokens[tokens.length - 1] === "") {
    trailingEmptyCount += 1;
    tokens.pop();
  }
  if (trailingEmptyCount > 0) {
    tokens.push("+");
  }
  if (tokens.some((token) => token.length === 0)) {
    return null;
  }
  if (tokens.length === 0) return null;

  let key: string | null = null;
  let metaKey = false;
  let ctrlKey = false;
  let shiftKey = false;
  let altKey = false;
  let modKey = false;

  for (const token of tokens) {
    switch (token) {
      case "cmd":
      case "meta":
        metaKey = true;
        break;
      case "ctrl":
      case "control":
        ctrlKey = true;
        break;
      case "shift":
        shiftKey = true;
        break;
      case "alt":
      case "option":
        altKey = true;
        break;
      case "mod":
        modKey = true;
        break;
      default: {
        if (key !== null) return null;
        key = normalizeKeyToken(token);
      }
    }
  }

  if (key === null) return null;
  return {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    altKey,
    modKey,
  };
}

export function encodeKeybindingShortcut(shortcut: KeybindingShortcut): string | null {
  const modifiers: string[] = [];
  if (shortcut.modKey) modifiers.push("mod");
  if (shortcut.metaKey) modifiers.push("meta");
  if (shortcut.ctrlKey) modifiers.push("ctrl");
  if (shortcut.altKey) modifiers.push("alt");
  if (shortcut.shiftKey) modifiers.push("shift");
  if (!shortcut.key) return null;
  if (shortcut.key !== "+" && shortcut.key.includes("+")) return null;
  const key = shortcut.key === " " ? "space" : shortcut.key === "escape" ? "esc" : shortcut.key;
  return [...modifiers, key].join("+");
}

export function normalizeRecordedShortcutKeyToken(key: string): string | null {
  const normalized = key.toLowerCase();
  if (
    normalized === "meta" ||
    normalized === "os" ||
    normalized === "control" ||
    normalized === "ctrl" ||
    normalized === "shift" ||
    normalized === "alt" ||
    normalized === "option" ||
    normalized === "capslock" ||
    normalized === "dead"
  ) {
    return null;
  }
  if (normalized === " " || normalized === "spacebar") return "space";
  if (normalized === "escape" || normalized === "esc") return "esc";
  if (normalized === "up") return "arrowup";
  if (normalized === "down") return "arrowdown";
  if (normalized === "left") return "arrowleft";
  if (normalized === "right") return "arrowright";
  if (
    normalized === "arrowup" ||
    normalized === "arrowdown" ||
    normalized === "arrowleft" ||
    normalized === "arrowright" ||
    normalized === "enter" ||
    normalized === "tab" ||
    normalized === "backspace" ||
    normalized === "delete" ||
    normalized === "home" ||
    normalized === "end" ||
    normalized === "pageup" ||
    normalized === "pagedown"
  ) {
    return normalized;
  }
  if (/^f\d{1,2}$/.test(normalized)) return normalized;
  if (normalized.length === 1 && !/\s/.test(normalized)) return normalized;
  return null;
}

export function keybindingValueFromShortcutEvent(
  event: ShortcutRecordingEventLike,
  platform: string,
): string | null {
  const keyToken = normalizeRecordedShortcutKeyToken(event.key);
  if (!keyToken) return null;

  const parts: string[] = [];
  if (isMacLikePlatform(platform)) {
    if (event.metaKey) parts.push("mod");
    if (event.ctrlKey) parts.push("ctrl");
  } else {
    if (event.ctrlKey) parts.push("mod");
    if (event.metaKey) parts.push("meta");
  }
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  if (parts.length === 0) {
    return null;
  }
  parts.push(keyToken);
  return parts.join("+");
}

export function defaultKeybindingRulesForCommand(
  command: KeybindingCommand,
): ReadonlyArray<KeybindingRule> {
  return DEFAULT_KEYBINDINGS.filter((binding) => binding.command === command);
}

export function keybindingValuesForCommand(
  keybindings: ResolvedKeybindingsConfig,
  command: KeybindingCommand,
): string[] {
  const values: string[] = [];
  const seenValues = new Set<string>();

  for (const binding of keybindings) {
    if (!binding || binding.command !== command) continue;
    const encoded = encodeKeybindingShortcut(binding.shortcut);
    if (!encoded || seenValues.has(encoded)) continue;
    seenValues.add(encoded);
    values.push(encoded);
  }

  return values;
}
