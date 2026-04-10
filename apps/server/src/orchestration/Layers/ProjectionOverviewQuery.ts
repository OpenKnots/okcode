import {
  IsoDateTime,
  MAX_PROJECTS,
  MAX_THREADS_PER_PROJECT,
  MessageId,
  NonNegativeInt,
  OrchestrationLatestTurn,
  OrchestrationOverviewSnapshot,
  OrchestrationProposedPlanId,
  OrchestrationSession,
  ProjectScript,
  ThreadId,
  TurnId,
  type OrchestrationOverviewProject,
  type OrchestrationOverviewThread,
} from "@okcode/contracts";
import { Effect, Layer, Schema } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";

import {
  isPersistenceError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
  type ProjectionRepositoryError,
} from "../../persistence/Errors.ts";
import {
  ProjectionOverviewQuery,
  type ProjectionOverviewQueryShape,
} from "../Services/ProjectionOverviewQuery.ts";
import { ProjectionState } from "../../persistence/Services/ProjectionState.ts";
import { ProjectionProject } from "../../persistence/Services/ProjectionProjects.ts";
import { ProjectionThread } from "../../persistence/Services/ProjectionThreads.ts";
import { ProjectionThreadProposedPlan } from "../../persistence/Services/ProjectionThreadProposedPlans.ts";
import { ProjectionThreadSession } from "../../persistence/Services/ProjectionThreadSessions.ts";
import { ORCHESTRATION_PROJECTOR_NAMES } from "./ProjectionPipeline.ts";

const ProjectionProjectOverviewRow = ProjectionProject.mapFields({
  scripts: Schema.fromJsonString(Schema.Array(ProjectScript)),
}).pipe(
  Schema.extend(
    Schema.Struct({
      activeThreadCount: NonNegativeInt,
    }),
  ),
);

const ProjectionThreadOverviewRow = ProjectionThread.pipe(
  Schema.extend(
    Schema.Struct({
      lastUserMessageAt: Schema.NullOr(IsoDateTime),
      pendingApprovalCount: NonNegativeInt,
      pendingUserInputCount: NonNegativeInt,
    }),
  ),
);

const ProjectionLatestTurnDbRowSchema = Schema.Struct({
  threadId: ProjectionThread.fields.threadId,
  turnId: TurnId,
  state: Schema.String,
  requestedAt: IsoDateTime,
  startedAt: Schema.NullOr(IsoDateTime),
  completedAt: Schema.NullOr(IsoDateTime),
  assistantMessageId: Schema.NullOr(MessageId),
  sourceProposedPlanThreadId: Schema.NullOr(ThreadId),
  sourceProposedPlanId: Schema.NullOr(OrchestrationProposedPlanId),
});

const ProjectionThreadPlanSummaryRow = Schema.Struct({
  planId: OrchestrationProposedPlanId,
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  implementedAt: Schema.NullOr(IsoDateTime),
  updatedAt: IsoDateTime,
});

const ProjectionStateDbRowSchema = ProjectionState;
const ProjectionThreadSessionDbRowSchema = ProjectionThreadSession;

function parseGithubRef(
  serialized: string | null,
): OrchestrationOverviewThread["githubRef"] | undefined {
  if (!serialized) return undefined;
  try {
    return JSON.parse(serialized) as OrchestrationOverviewThread["githubRef"];
  } catch {
    return undefined;
  }
}

const REQUIRED_OVERVIEW_PROJECTORS = [
  ORCHESTRATION_PROJECTOR_NAMES.projects,
  ORCHESTRATION_PROJECTOR_NAMES.threads,
  ORCHESTRATION_PROJECTOR_NAMES.threadMessages,
  ORCHESTRATION_PROJECTOR_NAMES.threadProposedPlans,
  ORCHESTRATION_PROJECTOR_NAMES.threadSessions,
  ORCHESTRATION_PROJECTOR_NAMES.pendingApprovals,
] as const;

function computeSnapshotSequence(
  stateRows: ReadonlyArray<Schema.Schema.Type<typeof ProjectionStateDbRowSchema>>,
): number {
  if (stateRows.length === 0) {
    return 0;
  }
  const sequenceByProjector = new Map(
    stateRows.map((row) => [row.projector, row.lastAppliedSequence] as const),
  );

  let minSequence = Number.POSITIVE_INFINITY;
  for (const projector of REQUIRED_OVERVIEW_PROJECTORS) {
    const sequence = sequenceByProjector.get(projector);
    if (sequence === undefined) {
      return 0;
    }
    if (sequence < minSequence) {
      minSequence = sequence;
    }
  }

  return Number.isFinite(minSequence) ? minSequence : 0;
}

function toLatestTurn(
  row: Schema.Schema.Type<typeof ProjectionLatestTurnDbRowSchema>,
): OrchestrationLatestTurn {
  return {
    turnId: row.turnId,
    state:
      row.state === "error"
        ? "error"
        : row.state === "interrupted"
          ? "interrupted"
          : row.state === "completed"
            ? "completed"
            : "running",
    requestedAt: row.requestedAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    assistantMessageId: row.assistantMessageId,
    ...(row.sourceProposedPlanThreadId !== null && row.sourceProposedPlanId !== null
      ? {
          sourceProposedPlan: {
            threadId: row.sourceProposedPlanThreadId,
            planId: row.sourceProposedPlanId,
          },
        }
      : {}),
  };
}

function hasActionablePlan(
  plans: ReadonlyArray<Schema.Schema.Type<typeof ProjectionThreadPlanSummaryRow>>,
  latestTurn: OrchestrationLatestTurn | null,
): boolean {
  const latestTurnId = latestTurn?.turnId ?? null;
  const matchingTurnPlan =
    latestTurnId === null
      ? null
      : ([...plans]
          .filter((plan) => plan.turnId === latestTurnId)
          .toSorted(
            (left, right) =>
              left.updatedAt.localeCompare(right.updatedAt) ||
              left.planId.localeCompare(right.planId),
          )
          .at(-1) ?? null);
  if (matchingTurnPlan) {
    return matchingTurnPlan.implementedAt === null;
  }
  const latestPlan =
    [...plans]
      .toSorted(
        (left, right) =>
          left.updatedAt.localeCompare(right.updatedAt) || left.planId.localeCompare(right.planId),
      )
      .at(-1) ?? null;
  return latestPlan?.implementedAt === null;
}

const makeProjectionOverviewQuery = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const listProjectRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionProjectOverviewRow,
    execute: () =>
      sql`
        SELECT
          p.project_id AS "projectId",
          p.title,
          p.workspace_root AS "workspaceRoot",
          p.default_model AS "defaultModel",
          p.scripts_json AS "scripts",
          p.created_at AS "createdAt",
          p.updated_at AS "updatedAt",
          p.deleted_at AS "deletedAt",
          CAST(COUNT(t.thread_id) AS INTEGER) AS "activeThreadCount"
        FROM projection_projects p
        LEFT JOIN projection_threads t
          ON t.project_id = p.project_id
         AND t.deleted_at IS NULL
        WHERE p.deleted_at IS NULL
        GROUP BY p.project_id
        ORDER BY p.created_at ASC, p.project_id ASC
      `,
  });

  const listThreadRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionThreadOverviewRow,
    execute: () =>
      sql`
        SELECT
          t.thread_id AS "threadId",
          t.project_id AS "projectId",
          t.title,
          t.model,
          t.runtime_mode AS "runtimeMode",
          t.interaction_mode AS "interactionMode",
          t.branch,
          t.worktree_path AS "worktreePath",
          t.github_ref AS "githubRef",
          t.latest_turn_id AS "latestTurnId",
          t.created_at AS "createdAt",
          t.updated_at AS "updatedAt",
          t.deleted_at AS "deletedAt",
          (
            SELECT MAX(m.created_at)
            FROM projection_thread_messages m
            WHERE m.thread_id = t.thread_id
              AND m.role = 'user'
          ) AS "lastUserMessageAt",
          CAST((
            SELECT COUNT(*)
            FROM projection_pending_approvals pa
            WHERE pa.thread_id = t.thread_id
              AND pa.status = 'pending'
          ) AS INTEGER) AS "pendingApprovalCount",
          CAST((
            SELECT COUNT(*)
            FROM projection_pending_user_inputs pui
            WHERE pui.thread_id = t.thread_id
              AND pui.status = 'pending'
          ) AS INTEGER) AS "pendingUserInputCount"
        FROM projection_threads t
        WHERE t.deleted_at IS NULL
        ORDER BY t.created_at ASC, t.thread_id ASC
      `,
  });

  const listLatestTurnRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionLatestTurnDbRowSchema,
    execute: () =>
      sql`
        SELECT
          thread_id AS "threadId",
          turn_id AS "turnId",
          state,
          requested_at AS "requestedAt",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          assistant_message_id AS "assistantMessageId",
          source_proposed_plan_thread_id AS "sourceProposedPlanThreadId",
          source_proposed_plan_id AS "sourceProposedPlanId"
        FROM projection_turns
        WHERE turn_id IS NOT NULL
        ORDER BY thread_id ASC, requested_at DESC, turn_id DESC
      `,
  });

  const listSessionRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionThreadSessionDbRowSchema,
    execute: () =>
      sql`
        SELECT
          thread_id AS "threadId",
          status,
          provider_name AS "providerName",
          provider_session_id AS "providerSessionId",
          provider_thread_id AS "providerThreadId",
          runtime_mode AS "runtimeMode",
          active_turn_id AS "activeTurnId",
          last_error AS "lastError",
          updated_at AS "updatedAt"
        FROM projection_thread_sessions
        ORDER BY thread_id ASC
      `,
  });

  const listPlanRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionThreadPlanSummaryRow,
    execute: () =>
      sql`
        SELECT
          plan_id AS "planId",
          thread_id AS "threadId",
          turn_id AS "turnId",
          implemented_at AS "implementedAt",
          updated_at AS "updatedAt"
        FROM projection_thread_proposed_plans
        ORDER BY thread_id ASC, updated_at ASC, plan_id ASC
      `,
  });

  const listProjectionStateRows = SqlSchema.findAll({
    Request: Schema.Void,
    Result: ProjectionStateDbRowSchema,
    execute: () =>
      sql`
        SELECT
          projector,
          last_applied_sequence AS "lastAppliedSequence",
          updated_at AS "updatedAt"
        FROM projection_state
      `,
  });

  const getOverview: ProjectionOverviewQueryShape["getOverview"] = () =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const [projectRows, threadRows, latestTurnRows, sessionRows, planRows, stateRows] =
            yield* Effect.all([
              listProjectRows(undefined),
              listThreadRows(undefined),
              listLatestTurnRows(undefined),
              listSessionRows(undefined),
              listPlanRows(undefined),
              listProjectionStateRows(undefined),
            ]);

          const latestTurnByThread = new Map<string, OrchestrationLatestTurn>();
          for (const row of latestTurnRows) {
            if (!latestTurnByThread.has(row.threadId)) {
              latestTurnByThread.set(row.threadId, toLatestTurn(row));
            }
          }

          const sessionByThread = new Map<string, OrchestrationSession>();
          for (const row of sessionRows) {
            sessionByThread.set(row.threadId, {
              threadId: row.threadId,
              status: row.status,
              providerName: row.providerName,
              runtimeMode: row.runtimeMode,
              activeTurnId: row.activeTurnId,
              lastError: row.lastError,
              updatedAt: row.updatedAt,
            });
          }

          const plansByThread = new Map<
            string,
            Array<Schema.Schema.Type<typeof ProjectionThreadPlanSummaryRow>>
          >();
          for (const row of planRows) {
            const plans = plansByThread.get(row.threadId) ?? [];
            plans.push(row);
            plansByThread.set(row.threadId, plans);
          }

          const projects: OrchestrationOverviewProject[] = projectRows.map((row) => ({
            id: row.projectId,
            title: row.title,
            workspaceRoot: row.workspaceRoot,
            defaultModel: row.defaultModel,
            scripts: row.scripts,
            activeThreadCount: row.activeThreadCount,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }));

          const threads: OrchestrationOverviewThread[] = threadRows.map((row) => {
            const latestTurn = latestTurnByThread.get(row.threadId) ?? null;
            return {
              id: row.threadId,
              projectId: row.projectId,
              title: row.title,
              model: row.model,
              runtimeMode: row.runtimeMode,
              interactionMode: row.interactionMode,
              branch: row.branch,
              worktreePath: row.worktreePath,
              ...(parseGithubRef(row.githubRef)
                ? { githubRef: parseGithubRef(row.githubRef) }
                : {}),
              latestTurn,
              session: sessionByThread.get(row.threadId) ?? null,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              lastUserMessageAt: row.lastUserMessageAt,
              pendingApprovalCount: row.pendingApprovalCount,
              pendingUserInputCount: row.pendingUserInputCount,
              hasActionablePlan: hasActionablePlan(
                plansByThread.get(row.threadId) ?? [],
                latestTurn,
              ),
            };
          });

          const updatedAtCandidates = [
            ...projectRows.map((row) => row.updatedAt),
            ...threadRows.map((row) => row.updatedAt),
            ...sessionRows.map((row) => row.updatedAt),
            ...stateRows.map((row) => row.updatedAt),
          ];

          return Schema.decodeUnknownSync(OrchestrationOverviewSnapshot)({
            snapshotSequence: computeSnapshotSequence(stateRows),
            limits: {
              maxProjects: MAX_PROJECTS,
              maxThreadsPerProject: MAX_THREADS_PER_PROJECT,
            },
            projects,
            threads,
            updatedAt:
              updatedAtCandidates.sort((left, right) =>
                left < right ? 1 : left > right ? -1 : 0,
              )[0] ?? new Date(0).toISOString(),
          });
        }),
      )
      .pipe(
        Effect.mapError((cause): ProjectionRepositoryError => {
          if (Schema.isSchemaError(cause)) {
            return toPersistenceDecodeError("ProjectionOverviewQuery.getOverview:decode")(cause);
          }
          return isPersistenceError(cause)
            ? cause
            : toPersistenceSqlError("ProjectionOverviewQuery.getOverview:query")(cause);
        }),
      );

  return { getOverview } satisfies ProjectionOverviewQueryShape;
});

export const OrchestrationProjectionOverviewQueryLive = Layer.effect(
  ProjectionOverviewQuery,
  makeProjectionOverviewQuery,
);
