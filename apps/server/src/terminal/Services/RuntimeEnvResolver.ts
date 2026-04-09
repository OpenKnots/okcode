import { type ThreadId } from "@okcode/contracts";
import { type EnvironmentRecord, mergeEnvironmentRecords } from "@okcode/shared/environment";
import { Effect, Option, ServiceMap } from "effect";

import { type ProjectionRepositoryError } from "../../persistence/Errors.ts";
import {
  EnvironmentVariables,
  type EnvironmentVariablesError,
} from "../../persistence/Services/EnvironmentVariables.ts";
import { ProjectionThreadRepository } from "../../persistence/Services/ProjectionThreads.ts";

export interface TerminalRuntimeEnvResolverInput {
  readonly threadId: ThreadId;
  readonly cwd?: string | null;
  readonly extraEnv?: EnvironmentRecord;
}

export type TerminalRuntimeEnvResolverError = ProjectionRepositoryError | EnvironmentVariablesError;

export interface TerminalRuntimeEnvResolverShape {
  readonly resolve: (
    input: TerminalRuntimeEnvResolverInput,
  ) => Effect.Effect<Record<string, string>, TerminalRuntimeEnvResolverError>;
}

export class TerminalRuntimeEnvResolver extends ServiceMap.Service<
  TerminalRuntimeEnvResolver,
  TerminalRuntimeEnvResolverShape
>()("okcode/terminal/Services/RuntimeEnvResolver") {}

export const makeTerminalRuntimeEnvResolver = Effect.gen(function* () {
  const threadRepository = yield* ProjectionThreadRepository;
  const environmentVariables = yield* EnvironmentVariables;

  const resolve: TerminalRuntimeEnvResolverShape["resolve"] = (input) =>
    Effect.gen(function* () {
      const threadOption = yield* threadRepository.getById({ threadId: input.threadId });
      const liveThread =
        Option.isSome(threadOption) && threadOption.value.deletedAt === null
          ? threadOption.value
          : null;
      const baseEnv =
        liveThread === null
          ? yield* environmentVariables.resolveEnvironment()
          : yield* environmentVariables.resolveEnvironment({
              projectId: liveThread.projectId,
            });
      return mergeEnvironmentRecords(baseEnv, input.extraEnv);
    });

  return {
    resolve,
  } satisfies TerminalRuntimeEnvResolverShape;
});
