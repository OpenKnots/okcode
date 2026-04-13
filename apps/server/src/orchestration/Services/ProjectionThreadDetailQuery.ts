import type { OrchestrationThread, ThreadId } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../../persistence/Errors.ts";

export interface ProjectionThreadDetailQueryShape {
  readonly getThreadDetail: (input: {
    readonly threadId: ThreadId;
  }) => Effect.Effect<OrchestrationThread | null, ProjectionRepositoryError>;
}

export class ProjectionThreadDetailQuery extends ServiceMap.Service<
  ProjectionThreadDetailQuery,
  ProjectionThreadDetailQueryShape
>()("okcode/orchestration/Services/ProjectionThreadDetailQuery") {}
