import { ApprovalRequestId, IsoDateTime, ThreadId, TurnId } from "@okcode/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionPendingUserInput = Schema.Struct({
  requestId: ApprovalRequestId,
  threadId: ThreadId,
  turnId: Schema.NullOr(TurnId),
  status: Schema.Literals(["pending", "resolved"]),
  createdAt: IsoDateTime,
  resolvedAt: Schema.NullOr(IsoDateTime),
});
export type ProjectionPendingUserInput = typeof ProjectionPendingUserInput.Type;

export const ListProjectionPendingUserInputsInput = Schema.Struct({
  threadId: ThreadId,
});
export type ListProjectionPendingUserInputsInput = typeof ListProjectionPendingUserInputsInput.Type;

export const GetProjectionPendingUserInputInput = Schema.Struct({
  requestId: ApprovalRequestId,
});
export type GetProjectionPendingUserInputInput = typeof GetProjectionPendingUserInputInput.Type;

export const DeleteProjectionPendingUserInputInput = Schema.Struct({
  requestId: ApprovalRequestId,
});
export type DeleteProjectionPendingUserInputInput = typeof DeleteProjectionPendingUserInputInput.Type;

export interface ProjectionPendingUserInputRepositoryShape {
  readonly upsert: (
    row: ProjectionPendingUserInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly listByThreadId: (
    input: ListProjectionPendingUserInputsInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionPendingUserInput>, ProjectionRepositoryError>;
  readonly getByRequestId: (
    input: GetProjectionPendingUserInputInput,
  ) => Effect.Effect<Option.Option<ProjectionPendingUserInput>, ProjectionRepositoryError>;
  readonly deleteByRequestId: (
    input: DeleteProjectionPendingUserInputInput,
  ) => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionPendingUserInputRepository extends ServiceMap.Service<
  ProjectionPendingUserInputRepository,
  ProjectionPendingUserInputRepositoryShape
>()(
  "okcode/persistence/Services/ProjectionPendingUserInputs/ProjectionPendingUserInputRepository",
) {}
