import type { OrchestrationReadModel, ProjectId } from "@okcode/contracts";
import { Effect, Option, ServiceMap } from "effect";

import {
  mergeEnvironmentRecords,
  resolveProjectContextByCwd,
  type EnvironmentRecord,
} from "@okcode/shared/environment";

import { EnvironmentVariables } from "./persistence/Services/EnvironmentVariables";

/**
 * Optional service carrying resolved runtime environment variables.
 *
 * Provided via `Effect.provideService` at the handler boundary so that
 * downstream services (GitCore, GitHubCli, …) can read the project-/global-
 * scoped env without requiring explicit parameter threading through every
 * layer.
 *
 * Uses `Effect.serviceOption` on the consumer side so that the service
 * requirement does NOT propagate into every downstream type signature.
 */
export class RuntimeEnv extends ServiceMap.Service<RuntimeEnv, EnvironmentRecord>()(
  "okcode/RuntimeEnv",
) {}

/**
 * Read the current runtime environment from the fiber context.
 * Returns an empty record when the service has not been provided.
 */
export const getRuntimeEnv = (): Effect.Effect<EnvironmentRecord> =>
  Effect.serviceOption(RuntimeEnv).pipe(Effect.map((opt) => (Option.isSome(opt) ? opt.value : {})));

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
