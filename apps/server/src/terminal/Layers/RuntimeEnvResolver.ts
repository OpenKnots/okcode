import { Layer } from "effect";

import { ProjectionThreadRepositoryLive } from "../../persistence/Layers/ProjectionThreads.ts";
import { EnvironmentVariablesLive } from "../../persistence/Services/EnvironmentVariables.ts";
import {
  makeTerminalRuntimeEnvResolver,
  TerminalRuntimeEnvResolver,
} from "../Services/RuntimeEnvResolver.ts";

export const TerminalRuntimeEnvResolverLive = Layer.effect(
  TerminalRuntimeEnvResolver,
  makeTerminalRuntimeEnvResolver,
).pipe(
  Layer.provideMerge(ProjectionThreadRepositoryLive),
  Layer.provideMerge(EnvironmentVariablesLive),
);
