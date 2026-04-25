import type { WebSocketRequest } from "@okcode/contracts";
import type { Effect } from "effect";
import { Struct } from "effect";
import type { WebSocket } from "ws";

export type WebSocketRouteHandler = (
  ws: WebSocket,
  request: WebSocketRequest,
) => Effect.Effect<unknown, unknown, unknown>;

export type WebSocketRouteRegistry = Partial<
  Record<WebSocketRequest["body"]["_tag"], WebSocketRouteHandler>
>;

export type TaggedRequestBody<TTag extends WebSocketRequest["body"]["_tag"]> = Extract<
  WebSocketRequest["body"],
  { _tag: TTag }
>;

export function stripTaggedBody<T extends { _tag: string }>(body: T) {
  return Struct.omit(body, ["_tag"]);
}
