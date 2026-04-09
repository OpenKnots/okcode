import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  EnvironmentVariables,
  type EnvironmentVariablesShape,
} from "../../persistence/Services/EnvironmentVariables.ts";
import {
  type ProjectionThread,
  ProjectionThreadRepository,
  type ProjectionThreadRepositoryShape,
} from "../../persistence/Services/ProjectionThreads.ts";
import { makeTerminalRuntimeEnvResolver } from "./RuntimeEnvResolver.ts";

const baseThread: ProjectionThread = {
  threadId: "thread-1" as never,
  projectId: "project-1" as never,
  title: "Thread",
  model: "gpt-5.4",
  runtimeMode: "full-access",
  interactionMode: "chat",
  branch: null,
  worktreePath: null,
  githubRef: null,
  latestTurnId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  deletedAt: null,
};

describe("TerminalRuntimeEnvResolver", () => {
  it("resolves project-scoped env for a live thread and lets extra env win", async () => {
    const threadRepository: ProjectionThreadRepositoryShape = {
      upsert: () => Effect.void,
      getById: () => Effect.succeed(Option.some(baseThread)),
      listByProjectId: () => Effect.succeed([]),
      deleteById: () => Effect.void,
    };
    const environmentVariables: EnvironmentVariablesShape = {
      getGlobal: () => Effect.succeed({ entries: [] }),
      saveGlobal: () => Effect.succeed({ entries: [] }),
      getProject: () => Effect.succeed({ projectId: "project-1" as never, entries: [] }),
      saveProject: () => Effect.succeed({ projectId: "project-1" as never, entries: [] }),
      resolveEnvironment: (input) =>
        Effect.succeed(
          input?.projectId
            ? { SHARED: "project", PROJECT_ONLY: input.projectId }
            : { SHARED: "global", GLOBAL_ONLY: "1" },
        ),
    };

    const resolver = await Effect.runPromise(
      makeTerminalRuntimeEnvResolver.pipe(
        Effect.provideService(ProjectionThreadRepository, threadRepository),
        Effect.provideService(EnvironmentVariables, environmentVariables),
      ),
    );
    const resolved = await Effect.runPromise(
      resolver.resolve({
        threadId: "thread-1" as never,
        cwd: "/repo",
        extraEnv: { SHARED: "extra", EXTRA_ONLY: "1" },
      }),
    );

    expect(resolved).toEqual({
      SHARED: "extra",
      PROJECT_ONLY: "project-1",
      EXTRA_ONLY: "1",
    });
  });

  it("falls back to global env when the thread is missing or deleted", async () => {
    const threadRepository: ProjectionThreadRepositoryShape = {
      upsert: () => Effect.void,
      getById: () =>
        Effect.succeed(
          Option.some({
            ...baseThread,
            deletedAt: "2026-01-02T00:00:00.000Z",
          }),
        ),
      listByProjectId: () => Effect.succeed([]),
      deleteById: () => Effect.void,
    };
    const environmentVariables: EnvironmentVariablesShape = {
      getGlobal: () => Effect.succeed({ entries: [] }),
      saveGlobal: () => Effect.succeed({ entries: [] }),
      getProject: () => Effect.succeed({ projectId: "project-1" as never, entries: [] }),
      saveProject: () => Effect.succeed({ projectId: "project-1" as never, entries: [] }),
      resolveEnvironment: (input) =>
        Effect.succeed(input?.projectId ? { PROJECT_ONLY: "1" } : { GLOBAL_ONLY: "1" }),
    };

    const resolver = await Effect.runPromise(
      makeTerminalRuntimeEnvResolver.pipe(
        Effect.provideService(ProjectionThreadRepository, threadRepository),
        Effect.provideService(EnvironmentVariables, environmentVariables),
      ),
    );
    const resolved = await Effect.runPromise(
      resolver.resolve({
        threadId: "thread-1" as never,
      }),
    );

    expect(resolved).toEqual({
      GLOBAL_ONLY: "1",
    });
  });
});
