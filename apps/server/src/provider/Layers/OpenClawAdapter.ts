/**
 * OpenClawAdapterLive - Scoped live implementation for the OpenClaw gateway provider adapter.
 *
 * Connects to an OpenClaw gateway over WebSocket using JSON-RPC 2.0, manages
 * stateful server-side sessions, and emits canonical runtime events.
 *
 * @module OpenClawAdapterLive
 */
import WebSocket from "ws";
import {
  ApprovalRequestId,
  type CanonicalItemType,
  type CanonicalRequestType,
  EventId,
  type ProviderApprovalDecision,
  type ProviderRuntimeEvent,
  type ProviderRuntimeTurnStatus,
  type ProviderSession,
  type ProviderUserInputAnswers,
  type RuntimeContentStreamKind,
  RuntimeItemId,
  RuntimeRequestId,
  type RuntimeSessionState,
  RuntimeTaskId,
  ThreadId,
  TurnId,
  isToolLifecycleItemType,
} from "@okcode/contracts";
import { Deferred, Effect, Fiber, Layer, Queue, Random, Stream } from "effect";

import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionClosedError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
  type ProviderAdapterError,
} from "../Errors.ts";
import { OpenClawAdapter, type OpenClawAdapterShape } from "../Services/OpenClawAdapter.ts";
import { type EventNdjsonLogger } from "./EventNdjsonLogger.ts";

// ── Constants ──────────────────────────────────────────────────────

const PROVIDER = "openclaw" as const;
const JSON_RPC_VERSION = "2.0" as const;
const DEFAULT_GATEWAY_URL = "ws://localhost:8080";
const RPC_TIMEOUT_MS = 30_000;
const WS_CONNECT_TIMEOUT_MS = 10_000;

// ── JSON-RPC 2.0 types ────────────────────────────────────────────

interface JsonRpcRequest {
  readonly jsonrpc: typeof JSON_RPC_VERSION;
  readonly method: string;
  readonly params?: Record<string, unknown>;
  readonly id: number;
}

interface JsonRpcResponse {
  readonly jsonrpc: typeof JSON_RPC_VERSION;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string; readonly data?: unknown };
  readonly id: number | string | null;
}

interface JsonRpcNotification {
  readonly jsonrpc: typeof JSON_RPC_VERSION;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

type JsonRpcMessage = JsonRpcResponse | JsonRpcNotification;

function isJsonRpcResponse(msg: JsonRpcMessage): msg is JsonRpcResponse {
  return "id" in msg && msg.id !== undefined && msg.id !== null;
}

// ── Resume cursor ──────────────────────────────────────────────────

interface OpenClawResumeCursor {
  readonly version: 1;
  readonly gatewaySessionId: string;
}

function readResumeCursor(cursor: unknown): OpenClawResumeCursor | undefined {
  if (
    typeof cursor === "object" &&
    cursor !== null &&
    "version" in cursor &&
    (cursor as Record<string, unknown>).version === 1 &&
    "gatewaySessionId" in cursor &&
    typeof (cursor as Record<string, unknown>).gatewaySessionId === "string"
  ) {
    return cursor as OpenClawResumeCursor;
  }
  return undefined;
}

function makeResumeCursor(gatewaySessionId: string): OpenClawResumeCursor {
  return { version: 1, gatewaySessionId };
}

// ── Turn state ─────────────────────────────────────────────────────

interface OpenClawTurnState {
  readonly turnId: TurnId;
  readonly startedAt: string;
}

// ── Pending approval / user-input ──────────────────────────────────

interface PendingApproval {
  readonly requestType: CanonicalRequestType;
  readonly detail?: string;
  readonly decision: Deferred.Deferred<ProviderApprovalDecision>;
}

interface PendingUserInput {
  readonly questions: ReadonlyArray<unknown>;
  readonly answers: Deferred.Deferred<ProviderUserInputAnswers>;
}

// ── Session context ────────────────────────────────────────────────

interface OpenClawSessionContext {
  session: ProviderSession;
  ws: WebSocket;
  gatewaySessionId: string;
  readonly pendingRpcCalls: Map<number, Deferred.Deferred<JsonRpcResponse>>;
  readonly pendingApprovals: Map<ApprovalRequestId, PendingApproval>;
  readonly pendingUserInputs: Map<ApprovalRequestId, PendingUserInput>;
  turnState: OpenClawTurnState | undefined;
  nextRpcId: number;
  streamFiber: Fiber.Fiber<void, Error> | undefined;
  stopped: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────

function nowIsoString(): string {
  return new Date().toISOString();
}

function toMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return fallback;
}

// ── Adapter factory ────────────────────────────────────────────────

export interface OpenClawAdapterLiveOptions {
  readonly nativeEventLogger?: EventNdjsonLogger;
}

function makeOpenClawAdapter(options?: OpenClawAdapterLiveOptions) {
  return Effect.gen(function* () {
    const runtimeEventQueue = yield* Queue.unbounded<ProviderRuntimeEvent>();
    const sessions = new Map<ThreadId, OpenClawSessionContext>();

    // ── Event emission helpers ──────────────────────────────────

    const emitEvent = (event: ProviderRuntimeEvent): Effect.Effect<void> =>
      Queue.offer(runtimeEventQueue, event).pipe(Effect.asVoid);

    const makeEventBase = (
      threadId: ThreadId,
      turnId?: TurnId,
      itemId?: string,
      requestId?: string,
    ) => ({
      eventId: EventId.makeUnsafe(crypto.randomUUID()),
      provider: PROVIDER,
      threadId,
      createdAt: nowIsoString(),
      ...(turnId ? { turnId } : {}),
      ...(itemId ? { itemId: RuntimeItemId.makeUnsafe(itemId) } : {}),
      ...(requestId ? { requestId: RuntimeRequestId.makeUnsafe(requestId) } : {}),
      providerRefs: {},
    });

    // ── WebSocket + JSON-RPC helpers ────────────────────────────

    const connectWebSocket = (url: string): Effect.Effect<WebSocket, ProviderAdapterProcessError> =>
      Effect.callback<WebSocket, ProviderAdapterProcessError>((resume) => {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          ws.close();
          resume(
            Effect.fail(
              new ProviderAdapterProcessError({
                provider: PROVIDER,
                threadId: "pending",
                detail: `WebSocket connection to ${url} timed out after ${WS_CONNECT_TIMEOUT_MS}ms.`,
              }),
            ),
          );
        }, WS_CONNECT_TIMEOUT_MS);

        ws.on("open", () => {
          clearTimeout(timeout);
          resume(Effect.succeed(ws));
        });
        ws.on("error", (error) => {
          clearTimeout(timeout);
          resume(
            Effect.fail(
              new ProviderAdapterProcessError({
                provider: PROVIDER,
                threadId: "pending",
                detail: `WebSocket connection to ${url} failed: ${toMessage(error, "Unknown error")}`,
                cause: error,
              }),
            ),
          );
        });
      });

    const sendRpc = (
      context: OpenClawSessionContext,
      method: string,
      params?: Record<string, unknown>,
    ): Effect.Effect<JsonRpcResponse, ProviderAdapterRequestError> =>
      Effect.gen(function* () {
        if (context.stopped || context.ws.readyState !== WebSocket.OPEN) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method,
            detail: "WebSocket is not open.",
          });
        }
        const id = context.nextRpcId++;
        const deferred = yield* Deferred.make<JsonRpcResponse>();
        context.pendingRpcCalls.set(id, deferred);
        const request: JsonRpcRequest = {
          jsonrpc: JSON_RPC_VERSION,
          method,
          ...(params !== undefined ? { params } : {}),
          id,
        };
        context.ws.send(JSON.stringify(request));
        const response = yield* Deferred.await(deferred).pipe(
          Effect.timeoutOrElse({
            duration: RPC_TIMEOUT_MS,
            onTimeout: () =>
              Effect.fail(
                new ProviderAdapterRequestError({
                  provider: PROVIDER,
                  method,
                  detail: `RPC call '${method}' timed out after ${RPC_TIMEOUT_MS}ms.`,
                }),
              ),
          }),
        );
        context.pendingRpcCalls.delete(id);
        if (response.error) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method,
            detail: `RPC error ${response.error.code}: ${response.error.message}`,
          });
        }
        return response;
      });

    // ── Notification → canonical event mapping ──────────────────

    const mapNotificationToEvents = (
      context: OpenClawSessionContext,
      notification: JsonRpcNotification,
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        const { method, params } = notification;
        const threadId = context.session.threadId;
        const turnId = context.turnState?.turnId;
        const p = (params ?? {}) as Record<string, unknown>;

        if (options?.nativeEventLogger) {
          yield* options.nativeEventLogger.write(
            {
              observedAt: nowIsoString(),
              threadId,
              turnId,
              source: "openclaw.gateway.notification",
              method,
              payload: params,
            },
            threadId,
          );
        }

        switch (method) {
          case "session.started": {
            const sessionStartedPayload: Record<string, unknown> = {};
            if (typeof p.message === "string") {
              sessionStartedPayload.message = p.message;
            }
            yield* emitEvent({
              ...makeEventBase(threadId),
              type: "session.started",
              payload: sessionStartedPayload,
            });
            break;
          }

          case "session.configured": {
            yield* emitEvent({
              ...makeEventBase(threadId),
              type: "session.configured",
              payload: {
                config: (p.config && typeof p.config === "object"
                  ? (p.config as Record<string, unknown>)
                  : {}) as { [x: string]: unknown },
              },
            });
            break;
          }

          case "session.state.changed": {
            const rawState = typeof p.state === "string" ? p.state : "ready";
            const sessionState: RuntimeSessionState =
              rawState === "running"
                ? "running"
                : rawState === "error"
                  ? "error"
                  : rawState === "stopped"
                    ? "stopped"
                    : rawState === "waiting"
                      ? "waiting"
                      : rawState === "starting"
                        ? "starting"
                        : "ready";
            context.session = {
              ...context.session,
              status:
                sessionState === "running"
                  ? "running"
                  : sessionState === "error"
                    ? "error"
                    : sessionState === "stopped"
                      ? "closed"
                      : "ready",
              updatedAt: nowIsoString(),
            };
            yield* emitEvent({
              ...makeEventBase(threadId),
              type: "session.state.changed",
              payload: { state: sessionState },
            });
            break;
          }

          case "turn.started": {
            const gatewayTurnId = typeof p.turnId === "string" ? p.turnId : undefined;
            if (context.turnState) {
              yield* emitEvent({
                ...makeEventBase(threadId, context.turnState.turnId),
                type: "turn.started",
                payload: {},
                ...(gatewayTurnId ? { providerRefs: { providerTurnId: gatewayTurnId } } : {}),
              });
            }
            break;
          }

          case "content.delta": {
            const delta =
              typeof p.delta === "string"
                ? p.delta
                : typeof p.textDelta === "string"
                  ? p.textDelta
                  : "";
            const streamKind: RuntimeContentStreamKind =
              typeof p.streamKind === "string" &&
              (p.streamKind === "assistant_text" ||
                p.streamKind === "reasoning_text" ||
                p.streamKind === "reasoning_summary_text" ||
                p.streamKind === "plan_text" ||
                p.streamKind === "command_output" ||
                p.streamKind === "file_change_output" ||
                p.streamKind === "unknown")
                ? p.streamKind
                : "assistant_text";
            const itemId = typeof p.itemId === "string" ? p.itemId : crypto.randomUUID();
            yield* emitEvent({
              ...makeEventBase(threadId, turnId, itemId),
              type: "content.delta",
              payload: { delta, streamKind },
            });
            break;
          }

          case "item.started": {
            const itemId = typeof p.itemId === "string" ? p.itemId : crypto.randomUUID();
            const rawItemType = typeof p.itemType === "string" ? p.itemType : "unknown";
            const itemType: CanonicalItemType = isToolLifecycleItemType(rawItemType)
              ? rawItemType
              : rawItemType === "user_message" ||
                  rawItemType === "assistant_message" ||
                  rawItemType === "reasoning" ||
                  rawItemType === "plan" ||
                  rawItemType === "review_entered" ||
                  rawItemType === "review_exited" ||
                  rawItemType === "context_compaction" ||
                  rawItemType === "error"
                ? rawItemType
                : "unknown";
            yield* emitEvent({
              ...makeEventBase(threadId, turnId, itemId),
              type: "item.started",
              payload: {
                itemType,
                status: "inProgress",
                ...(typeof p.title === "string" ? { title: p.title } : {}),
                ...(typeof p.detail === "string" ? { detail: p.detail } : {}),
              },
            });
            break;
          }

          case "item.completed": {
            const itemId = typeof p.itemId === "string" ? p.itemId : crypto.randomUUID();
            const rawItemType = typeof p.itemType === "string" ? p.itemType : "unknown";
            const itemType: CanonicalItemType = isToolLifecycleItemType(rawItemType)
              ? rawItemType
              : rawItemType === "user_message" ||
                  rawItemType === "assistant_message" ||
                  rawItemType === "reasoning" ||
                  rawItemType === "plan" ||
                  rawItemType === "review_entered" ||
                  rawItemType === "review_exited" ||
                  rawItemType === "context_compaction" ||
                  rawItemType === "error"
                ? rawItemType
                : "unknown";
            yield* emitEvent({
              ...makeEventBase(threadId, turnId, itemId),
              type: "item.completed",
              payload: {
                itemType,
                status: "completed",
                ...(typeof p.title === "string" ? { title: p.title } : {}),
                ...(typeof p.detail === "string" ? { detail: p.detail } : {}),
              },
            });
            break;
          }

          case "turn.completed": {
            const state: ProviderRuntimeTurnStatus =
              typeof p.state === "string" &&
              (p.state === "completed" ||
                p.state === "interrupted" ||
                p.state === "failed" ||
                p.state === "cancelled")
                ? p.state
                : "completed";
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "turn.completed",
              payload: {
                state,
                ...(typeof p.stopReason === "string" ? { stopReason: p.stopReason } : {}),
                ...(typeof p.errorMessage === "string" ? { errorMessage: p.errorMessage } : {}),
              },
            });
            context.turnState = undefined;
            context.session = {
              ...context.session,
              status: "ready",
              activeTurnId: undefined,
              updatedAt: nowIsoString(),
            };
            break;
          }

          case "turn.aborted": {
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "turn.aborted",
              payload: {
                reason: typeof p.reason === "string" ? p.reason : "Turn aborted",
              },
            });
            context.turnState = undefined;
            context.session = {
              ...context.session,
              status: "ready",
              activeTurnId: undefined,
              updatedAt: nowIsoString(),
            };
            break;
          }

          case "approval.requested": {
            const requestId = ApprovalRequestId.makeUnsafe(
              typeof p.requestId === "string" ? p.requestId : crypto.randomUUID(),
            );
            const requestType: CanonicalRequestType =
              typeof p.requestType === "string"
                ? (p.requestType as CanonicalRequestType)
                : "command_execution_approval";
            const detail = typeof p.detail === "string" ? p.detail : undefined;

            const decision = yield* Deferred.make<ProviderApprovalDecision>();
            const pendingEntry: PendingApproval = {
              requestType,
              decision,
              ...(detail !== undefined ? { detail } : {}),
            };
            context.pendingApprovals.set(requestId, pendingEntry);

            yield* emitEvent({
              ...makeEventBase(threadId, turnId, undefined, requestId),
              type: "request.opened",
              payload: {
                requestType,
                ...(detail ? { detail } : {}),
                ...(p.args && typeof p.args === "object"
                  ? { args: p.args as Record<string, unknown> }
                  : {}),
              },
            });
            break;
          }

          case "user-input.requested": {
            const requestId = ApprovalRequestId.makeUnsafe(
              typeof p.requestId === "string" ? p.requestId : crypto.randomUUID(),
            );
            const questions = Array.isArray(p.questions) ? p.questions : [];

            const answers = yield* Deferred.make<ProviderUserInputAnswers>();
            context.pendingUserInputs.set(requestId, {
              questions,
              answers,
            });

            yield* emitEvent({
              ...makeEventBase(threadId, turnId, undefined, requestId),
              type: "user-input.requested",
              payload: { questions },
            });
            break;
          }

          case "tool.progress": {
            const itemId = typeof p.itemId === "string" ? p.itemId : crypto.randomUUID();
            yield* emitEvent({
              ...makeEventBase(threadId, turnId, itemId),
              type: "tool.progress",
              payload: {
                ...(typeof p.toolUseId === "string" ? { toolUseId: p.toolUseId } : {}),
                ...(typeof p.toolName === "string" ? { toolName: p.toolName } : {}),
                ...(typeof p.summary === "string" ? { summary: p.summary } : {}),
                ...(typeof p.elapsedSeconds === "number"
                  ? { elapsedSeconds: p.elapsedSeconds }
                  : {}),
              },
            });
            break;
          }

          case "task.started": {
            const taskId =
              typeof p.taskId === "string"
                ? RuntimeTaskId.makeUnsafe(p.taskId)
                : RuntimeTaskId.makeUnsafe(crypto.randomUUID());
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "task.started",
              payload: {
                taskId,
                ...(typeof p.description === "string" ? { description: p.description } : {}),
                ...(typeof p.taskType === "string" ? { taskType: p.taskType } : {}),
              },
            });
            break;
          }

          case "task.progress": {
            const taskId =
              typeof p.taskId === "string"
                ? RuntimeTaskId.makeUnsafe(p.taskId)
                : RuntimeTaskId.makeUnsafe(crypto.randomUUID());
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "task.progress",
              payload: {
                taskId,
                description: typeof p.description === "string" ? p.description : "Task in progress",
                ...(typeof p.summary === "string" ? { summary: p.summary } : {}),
              },
            });
            break;
          }

          case "task.completed": {
            const taskId =
              typeof p.taskId === "string"
                ? RuntimeTaskId.makeUnsafe(p.taskId)
                : RuntimeTaskId.makeUnsafe(crypto.randomUUID());
            const taskStatus =
              typeof p.status === "string" &&
              (p.status === "completed" || p.status === "failed" || p.status === "stopped")
                ? p.status
                : "completed";
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "task.completed",
              payload: {
                taskId,
                status: taskStatus,
                ...(typeof p.summary === "string" ? { summary: p.summary } : {}),
              },
            });
            break;
          }

          case "runtime.error": {
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "runtime.error",
              payload: {
                message: typeof p.message === "string" ? p.message : "Unknown runtime error",
                ...(typeof p.code === "string"
                  ? {
                      class: p.code as
                        | "provider_error"
                        | "transport_error"
                        | "permission_error"
                        | "validation_error"
                        | "unknown",
                    }
                  : {}),
              },
            });
            break;
          }

          case "runtime.warning": {
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "runtime.warning",
              payload: {
                message: typeof p.message === "string" ? p.message : "Unknown runtime warning",
              },
            });
            break;
          }

          case "thread.token-usage.updated": {
            const usageObj = (p.usage && typeof p.usage === "object" ? p.usage : p) as Record<
              string,
              unknown
            >;
            const usedTokens = typeof usageObj.usedTokens === "number" ? usageObj.usedTokens : 0;
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "thread.token-usage.updated",
              payload: {
                usage: {
                  usedTokens,
                  ...(typeof usageObj.inputTokens === "number"
                    ? { inputTokens: usageObj.inputTokens }
                    : {}),
                  ...(typeof usageObj.outputTokens === "number"
                    ? { outputTokens: usageObj.outputTokens }
                    : {}),
                },
              },
            });
            break;
          }

          default: {
            // Unknown notification method — emit as runtime warning for observability.
            yield* emitEvent({
              ...makeEventBase(threadId, turnId),
              type: "runtime.warning",
              payload: {
                message: `Unknown OpenClaw gateway notification: ${method}`,
              },
              raw: {
                source: "openclaw.gateway.notification" as const,
                method,
                payload: params,
              },
            });
            break;
          }
        }
      });

    // ── WebSocket message dispatcher ────────────────────────────

    const setupWsMessageHandler = (context: OpenClawSessionContext): Effect.Effect<void> =>
      Effect.sync(() => {
        context.ws.on("message", (data: WebSocket.Data) => {
          try {
            const raw = typeof data === "string" ? data : data.toString("utf-8");
            const msg: JsonRpcMessage = JSON.parse(raw);

            if (isJsonRpcResponse(msg)) {
              // Match response to pending RPC call by id.
              const id = typeof msg.id === "number" ? msg.id : undefined;
              if (id !== undefined) {
                const pending = context.pendingRpcCalls.get(id);
                if (pending) {
                  context.pendingRpcCalls.delete(id);
                  Effect.runFork(Deferred.succeed(pending, msg));
                }
              }
            } else {
              // Notification — map to canonical events.
              Effect.runFork(mapNotificationToEvents(context, msg));
            }
          } catch {
            // Malformed message — ignore silently for resilience.
          }
        });

        context.ws.on("close", (_code: number, _reason: Buffer) => {
          if (!context.stopped) {
            context.stopped = true;
            Effect.runFork(
              emitEvent({
                ...makeEventBase(context.session.threadId),
                type: "session.exited",
                payload: {
                  exitKind: "error",
                  reason: "WebSocket connection closed unexpectedly.",
                },
              }),
            );
          }
        });

        context.ws.on("error", (error: Error) => {
          if (!context.stopped) {
            Effect.runFork(
              emitEvent({
                ...makeEventBase(context.session.threadId),
                type: "runtime.error",
                payload: {
                  message: `WebSocket error: ${toMessage(error, "Unknown error")}`,
                },
              }),
            );
          }
        });
      });

    // ── Session stop helper ─────────────────────────────────────

    const stopSessionInternal = (
      context: OpenClawSessionContext,
      opts: { emitExitEvent: boolean },
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (context.stopped) return;
        context.stopped = true;

        // Cancel pending approvals.
        for (const [, pending] of context.pendingApprovals) {
          yield* Deferred.succeed(pending.decision, "cancel");
        }
        context.pendingApprovals.clear();

        // Cancel pending user inputs.
        for (const [, pending] of context.pendingUserInputs) {
          yield* Deferred.succeed(pending.answers, {});
        }
        context.pendingUserInputs.clear();

        // Fail pending RPC calls.
        for (const [, pending] of context.pendingRpcCalls) {
          yield* Deferred.succeed(pending, {
            jsonrpc: JSON_RPC_VERSION,
            error: { code: -32000, message: "Session stopped." },
            id: null,
          });
        }
        context.pendingRpcCalls.clear();

        // Best-effort stop RPC (don't fail if WS is already closed).
        if (context.ws.readyState === WebSocket.OPEN) {
          yield* Effect.try({
            try: () =>
              context.ws.send(
                JSON.stringify({
                  jsonrpc: JSON_RPC_VERSION,
                  method: "session.stop",
                  params: { sessionId: context.gatewaySessionId },
                  id: context.nextRpcId++,
                }),
              ),
            catch: (e) => e as Error,
          }).pipe(Effect.orElseSucceed(() => undefined));
        }

        // Close WebSocket.
        yield* Effect.try({
          try: () => context.ws.close(),
          catch: (e) => e as Error,
        }).pipe(Effect.orElseSucceed(() => undefined));

        // Interrupt stream fiber if active.
        if (context.streamFiber) {
          yield* Fiber.interrupt(context.streamFiber);
          context.streamFiber = undefined;
        }

        // Emit exit event.
        if (opts.emitExitEvent) {
          yield* emitEvent({
            ...makeEventBase(context.session.threadId),
            type: "session.exited",
            payload: { exitKind: "graceful" },
          });
        }

        sessions.delete(context.session.threadId);
      });

    // ── Require active session helper ───────────────────────────

    const requireSession = (
      threadId: ThreadId,
    ): Effect.Effect<OpenClawSessionContext, ProviderAdapterError> => {
      const context = sessions.get(threadId);
      if (!context) {
        return Effect.fail(
          new ProviderAdapterSessionNotFoundError({
            provider: PROVIDER,
            threadId,
          }),
        );
      }
      if (context.stopped || context.session.status === "closed") {
        return Effect.fail(
          new ProviderAdapterSessionClosedError({
            provider: PROVIDER,
            threadId,
          }),
        );
      }
      return Effect.succeed(context);
    };

    // ── Adapter interface: startSession ─────────────────────────

    const startSession: OpenClawAdapterShape["startSession"] = (input) =>
      Effect.gen(function* () {
        if (input.provider !== undefined && input.provider !== PROVIDER) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "startSession",
            issue: `Expected provider '${PROVIDER}' but received '${input.provider}'.`,
          });
        }

        const threadId = input.threadId;
        const resumeState = readResumeCursor(input.resumeCursor);
        const openclawOptions = input.providerOptions?.openclaw;

        // Resolve gateway URL.
        const gatewayUrl =
          openclawOptions?.gatewayUrl ?? process.env.OPENCLAW_GATEWAY_URL ?? DEFAULT_GATEWAY_URL;

        const password = openclawOptions?.password ?? process.env.OPENCLAW_PASSWORD;

        // Connect WebSocket.
        const ws = yield* connectWebSocket(gatewayUrl);

        const now = nowIsoString();
        const context: OpenClawSessionContext = {
          session: {
            provider: PROVIDER,
            status: "connecting",
            runtimeMode: input.runtimeMode,
            cwd: input.cwd,
            model: input.model,
            threadId,
            resumeCursor: resumeState,
            createdAt: now,
            updatedAt: now,
          },
          ws,
          gatewaySessionId: resumeState?.gatewaySessionId ?? "",
          pendingRpcCalls: new Map(),
          pendingApprovals: new Map(),
          pendingUserInputs: new Map(),
          turnState: undefined,
          nextRpcId: 1,
          streamFiber: undefined,
          stopped: false,
        };

        sessions.set(threadId, context);

        // Set up message handler.
        yield* setupWsMessageHandler(context);

        // Authenticate if password is provided.
        if (password) {
          yield* sendRpc(context, "auth.authenticate", { password });
        }

        // Create or resume session.
        if (resumeState?.gatewaySessionId) {
          const response = yield* sendRpc(context, "session.resume", {
            sessionId: resumeState.gatewaySessionId,
          });
          const result = (response.result ?? {}) as Record<string, unknown>;
          context.gatewaySessionId =
            typeof result.sessionId === "string" ? result.sessionId : resumeState.gatewaySessionId;
        } else {
          const response = yield* sendRpc(context, "session.create", {
            ...(input.model ? { model: input.model } : {}),
            ...(input.cwd ? { cwd: input.cwd } : {}),
            runtimeMode: input.runtimeMode,
          });
          const result = (response.result ?? {}) as Record<string, unknown>;
          context.gatewaySessionId =
            typeof result.sessionId === "string" ? result.sessionId : crypto.randomUUID();
        }

        // Update session with resume cursor.
        const cursor = makeResumeCursor(context.gatewaySessionId);
        context.session = {
          ...context.session,
          status: "ready",
          resumeCursor: cursor,
          updatedAt: nowIsoString(),
        };

        // Emit session started events.
        yield* emitEvent({
          ...makeEventBase(threadId),
          type: "session.started",
          payload: { message: "OpenClaw gateway session started." },
        });

        yield* emitEvent({
          ...makeEventBase(threadId),
          type: "session.state.changed",
          payload: { state: "ready" },
        });

        return context.session;
      });

    // ── Adapter interface: sendTurn ──────────────────────────────

    const sendTurn: OpenClawAdapterShape["sendTurn"] = (input) =>
      Effect.gen(function* () {
        const context = yield* requireSession(input.threadId);
        const turnId = TurnId.makeUnsafe(yield* Random.nextUUIDv4);
        const now = nowIsoString();

        context.turnState = { turnId, startedAt: now };
        context.session = {
          ...context.session,
          status: "running",
          activeTurnId: turnId,
          updatedAt: now,
          ...(input.model ? { model: input.model } : {}),
        };

        // Send turn to gateway.
        yield* sendRpc(context, "session.sendTurn", {
          sessionId: context.gatewaySessionId,
          ...(input.input ? { input: input.input } : {}),
          ...(input.model ? { model: input.model } : {}),
          ...(input.interactionMode ? { interactionMode: input.interactionMode } : {}),
        });

        // Emit turn.started.
        yield* emitEvent({
          ...makeEventBase(input.threadId, turnId),
          type: "turn.started",
          payload: {},
        });

        return {
          threadId: input.threadId,
          turnId,
          resumeCursor: makeResumeCursor(context.gatewaySessionId),
        };
      });

    // ── Adapter interface: interruptTurn ─────────────────────────

    const interruptTurn: OpenClawAdapterShape["interruptTurn"] = (threadId, turnId) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        yield* sendRpc(context, "session.interrupt", {
          sessionId: context.gatewaySessionId,
          ...(turnId ? { turnId } : {}),
        });
      });

    // ── Adapter interface: respondToRequest ──────────────────────

    const respondToRequest: OpenClawAdapterShape["respondToRequest"] = (
      threadId,
      requestId,
      decision,
    ) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        const pending = context.pendingApprovals.get(requestId);
        if (pending) {
          yield* Deferred.succeed(pending.decision, decision);
          context.pendingApprovals.delete(requestId);
        }

        // Notify gateway of the decision.
        yield* sendRpc(context, "approval.respond", {
          sessionId: context.gatewaySessionId,
          requestId,
          decision,
        });

        yield* emitEvent({
          ...makeEventBase(threadId, context.turnState?.turnId, undefined, requestId),
          type: "request.resolved",
          payload: {
            requestType: pending?.requestType ?? "unknown",
            decision,
          },
        });
      });

    // ── Adapter interface: respondToUserInput ────────────────────

    const respondToUserInput: OpenClawAdapterShape["respondToUserInput"] = (
      threadId,
      requestId,
      answers,
    ) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        const pending = context.pendingUserInputs.get(requestId);
        if (pending) {
          yield* Deferred.succeed(pending.answers, answers);
          context.pendingUserInputs.delete(requestId);
        }

        // Notify gateway of the user input.
        yield* sendRpc(context, "user-input.respond", {
          sessionId: context.gatewaySessionId,
          requestId,
          answers,
        });

        yield* emitEvent({
          ...makeEventBase(threadId, context.turnState?.turnId, undefined, requestId),
          type: "user-input.resolved",
          payload: { answers },
        });
      });

    // ── Adapter interface: stopSession ───────────────────────────

    const stopSession: OpenClawAdapterShape["stopSession"] = (threadId) =>
      Effect.gen(function* () {
        const context = sessions.get(threadId);
        if (!context) return;
        yield* stopSessionInternal(context, { emitExitEvent: true });
      });

    // ── Adapter interface: listSessions ─────────────────────────

    const listSessions: OpenClawAdapterShape["listSessions"] = () =>
      Effect.sync(() => Array.from(sessions.values()).map((ctx) => ctx.session));

    // ── Adapter interface: hasSession ───────────────────────────

    const hasSession: OpenClawAdapterShape["hasSession"] = (threadId) =>
      Effect.sync(() => sessions.has(threadId));

    // ── Adapter interface: readThread (MVP: unsupported) ────────

    const readThread: OpenClawAdapterShape["readThread"] = (_threadId) =>
      Effect.fail(
        new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "readThread",
          detail: "Thread snapshot reading is not supported for OpenClaw in this version.",
        }),
      );

    // ── Adapter interface: rollbackThread (MVP: unsupported) ────

    const rollbackThread: OpenClawAdapterShape["rollbackThread"] = (_threadId, _numTurns) =>
      Effect.fail(
        new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "rollbackThread",
          detail: "Thread rollback is not supported for OpenClaw in this version.",
        }),
      );

    // ── Adapter interface: stopAll ──────────────────────────────

    const stopAll: OpenClawAdapterShape["stopAll"] = () =>
      Effect.gen(function* () {
        const allContexts = Array.from(sessions.values());
        yield* Effect.forEach(
          allContexts,
          (context) => stopSessionInternal(context, { emitExitEvent: true }),
          { discard: true },
        );
      });

    // ── Finalizer ───────────────────────────────────────────────

    yield* Effect.addFinalizer(() =>
      Effect.forEach(
        Array.from(sessions.values()),
        (context) => stopSessionInternal(context, { emitExitEvent: false }),
        { discard: true },
      ).pipe(Effect.tap(() => Queue.shutdown(runtimeEventQueue))),
    );

    // ── Return adapter shape ────────────────────────────────────

    return {
      provider: PROVIDER,
      capabilities: { sessionModelSwitch: "restart-session" },
      startSession,
      sendTurn,
      interruptTurn,
      respondToRequest,
      respondToUserInput,
      stopSession,
      listSessions,
      hasSession,
      readThread,
      rollbackThread,
      stopAll,
      streamEvents: Stream.fromQueue(runtimeEventQueue),
    } satisfies OpenClawAdapterShape;
  });
}

// ── Layer exports ───────────────────────────────────────────────

export const OpenClawAdapterLive = Layer.effect(OpenClawAdapter, makeOpenClawAdapter());

export function makeOpenClawAdapterLive(options?: OpenClawAdapterLiveOptions) {
  return Layer.effect(OpenClawAdapter, makeOpenClawAdapter(options));
}
