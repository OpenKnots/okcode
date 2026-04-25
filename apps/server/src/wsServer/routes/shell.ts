import { WS_METHODS } from "@okcode/contracts";
import { Effect } from "effect";

import type { WebSocketRouteRegistry } from "./shared";
import { stripTaggedBody } from "./shared";

export function createShellRouteHandlers(input: {
  openInEditor: (body: unknown) => Effect.Effect<unknown, unknown, never>;
  openInFileManager: (body: unknown) => Effect.Effect<unknown, unknown, never>;
  revealInFileManager: (body: unknown) => Effect.Effect<unknown, unknown, never>;
}): WebSocketRouteRegistry {
  return {
    [WS_METHODS.shellOpenInEditor]: (_ws, request) =>
      input.openInEditor(stripTaggedBody(request.body as any)),

    [WS_METHODS.shellOpenInFileManager]: (_ws, request) =>
      input.openInFileManager(stripTaggedBody(request.body as any)),

    [WS_METHODS.shellRevealInFileManager]: (_ws, request) =>
      input.revealInFileManager(stripTaggedBody(request.body as any)),
  };
}
