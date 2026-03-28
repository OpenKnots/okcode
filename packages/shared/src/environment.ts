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

  type ProjectContextMatch = {
    readonly projectId: ProjectId;
    readonly projectRoot: string;
    readonly worktreePath: string | null;
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

  if (bestMatch === null) {
    return null;
  }
  const match = bestMatch as ProjectContextMatch;

  return {
    projectId: match.projectId,
    projectRoot: match.projectRoot,
    worktreePath: match.worktreePath,
  };
}
