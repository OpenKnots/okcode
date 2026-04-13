import {
  ChatAttachment,
  IsoDateTime,
  MessageId,
  NonNegativeInt,
  OrchestrationCheckpointFile,
  OrchestrationProposedPlanId,
  OrchestrationThread,
  ThreadId,
  TurnId,
  type OrchestrationCheckpointSummary,
  type OrchestrationLatestTurn,
  type OrchestrationMessage,
  type OrchestrationProposedPlan,
  type OrchestrationSession,
  type OrchestrationThreadActivity,
} from "@okcode/contracts";
import { Effect, Layer, Option, Schema, Struct } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";

import {
  isPersistenceError,
  toPersistenceDecodeError,
  toPersistenceSqlError,
  type ProjectionRepositoryError,
} from "../../persistence/Errors.ts";
import { ProjectionCheckpoint } from "../../persistence/Services/ProjectionCheckpoints.ts";
import { ProjectionThreadActivity } from "../../persistence/Services/ProjectionThreadActivities.ts";
import { ProjectionThreadMessage } from "../../persistence/Services/ProjectionThreadMessages.ts";
import { ProjectionThreadProposedPlan } from "../../persistence/Services/ProjectionThreadProposedPlans.ts";
import { ProjectionThreadSession } from "../../persistence/Services/ProjectionThreadSessions.ts";
import { ProjectionThread } from "../../persistence/Services/ProjectionThreads.ts";
import {
  ProjectionThreadDetailQuery,
  type ProjectionThreadDetailQueryShape,
} from "../Services/ProjectionThreadDetailQuery.ts";

const ProjectionThreadMessageDbRowSchema = ProjectionThreadMessage.mapFields(
  Struct.assign({
    isStreaming: Schema.Number,
    attachments: Schema.NullOr(Schema.fromJsonString(Schema.Array(ChatAttachment))),
  }),
);
const ProjectionThreadProposedPlanDbRowSchema = ProjectionThreadProposedPlan;
const ProjectionThreadDbRowSchema = ProjectionThread;
const ProjectionThreadActivityDbRowSchema = ProjectionThreadActivity.mapFields(
  Struct.assign({
    payload: Schema.fromJsonString(Schema.Unknown),
    sequence: Schema.NullOr(NonNegativeInt),
  }),
);
const ProjectionThreadSessionDbRowSchema = ProjectionThreadSession;
const ProjectionCheckpointDbRowSchema = ProjectionCheckpoint.mapFields(
  Struct.assign({
    files: Schema.fromJsonString(Schema.Array(OrchestrationCheckpointFile)),
  }),
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

function parseGithubRef(serialized: string | null): OrchestrationThread["githubRef"] | undefined {
  if (!serialized) return undefined;
  try {
    return JSON.parse(serialized) as OrchestrationThread["githubRef"];
  } catch {
    return undefined;
  }
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

const makeProjectionThreadDetailQuery = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getThreadRow = SqlSchema.findOneOption({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionThreadDbRowSchema,
    execute: ({ threadId }) =>
      sql`
        SELECT
          thread_id AS "threadId",
          project_id AS "projectId",
          title,
          model,
          runtime_mode AS "runtimeMode",
          interaction_mode AS "interactionMode",
          branch,
          worktree_path AS "worktreePath",
          github_ref AS "githubRef",
          latest_turn_id AS "latestTurnId",
          created_at AS "createdAt",
          updated_at AS "updatedAt",
          deleted_at AS "deletedAt"
        FROM projection_threads
        WHERE thread_id = ${threadId}
      `,
  });

  const listThreadMessageRows = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionThreadMessageDbRowSchema,
    execute: ({ threadId }) =>
      sql`
        SELECT
          message_id AS "messageId",
          thread_id AS "threadId",
          turn_id AS "turnId",
          role,
          text,
          attachments_json AS "attachments",
          is_streaming AS "isStreaming",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM projection_thread_messages
        WHERE thread_id = ${threadId}
        ORDER BY created_at ASC, message_id ASC
      `,
  });

  const listThreadProposedPlanRows = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionThreadProposedPlanDbRowSchema,
    execute: ({ threadId }) =>
      sql`
        SELECT
          plan_id AS "planId",
          thread_id AS "threadId",
          turn_id AS "turnId",
          plan_markdown AS "planMarkdown",
          implemented_at AS "implementedAt",
          implementation_thread_id AS "implementationThreadId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM projection_thread_proposed_plans
        WHERE thread_id = ${threadId}
        ORDER BY created_at ASC, plan_id ASC
      `,
  });

  const listThreadActivityRows = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionThreadActivityDbRowSchema,
    execute: ({ threadId }) =>
      sql`
        SELECT
          activity_id AS "activityId",
          thread_id AS "threadId",
          turn_id AS "turnId",
          tone,
          kind,
          summary,
          payload_json AS "payload",
          sequence,
          created_at AS "createdAt"
        FROM projection_thread_activities
        WHERE thread_id = ${threadId}
        ORDER BY
          CASE WHEN sequence IS NULL THEN 0 ELSE 1 END ASC,
          sequence ASC,
          created_at ASC,
          activity_id ASC
      `,
  });

  const getThreadSessionRow = SqlSchema.findOneOption({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionThreadSessionDbRowSchema,
    execute: ({ threadId }) =>
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
        WHERE thread_id = ${threadId}
      `,
  });

  const listCheckpointRows = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionCheckpointDbRowSchema,
    execute: ({ threadId }) =>
      sql`
        SELECT
          thread_id AS "threadId",
          turn_id AS "turnId",
          checkpoint_turn_count AS "checkpointTurnCount",
          checkpoint_ref AS "checkpointRef",
          checkpoint_status AS "status",
          checkpoint_files_json AS "files",
          assistant_message_id AS "assistantMessageId",
          completed_at AS "completedAt"
        FROM projection_turns
        WHERE thread_id = ${threadId}
          AND checkpoint_turn_count IS NOT NULL
        ORDER BY checkpoint_turn_count ASC
      `,
  });

  const listLatestTurnRows = SqlSchema.findAll({
    Request: Schema.Struct({ threadId: ThreadId }),
    Result: ProjectionLatestTurnDbRowSchema,
    execute: ({ threadId }) =>
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
        WHERE thread_id = ${threadId}
          AND turn_id IS NOT NULL
        ORDER BY requested_at DESC, turn_id DESC
      `,
  });

  const getThreadDetail: ProjectionThreadDetailQueryShape["getThreadDetail"] = (input) =>
    sql
      .withTransaction(
        Effect.gen(function* () {
          const threadRow = yield* getThreadRow(input);
          if (Option.isNone(threadRow) || threadRow.value.deletedAt !== null) {
            return null;
          }

          const [
            messageRows,
            proposedPlanRows,
            activityRows,
            sessionRow,
            checkpointRows,
            latestTurnRows,
          ] = yield* Effect.all([
            listThreadMessageRows(input),
            listThreadProposedPlanRows(input),
            listThreadActivityRows(input),
            getThreadSessionRow(input),
            listCheckpointRows(input),
            listLatestTurnRows(input),
          ]);

          const messages: OrchestrationMessage[] = messageRows.map((row) => {
            if (row.attachments !== null) {
              return {
                id: row.messageId,
                role: row.role,
                text: row.text,
                attachments: row.attachments,
                turnId: row.turnId,
                streaming: row.isStreaming === 1,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
              };
            }
            return {
              id: row.messageId,
              role: row.role,
              text: row.text,
              turnId: row.turnId,
              streaming: row.isStreaming === 1,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
            };
          });

          const proposedPlans: OrchestrationProposedPlan[] = proposedPlanRows.map((row) => ({
            id: row.planId,
            turnId: row.turnId,
            planMarkdown: row.planMarkdown,
            implementedAt: row.implementedAt,
            implementationThreadId: row.implementationThreadId,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          }));

          const activities: OrchestrationThreadActivity[] = activityRows.map((row) => {
            if (row.sequence !== null) {
              return {
                id: row.activityId,
                tone: row.tone,
                kind: row.kind,
                summary: row.summary,
                payload: row.payload,
                turnId: row.turnId,
                sequence: row.sequence,
                createdAt: row.createdAt,
              };
            }
            return {
              id: row.activityId,
              tone: row.tone,
              kind: row.kind,
              summary: row.summary,
              payload: row.payload,
              turnId: row.turnId,
              createdAt: row.createdAt,
            };
          });

          const checkpoints: OrchestrationCheckpointSummary[] = checkpointRows.map((row) => ({
            turnId: row.turnId,
            checkpointTurnCount: row.checkpointTurnCount,
            checkpointRef: row.checkpointRef,
            status: row.status,
            files: row.files,
            assistantMessageId: row.assistantMessageId,
            completedAt: row.completedAt,
          }));

          const session: OrchestrationSession | null = Option.isSome(sessionRow)
            ? {
                threadId: sessionRow.value.threadId,
                status: sessionRow.value.status,
                providerName: sessionRow.value.providerName,
                runtimeMode: sessionRow.value.runtimeMode,
                activeTurnId: sessionRow.value.activeTurnId,
                lastError: sessionRow.value.lastError,
                updatedAt: sessionRow.value.updatedAt,
              }
            : null;

          return Schema.decodeUnknownSync(OrchestrationThread)({
            id: threadRow.value.threadId,
            projectId: threadRow.value.projectId,
            title: threadRow.value.title,
            model: threadRow.value.model,
            runtimeMode: threadRow.value.runtimeMode,
            interactionMode: threadRow.value.interactionMode,
            branch: threadRow.value.branch,
            worktreePath: threadRow.value.worktreePath,
            ...(parseGithubRef(threadRow.value.githubRef)
              ? { githubRef: parseGithubRef(threadRow.value.githubRef) }
              : {}),
            latestTurn: latestTurnRows[0] ? toLatestTurn(latestTurnRows[0]) : null,
            createdAt: threadRow.value.createdAt,
            updatedAt: threadRow.value.updatedAt,
            deletedAt: null,
            messages,
            proposedPlans,
            activities,
            checkpoints,
            session,
          });
        }),
      )
      .pipe(
        Effect.mapError((cause): ProjectionRepositoryError => {
          if (Schema.isSchemaError(cause)) {
            return toPersistenceDecodeError("ProjectionThreadDetailQuery.getThreadDetail:decode")(
              cause,
            );
          }
          return isPersistenceError(cause)
            ? cause
            : toPersistenceSqlError("ProjectionThreadDetailQuery.getThreadDetail:query")(cause);
        }),
      );

  return { getThreadDetail } satisfies ProjectionThreadDetailQueryShape;
});

export const OrchestrationProjectionThreadDetailQueryLive = Layer.effect(
  ProjectionThreadDetailQuery,
  makeProjectionThreadDetailQuery,
);
