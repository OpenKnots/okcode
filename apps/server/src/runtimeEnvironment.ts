import type { OrchestrationReadModel, ProjectId } from "@okcode/contracts";
import { Effect } from "effect";

import {
  mergeEnvironmentRecords,
  resolveProjectContextByCwd,
  type EnvironmentRecord,
} from "@okcode/shared/environment";

import { EnvironmentVariables } from "./persistence/Services/EnvironmentVariables";

export interface RuntimeEnvironmentInput {
  readonly projectId?: ProjectId | null;
  readonly cwd?: string | null;
  readonly readModel?: OrchestrationReadModel | null;
  readonly extraEnv?: EnvironmentRecord;
}

export const resolveRuntimeEnvironment = Effect.fnUntraced(function* (
  input: RuntimeEnvironmentInput = {},
) {
  const environmentVariables = yield* EnvironmentVariables;
  let projectId = input.projectId ?? null;

  if (projectId === null && input.cwd && input.readModel) {
    const projectContext = resolveProjectContextByCwd(input.readModel, input.cwd);
    projectId = projectContext?.projectId ?? null;
  }

  const baseEnv = projectId
    ? yield* environmentVariables.resolveEnvironment({ projectId })
    : yield* environmentVariables.resolveEnvironment();

  return mergeEnvironmentRecords(baseEnv, input.extraEnv);
});
