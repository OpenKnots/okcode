import type {
  OrchestrationCommand,
  OrchestrationProject,
  OrchestrationReadModel,
  OrchestrationThread,
  ProjectId,
  ThreadId,
} from "@okcode/contracts";
import { MAX_PROJECTS, MAX_THREADS_PER_PROJECT } from "@okcode/contracts";
import { Effect } from "effect";

import { OrchestrationCommandInvariantError } from "./Errors.ts";

function invariantError(commandType: string, detail: string): OrchestrationCommandInvariantError {
  return new OrchestrationCommandInvariantError({
    commandType,
    detail,
  });
}

export function findThreadById(
  readModel: OrchestrationReadModel,
  threadId: ThreadId,
): OrchestrationThread | undefined {
  return readModel.threads.find((thread) => thread.id === threadId);
}

export function findActiveThreadById(
  readModel: OrchestrationReadModel,
  threadId: ThreadId,
): OrchestrationThread | undefined {
  return readModel.threads.find((thread) => thread.id === threadId && thread.deletedAt === null);
}

export function findProjectById(
  readModel: OrchestrationReadModel,
  projectId: ProjectId,
): OrchestrationProject | undefined {
  return readModel.projects.find((project) => project.id === projectId);
}

export function findActiveProjectById(
  readModel: OrchestrationReadModel,
  projectId: ProjectId,
): OrchestrationProject | undefined {
  return readModel.projects.find(
    (project) => project.id === projectId && project.deletedAt === null,
  );
}

export function listThreadsByProjectId(
  readModel: OrchestrationReadModel,
  projectId: ProjectId,
): ReadonlyArray<OrchestrationThread> {
  return readModel.threads.filter((thread) => thread.projectId === projectId);
}

export function requireProject(input: {
  readonly readModel: OrchestrationReadModel;
  readonly command: OrchestrationCommand;
  readonly projectId: ProjectId;
}): Effect.Effect<OrchestrationProject, OrchestrationCommandInvariantError> {
  const project = findActiveProjectById(input.readModel, input.projectId);
  if (project) {
    return Effect.succeed(project);
  }
  const archivedProject = findProjectById(input.readModel, input.projectId);
  return Effect.fail(
    invariantError(
      input.command.type,
      archivedProject
        ? `Project '${input.projectId}' has been archived and cannot be used by command '${input.command.type}'.`
        : `Project '${input.projectId}' does not exist for command '${input.command.type}'.`,
    ),
  );
}

export function requireProjectAbsent(input: {
  readonly readModel: OrchestrationReadModel;
  readonly command: OrchestrationCommand;
  readonly projectId: ProjectId;
}): Effect.Effect<void, OrchestrationCommandInvariantError> {
  if (!findProjectById(input.readModel, input.projectId)) {
    return Effect.void;
  }
  return Effect.fail(
    invariantError(
      input.command.type,
      `Project '${input.projectId}' already exists and cannot be created twice.`,
    ),
  );
}

export function requireThread(input: {
  readonly readModel: OrchestrationReadModel;
  readonly command: OrchestrationCommand;
  readonly threadId: ThreadId;
}): Effect.Effect<OrchestrationThread, OrchestrationCommandInvariantError> {
  const thread = findActiveThreadById(input.readModel, input.threadId);
  if (thread) {
    return Effect.succeed(thread);
  }
  const archivedThread = findThreadById(input.readModel, input.threadId);
  return Effect.fail(
    invariantError(
      input.command.type,
      archivedThread
        ? `Thread '${input.threadId}' has been archived and cannot be used by command '${input.command.type}'.`
        : `Thread '${input.threadId}' does not exist for command '${input.command.type}'.`,
    ),
  );
}

export function requireThreadAbsent(input: {
  readonly readModel: OrchestrationReadModel;
  readonly command: OrchestrationCommand;
  readonly threadId: ThreadId;
}): Effect.Effect<void, OrchestrationCommandInvariantError> {
  if (!findThreadById(input.readModel, input.threadId)) {
    return Effect.void;
  }
  return Effect.fail(
    invariantError(
      input.command.type,
      `Thread '${input.threadId}' already exists and cannot be created twice.`,
    ),
  );
}

export function requireProjectChatThreadAbsent(input: {
  readonly readModel: OrchestrationReadModel;
  readonly command: OrchestrationCommand;
  readonly projectId: ProjectId;
}): Effect.Effect<void, OrchestrationCommandInvariantError> {
  const existingProjectChatThread = listActiveThreadsByProjectId(
    input.readModel,
    input.projectId,
  ).find((thread) => thread.kind === "project-chat");
  if (!existingProjectChatThread) {
    return Effect.void;
  }
  return Effect.fail(
    invariantError(
      input.command.type,
      `Project '${input.projectId}' already has a project chat thread ('${existingProjectChatThread.id}').`,
    ),
  );
}

export function requireNonNegativeInteger(input: {
  readonly commandType: OrchestrationCommand["type"];
  readonly field: string;
  readonly value: number;
}): Effect.Effect<void, OrchestrationCommandInvariantError> {
  if (Number.isInteger(input.value) && input.value >= 0) {
    return Effect.void;
  }
  return Effect.fail(
    invariantError(
      input.commandType,
      `${input.field} must be an integer greater than or equal to 0.`,
    ),
  );
}

// ── Active entity helpers ────────────────────────────────────────────

export function listActiveProjects(
  readModel: OrchestrationReadModel,
): ReadonlyArray<OrchestrationProject> {
  return readModel.projects.filter((project) => project.deletedAt === null);
}

export function listActiveThreadsByProjectId(
  readModel: OrchestrationReadModel,
  projectId: ProjectId,
): ReadonlyArray<OrchestrationThread> {
  return readModel.threads.filter(
    (thread) => thread.projectId === projectId && thread.deletedAt === null,
  );
}

export function listActiveThreadsByProjectIds(
  readModel: OrchestrationReadModel,
  projectIds: ReadonlyArray<ProjectId>,
): ReadonlyArray<OrchestrationThread> {
  if (projectIds.length === 0) {
    return [];
  }

  const projectOrder = new Map(projectIds.map((projectId, index) => [projectId, index] as const));
  return readModel.threads
    .filter((thread) => thread.deletedAt === null && projectOrder.has(thread.projectId))
    .toSorted((left, right) => {
      const leftProjectOrder = projectOrder.get(left.projectId) ?? Number.MAX_SAFE_INTEGER;
      const rightProjectOrder = projectOrder.get(right.projectId) ?? Number.MAX_SAFE_INTEGER;
      return (
        leftProjectOrder - rightProjectOrder ||
        left.updatedAt.localeCompare(right.updatedAt) ||
        left.id.localeCompare(right.id)
      );
    });
}

/**
 * Returns the oldest active projects that must be archived to stay within
 * MAX_PROJECTS when a new project is about to be created.
 * Sorted by updatedAt ascending (oldest first).
 */
export function getProjectsToArchive(
  readModel: OrchestrationReadModel,
): ReadonlyArray<OrchestrationProject> {
  const active = listActiveProjects(readModel);
  if (active.length < MAX_PROJECTS) return [];
  const overflow = active.length - MAX_PROJECTS + 1;
  return [...active]
    .toSorted((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
    .slice(0, overflow);
}

/**
 * Returns the oldest active threads in the given project that must be
 * archived to stay within MAX_THREADS_PER_PROJECT when a new thread is
 * about to be created.
 * Sorted by updatedAt ascending (oldest first).
 */
export function getThreadsToArchive(
  readModel: OrchestrationReadModel,
  projectId: ProjectId,
): ReadonlyArray<OrchestrationThread> {
  const active = listActiveThreadsByProjectId(readModel, projectId);
  if (active.length < MAX_THREADS_PER_PROJECT) return [];
  const overflow = active.length - MAX_THREADS_PER_PROJECT + 1;
  return [...active]
    .toSorted((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))
    .slice(0, overflow);
}
