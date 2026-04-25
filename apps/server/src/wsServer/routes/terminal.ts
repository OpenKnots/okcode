import { ThreadId, WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createTerminalRouteHandlers(input: {
  terminalRuntimeEnvResolverLoader: Effect.Effect<any, unknown, never>;
  terminalManagerWithSubscription: Effect.Effect<any, unknown, never>;
  logger: {
    info: (message: string, data: Record<string, unknown>) => void;
  };
}): WebSocketRouteRegistry {
  return {
    [WS_METHODS.terminalOpen]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const terminalRuntimeEnvResolver = yield* input.terminalRuntimeEnvResolverLoader;
        const terminalManager = yield* input.terminalManagerWithSubscription;
        const envResolutionStartedAt = performance.now();
        const runtimeEnv = yield* terminalRuntimeEnvResolver.resolve({
          threadId: ThreadId.makeUnsafe(body.threadId),
          cwd: body.cwd,
          ...(body.env !== undefined ? { extraEnv: body.env } : {}),
        });
        const envResolutionMs =
          Math.round((performance.now() - envResolutionStartedAt) * 100) / 100;
        const session = yield* terminalManager.open({
          ...body,
          env: runtimeEnv,
        });
        input.logger.info("terminal open prepared", {
          threadId: body.threadId,
          terminalId: body.terminalId ?? "default",
          envResolutionMs,
        });
        return session;
      }),

    [WS_METHODS.terminalWrite]: (_ws, request) =>
      Effect.gen(function* () {
        const terminalManager = yield* input.terminalManagerWithSubscription;
        return yield* terminalManager.write(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.terminalResize]: (_ws, request) =>
      Effect.gen(function* () {
        const terminalManager = yield* input.terminalManagerWithSubscription;
        return yield* terminalManager.resize(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.terminalClear]: (_ws, request) =>
      Effect.gen(function* () {
        const terminalManager = yield* input.terminalManagerWithSubscription;
        return yield* terminalManager.clear(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.terminalRestart]: (_ws, request) =>
      Effect.gen(function* () {
        const body = stripTaggedBody(request.body as any) as any;
        const terminalRuntimeEnvResolver = yield* input.terminalRuntimeEnvResolverLoader;
        const terminalManager = yield* input.terminalManagerWithSubscription;
        const envResolutionStartedAt = performance.now();
        const runtimeEnv = yield* terminalRuntimeEnvResolver.resolve({
          threadId: ThreadId.makeUnsafe(body.threadId),
          cwd: body.cwd,
          ...(body.env !== undefined ? { extraEnv: body.env } : {}),
        });
        const envResolutionMs =
          Math.round((performance.now() - envResolutionStartedAt) * 100) / 100;
        const session = yield* terminalManager.restart({
          ...body,
          env: runtimeEnv,
        });
        input.logger.info("terminal restart prepared", {
          threadId: body.threadId,
          terminalId: body.terminalId ?? "default",
          envResolutionMs,
        });
        return session;
      }),

    [WS_METHODS.terminalClose]: (_ws, request) =>
      Effect.gen(function* () {
        const terminalManager = yield* input.terminalManagerWithSubscription;
        return yield* terminalManager.close(stripTaggedBody(request.body as any) as any);
      }),
  };
}
