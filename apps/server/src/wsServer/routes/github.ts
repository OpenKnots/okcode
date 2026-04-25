import { WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createGitHubRouteHandlers(input: {
  githubLoader: Effect.Effect<any, unknown, never>;
}): WebSocketRouteRegistry {
  return {
    [WS_METHODS.githubListIssues]: (_ws, request) =>
      Effect.gen(function* () {
        const github = yield* input.githubLoader;
        return yield* github.listIssues(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.githubGetIssue]: (_ws, request) =>
      Effect.gen(function* () {
        const github = yield* input.githubLoader;
        return yield* github.getIssue(stripTaggedBody(request.body as any) as any);
      }),

    [WS_METHODS.githubPostComment]: (_ws, request) =>
      Effect.gen(function* () {
        const github = yield* input.githubLoader;
        return yield* github.postComment(stripTaggedBody(request.body as any) as any);
      }),
  };
}
