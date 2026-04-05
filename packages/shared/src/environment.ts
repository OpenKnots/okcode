import fs from "node:fs";
import path from "node:path";

import type { OrchestrationReadModel, ProjectId } from "@okcode/contracts";

export type EnvironmentRecord = Record<string, string>;

export interface ProjectContext {
  readonly projectId: ProjectId;
  readonly projectRoot: string;
  readonly worktreePath: string | null;
}

export function compactNodeProcessEnv(env: NodeJS.ProcessEnv): EnvironmentRecord {
  const compacted: EnvironmentRecord = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") continue;
    compacted[key] = value;
  }
  return compacted;
}

export function mergeEnvironmentRecords(
  ...records: Array<EnvironmentRecord | undefined | null>
): EnvironmentRecord {
  return Object.assign(
    {},
    ...records.flatMap((record) => (record ? [record] : [])),
  ) as EnvironmentRecord;
}

export function mergeNodeProcessEnv(
  baseEnv: NodeJS.ProcessEnv,
  extraEnv?: EnvironmentRecord,
): NodeJS.ProcessEnv {
  const merged: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value !== "string") continue;
    merged[key] = value;
  }
  if (extraEnv) {
    for (const [key, value] of Object.entries(extraEnv)) {
      merged[key] = value;
    }
  }
  return merged;
}

function normalizeShellCommand(
  value: string | undefined,
  platform: NodeJS.Platform = process.platform,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (platform === "win32") {
    return trimmed;
  }
  const firstToken = trimmed.split(/\s+/g)[0]?.trim();
  if (!firstToken) return null;
  return firstToken.replace(/^['"]|['"]$/g, "");
}

function uniqueCandidates(candidates: Array<string | null>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    ordered.push(candidate);
  }
  return ordered;
}

function resolveExecutableCandidate(
  command: string,
  env: NodeJS.ProcessEnv,
  options?: {
    readonly platform?: NodeJS.Platform;
    readonly existsSync?: (path: string) => boolean;
  },
): string | undefined {
  const platform = options?.platform ?? process.platform;
  const fileExists = options?.existsSync ?? fs.existsSync;
  const normalized = normalizeShellCommand(command, platform);
  if (!normalized) return undefined;

  if (path.isAbsolute(normalized)) {
    return fileExists(normalized) ? normalized : undefined;
  }

  if (normalized.includes(path.sep) || (platform === "win32" && normalized.includes("\\"))) {
    const resolved = path.resolve(normalized);
    return fileExists(resolved) ? resolved : undefined;
  }

  const pathValue = env.PATH ?? process.env.PATH ?? "";
  const pathEntries = pathValue.split(path.delimiter).filter((entry) => entry.length > 0);
  if (pathEntries.length === 0) {
    return undefined;
  }

  const hasExtension = path.extname(normalized).length > 0;
  const extensions =
    platform === "win32"
      ? (env.PATHEXT ?? process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
          .split(";")
          .filter((entry) => entry.length > 0)
      : [""];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate =
        platform === "win32" && !hasExtension
          ? path.join(entry, `${normalized}${extension}`)
          : path.join(entry, normalized);
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

export function resolveAvailableShellPath(
  env: NodeJS.ProcessEnv,
  options?: {
    readonly platform?: NodeJS.Platform;
    readonly existsSync?: (path: string) => boolean;
  },
): string | undefined {
  const platform = options?.platform ?? process.platform;

  if (platform === "win32") {
    const requestedComSpec = normalizeShellCommand(env.ComSpec, platform);
    const candidates = uniqueCandidates([requestedComSpec, "powershell.exe", "cmd.exe"]);
    for (const candidate of candidates) {
      const resolved = resolveExecutableCandidate(candidate, env, options);
      if (resolved) {
        return resolved;
      }
    }
    return undefined;
  }

  const requestedShell = normalizeShellCommand(env.SHELL, platform);
  const candidates = uniqueCandidates([
    requestedShell,
    "/bin/zsh",
    "/bin/bash",
    "/bin/sh",
    "zsh",
    "bash",
    "sh",
  ]);

  for (const candidate of candidates) {
    const resolved = resolveExecutableCandidate(candidate, env, options);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

export function sanitizeShellEnvironment(
  env: NodeJS.ProcessEnv,
  options?: {
    readonly platform?: NodeJS.Platform;
    readonly existsSync?: (path: string) => boolean;
  },
): NodeJS.ProcessEnv {
  const nextEnv = { ...env };
  const platform = options?.platform ?? process.platform;
  const resolvedShell = resolveAvailableShellPath(nextEnv, options);

  if (platform === "win32") {
    if (resolvedShell) {
      nextEnv.ComSpec = resolvedShell;
    } else {
      delete nextEnv.ComSpec;
    }
    return nextEnv;
  }

  if (resolvedShell) {
    nextEnv.SHELL = resolvedShell;
  } else {
    delete nextEnv.SHELL;
  }
  return nextEnv;
}

export function projectScriptRuntimeEnv(input: {
  project: {
    cwd: string;
  };
  worktreePath?: string | null;
  baseEnv?: EnvironmentRecord;
  extraEnv?: EnvironmentRecord;
}): EnvironmentRecord {
  const env = mergeEnvironmentRecords(input.baseEnv);
  env.OKCODE_PROJECT_ROOT = input.project.cwd;
  if (input.worktreePath) {
    env.OKCODE_WORKTREE_PATH = input.worktreePath;
  }
  return mergeEnvironmentRecords(env, input.extraEnv);
}

function isWithinPath(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  if (relative.length === 0) {
    return true;
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function resolveProjectContextByCwd(
  readModel: OrchestrationReadModel,
  cwd: string,
): ProjectContext | null {
  const normalizedCwd = path.resolve(cwd);
  const projectById = new Map(readModel.projects.map((project) => [project.id, project] as const));

  type ProjectContextMatch = ProjectContext & {
    readonly matchLength: number;
    readonly hasWorktreePath: boolean;
  };

  let bestMatch: ProjectContextMatch | null = null;

  const consider = (input: {
    readonly projectId: ProjectId;
    readonly projectRoot: string;
    readonly worktreePath: string | null;
    readonly matchPath: string;
  }) => {
    const normalizedMatchPath = path.resolve(input.matchPath);
    if (!isWithinPath(normalizedCwd, normalizedMatchPath)) {
      return;
    }

    const candidate: ProjectContextMatch = {
      projectId: input.projectId,
      projectRoot: path.resolve(input.projectRoot),
      worktreePath: input.worktreePath,
      matchLength: normalizedMatchPath.length,
      hasWorktreePath: input.worktreePath !== null,
    };

    if (
      bestMatch === null ||
      candidate.matchLength > bestMatch.matchLength ||
      (candidate.matchLength === bestMatch.matchLength &&
        candidate.hasWorktreePath &&
        !bestMatch.hasWorktreePath)
    ) {
      bestMatch = candidate;
    }
  };

  for (const project of readModel.projects) {
    consider({
      projectId: project.id,
      projectRoot: project.workspaceRoot,
      worktreePath: null,
      matchPath: project.workspaceRoot,
    });
  }

  for (const thread of readModel.threads) {
    if (!thread.worktreePath) continue;
    const project = projectById.get(thread.projectId);
    consider({
      projectId: thread.projectId,
      projectRoot: project?.workspaceRoot ?? thread.worktreePath,
      worktreePath: thread.worktreePath,
      matchPath: thread.worktreePath,
    });
  }

  if (!bestMatch) {
    return null;
  }

  const resolvedMatch = bestMatch as ProjectContextMatch;
  return {
    projectId: resolvedMatch.projectId,
    projectRoot: resolvedMatch.projectRoot,
    worktreePath: resolvedMatch.worktreePath,
  };
}
