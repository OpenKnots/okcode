import type { OrchestrationOverviewSnapshot } from "@okcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../../persistence/Errors.ts";

export interface ProjectionOverviewQueryShape {
  readonly getOverview: () => Effect.Effect<OrchestrationOverviewSnapshot, ProjectionRepositoryError>;
}

export class ProjectionOverviewQuery extends ServiceMap.Service<
  ProjectionOverviewQuery,
  ProjectionOverviewQueryShape
>()("okcode/orchestration/Services/ProjectionOverviewQuery") {}
