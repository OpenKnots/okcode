import {
  MAX_SCRIPT_ID_LENGTH,
  SCRIPT_RUN_COMMAND_PATTERN,
  type KeybindingCommand,
  type ProjectScript,
} from "@okcode/contracts";
import { Schema } from "effect";

const PROJECT_SCRIPT_TEMPLATE_INPUT_PATTERN = /{{\s*([a-z][a-z0-9_-]*)\s*}}/gi;

export function normalizeProjectScriptId(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (cleaned.length === 0) {
    return "script";
  }
  if (cleaned.length <= MAX_SCRIPT_ID_LENGTH) {
    return cleaned;
  }
  return cleaned.slice(0, MAX_SCRIPT_ID_LENGTH).replace(/-+$/g, "") || "script";
}

export const commandForProjectScript = (scriptId: string): KeybindingCommand =>
  SCRIPT_RUN_COMMAND_PATTERN.makeUnsafe(`script.${scriptId}.run`);

export function projectScriptIdFromCommand(command: string): string | null {
  const trimmed = command.trim();
  if (!Schema.is(SCRIPT_RUN_COMMAND_PATTERN)(trimmed)) {
    return null;
  }
  const [prefix, , suffix] = SCRIPT_RUN_COMMAND_PATTERN.parts;
  return trimmed.slice(prefix.literal.length, -suffix.literal.length);
}

export function nextProjectScriptId(name: string, existingIds: Iterable<string>): string {
  const taken = new Set(Array.from(existingIds));
  const baseId = normalizeProjectScriptId(name);
  if (!taken.has(baseId)) return baseId;

  let suffix = 2;
  while (suffix < 10_000) {
    const candidate = `${baseId}-${suffix}`;
    const safeCandidate =
      candidate.length <= MAX_SCRIPT_ID_LENGTH
        ? candidate
        : `${baseId.slice(0, Math.max(1, MAX_SCRIPT_ID_LENGTH - String(suffix).length - 1))}-${suffix}`;
    if (!taken.has(safeCandidate)) {
      return safeCandidate;
    }
    suffix += 1;
  }

  // This last-resort fallback only triggers after exhausting thousands of suffixes.
  return `${baseId}-${Date.now()}`.slice(0, MAX_SCRIPT_ID_LENGTH);
}

interface ProjectScriptRuntimeEnvInput {
  project: {
    cwd: string;
  };
  worktreePath?: string | null;
  extraEnv?: Record<string, string>;
}

export function projectScriptCwd(input: {
  project: {
    cwd: string;
  };
  worktreePath?: string | null;
}): string {
  return input.worktreePath ?? input.project.cwd;
}

export function projectScriptRuntimeEnv(
  input: ProjectScriptRuntimeEnvInput,
): Record<string, string> {
  const env: Record<string, string> = {
    OKCODE_PROJECT_ROOT: input.project.cwd,
  };
  if (input.worktreePath) {
    env.OKCODE_WORKTREE_PATH = input.worktreePath;
  }
  if (input.extraEnv) {
    return { ...env, ...input.extraEnv };
  }
  return env;
}

export function primaryProjectScript(scripts: ProjectScript[]): ProjectScript | null {
  const regular = scripts.find((script) => !script.runOnWorktreeCreate);
  return regular ?? scripts[0] ?? null;
}

export function setupProjectScript(scripts: ProjectScript[]): ProjectScript | null {
  return scripts.find((script) => script.runOnWorktreeCreate) ?? null;
}

export function projectScriptTemplateInputs(command: string): string[] {
  const matches = command.matchAll(PROJECT_SCRIPT_TEMPLATE_INPUT_PATTERN);
  const seen = new Set<string>();
  const inputs: string[] = [];

  for (const match of matches) {
    const inputId = match[1]?.trim().toLowerCase();
    if (!inputId || seen.has(inputId)) continue;
    seen.add(inputId);
    inputs.push(inputId);
  }

  return inputs;
}

export function interpolateProjectScriptCommand(
  command: string,
  values: Record<string, string>,
): string {
  return command.replaceAll(PROJECT_SCRIPT_TEMPLATE_INPUT_PATTERN, (_match, rawInputId: string) => {
    const inputId = rawInputId.trim().toLowerCase();
    const value = values[inputId];
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Missing a value for "${inputId}".`);
    }
    return value;
  });
}

export function projectScriptTemplateInputLabel(inputId: string): string {
  return inputId
    .split(/[-_]+/g)
    .map((segment) => (segment.length > 0 ? `${segment[0]!.toUpperCase()}${segment.slice(1)}` : ""))
    .filter((segment) => segment.length > 0)
    .join(" ");
}
