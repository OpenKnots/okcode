import {
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  MAX_PROJECTS,
  ProjectId,
  ThreadId,
  type OrchestrationProject,
  type OrchestrationReadModel,
  type OrchestrationThread,
} from "@okcode/contracts";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { decideOrchestrationCommand } from "./decider.ts";

function makeProject(input: {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
}): OrchestrationProject {
  return {
    id: ProjectId.makeUnsafe(input.id),
    title: input.id,
    workspaceRoot: `/tmp/${input.id}`,
    defaultModel: "gpt-5-codex",
    scripts: [],
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    deletedAt: input.deletedAt ?? null,
  };
}

function makeThread(input: {
  id: string;
  projectId: string;
  updatedAt: string;
  deletedAt?: string | null;
}): OrchestrationThread {
  return {
    id: ThreadId.makeUnsafe(input.id),
    projectId: ProjectId.makeUnsafe(input.projectId),
    title: input.id,
    model: "gpt-5-codex",
    interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
    runtimeMode: "full-access",
    branch: null,
    worktreePath: null,
    createdAt: input.updatedAt,
    updatedAt: input.updatedAt,
    latestTurn: null,
    messages: [],
    session: null,
    activities: [],
    proposedPlans: [],
    checkpoints: [],
    deletedAt: input.deletedAt ?? null,
  };
}

describe("decider limits", () => {
  it("archives the oldest project's active threads before creating a new project at the cap", async () => {
    const createdAt = "2026-04-09T12:00:00.000Z";
    const projects = Array.from({ length: MAX_PROJECTS }, (_, index) =>
      makeProject({
        id: `project-${index}`,
        updatedAt: `2026-04-01T00:00:${String(index).padStart(2, "0")}.000Z`,
      }),
    );
    const readModel: OrchestrationReadModel = {
      snapshotSequence: MAX_PROJECTS,
      updatedAt: createdAt,
      projects,
      threads: [
        makeThread({
          id: "thread-oldest-active",
          projectId: "project-0",
          updatedAt: "2026-04-01T00:00:00.000Z",
        }),
        makeThread({
          id: "thread-oldest-archived",
          projectId: "project-0",
          updatedAt: "2026-04-01T00:00:01.000Z",
          deletedAt: "2026-04-02T00:00:00.000Z",
        }),
      ],
    };

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-cap"),
          projectId: ProjectId.makeUnsafe("project-new"),
          title: "project-new",
          workspaceRoot: "/tmp/project-new",
          defaultModel: "gpt-5-codex",
          createdAt,
        },
        readModel,
      }),
    );

    const events = Array.isArray(result) ? result : [result];
    expect(events.map((event) => event.type)).toEqual([
      "thread.deleted",
      "project.deleted",
      "project.created",
    ]);
    expect(events[0]?.aggregateId).toBe("thread-oldest-active");
    expect(events[1]?.aggregateId).toBe("project-0");
    expect(events[2]?.aggregateId).toBe("project-new");
  });

  it("cascades active thread archival when deleting a project", async () => {
    const updatedAt = "2026-04-09T12:05:00.000Z";
    const readModel: OrchestrationReadModel = {
      snapshotSequence: 2,
      updatedAt,
      projects: [makeProject({ id: "project-1", updatedAt })],
      threads: [
        makeThread({
          id: "thread-active",
          projectId: "project-1",
          updatedAt,
        }),
        makeThread({
          id: "thread-archived",
          projectId: "project-1",
          updatedAt,
          deletedAt: "2026-04-08T00:00:00.000Z",
        }),
      ],
    };

    const result = await Effect.runPromise(
      decideOrchestrationCommand({
        command: {
          type: "project.delete",
          commandId: CommandId.makeUnsafe("cmd-project-delete"),
          projectId: ProjectId.makeUnsafe("project-1"),
        },
        readModel,
      }),
    );

    const events = Array.isArray(result) ? result : [result];
    expect(events.map((event) => event.type)).toEqual(["thread.deleted", "project.deleted"]);
    expect(events[0]?.aggregateId).toBe("thread-active");
    expect(events[1]?.aggregateId).toBe("project-1");
  });
});
