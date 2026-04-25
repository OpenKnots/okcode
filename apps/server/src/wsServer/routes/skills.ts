import { WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createSkillRouteHandlers(input: {
  skillServiceLoader: Effect.Effect<any, unknown, never>;
}): WebSocketRouteRegistry {
  return {
    [WS_METHODS.skillList]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.list(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillCatalog]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.catalog(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillRead]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.read(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillCreate]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.create(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillDelete]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.delete(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillInstall]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.install(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillUninstall]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.uninstall(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillImport]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.importSkill(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.skillSearch]: (_ws, request) =>
      Effect.gen(function* () {
        const skillService = yield* input.skillServiceLoader;
        return yield* skillService.search(stripTaggedBody(request.body as any) as any);
      }),
  };
}
