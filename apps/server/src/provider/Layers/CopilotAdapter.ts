import {
  ApprovalRequestId,
  type CanonicalItemType,
  type CanonicalRequestType,
  EventId,
  type ProviderApprovalDecision,
  type ProviderRuntimeEvent,
  type ProviderSendTurnInput,
  type ProviderSession,
  type ProviderUserInputAnswers,
  type RuntimeContentStreamKind,
  RuntimeItemId,
  RuntimeRequestId,
  ThreadId,
  type ThreadTokenUsageSnapshot,
  TurnId,
  type UserInputQuestion,
} from "@okcode/contracts";
import { CopilotClient, type CopilotSession, type SessionEvent } from "@github/copilot-sdk";
import {
  compactNodeProcessEnv,
  mergeNodeProcessEnv,
  sanitizeShellEnvironment,
} from "@okcode/shared/environment";
import { Effect, Layer, Queue, Stream } from "effect";
import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionClosedError,
  ProviderAdapterSessionNotFoundError,
  type ProviderAdapterError,
} from "../Errors.ts";
import { CopilotAdapter, type CopilotAdapterShape } from "../Services/CopilotAdapter.ts";
import type { EventNdjsonLogger } from "./EventNdjsonLogger.ts";

const PROVIDER = "copilot" as const;

type CopilotPermissionRequest =
  | {
      readonly kind: "shell";
      readonly fullCommandText?: string;
    }
  | {
      readonly kind: "write";
      readonly fileName?: string;
    }
  | {
      readonly kind: "read";
      readonly path?: string;
    }
  | {
      readonly kind: "mcp";
      readonly toolTitle?: string;
    }
  | {
      readonly kind: "url";
      readonly url?: string;
    }
  | {
      readonly kind: "custom-tool";
      readonly toolName?: string;
    }
  | {
      readonly kind: string;
      readonly fullCommandText?: string;
      readonly fileName?: string;
      readonly path?: string;
      readonly toolTitle?: string;
      readonly url?: string;
      readonly toolName?: string;
    };

type CopilotPermissionRequestResult =
  | { readonly kind: "approved" }
  | { readonly kind: "denied-interactively-by-user" };

interface CopilotUserInputRequest {
  readonly question: string;
  readonly choices?: ReadonlyArray<string>;
  readonly allowFreeform?: boolean;
}

interface CopilotUserInputResponse {
  readonly answer: string;
  readonly wasFreeform: boolean;
}

interface CopilotResumeCursor {
  readonly version: 1;
  readonly sessionId: string;
}

interface PendingApproval {
  readonly requestType: CanonicalRequestType;
  readonly detail?: string;
  readonly promise: Promise<ProviderApprovalDecision>;
  readonly resolve: (decision: ProviderApprovalDecision) => void;
}

interface PendingUserInput {
  readonly question: UserInputQuestion;
  readonly promise: Promise<ProviderUserInputAnswers>;
  readonly resolve: (answers: ProviderUserInputAnswers) => void;
}

interface CopilotTurnState {
  readonly turnId: TurnId;
  readonly startedAt: string;
  readonly items: Array<unknown>;
  readonly assistantItemIds: Set<string>;
  readonly toolItemIds: Set<string>;
}

interface CopilotSessionContext {
  session: ProviderSession;
  readonly client: CopilotClient;
  readonly copilotSession: CopilotSession;
  readonly pendingApprovals: Map<ApprovalRequestId, PendingApproval>;
  readonly pendingUserInputs: Map<ApprovalRequestId, PendingUserInput>;
  readonly turns: Array<{ id: TurnId; items: Array<unknown> }>;
  turnState: CopilotTurnState | undefined;
  lastUsage: ThreadTokenUsageSnapshot | undefined;
  stopped: boolean;
}

export interface CopilotAdapterLiveOptions {
  readonly nativeEventLogger?: EventNdjsonLogger;
}

function nowIsoString(): string {
  return new Date().toISOString();
}

function toMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return fallback;
}

function makeResumeCursor(sessionId: string): CopilotResumeCursor {
  return { version: 1, sessionId };
}

function readResumeCursor(cursor: unknown): CopilotResumeCursor | undefined {
  if (
    typeof cursor === "object" &&
    cursor !== null &&
    "version" in cursor &&
    "sessionId" in cursor &&
    (cursor as Record<string, unknown>).version === 1 &&
    typeof (cursor as Record<string, unknown>).sessionId === "string"
  ) {
    return cursor as CopilotResumeCursor;
  }
  return undefined;
}

function toRequestError(threadId: ThreadId, method: string, cause: unknown): ProviderAdapterError {
  const message = toMessage(cause, `${method} failed`);
  if (message.toLowerCase().includes("not found")) {
    return new ProviderAdapterSessionNotFoundError({
      provider: PROVIDER,
      threadId,
      cause,
    });
  }
  return new ProviderAdapterRequestError({
    provider: PROVIDER,
    method,
    detail: message,
    cause,
  });
}

function toProcessError(threadId: ThreadId, detail: string, cause?: unknown): ProviderAdapterError {
  return new ProviderAdapterProcessError({
    provider: PROVIDER,
    threadId,
    detail,
    ...(cause !== undefined ? { cause } : {}),
  });
}

function mapInteractionModeToCopilotMode(
  interactionMode: ProviderSendTurnInput["interactionMode"],
): "interactive" | "plan" | "autopilot" {
  switch (interactionMode) {
    case "plan":
      return "plan";
    case "code":
      return "autopilot";
    case "chat":
    default:
      return "interactive";
  }
}

function mapApprovalDecisionToPermissionResult(
  decision: ProviderApprovalDecision,
): CopilotPermissionRequestResult {
  switch (decision) {
    case "accept":
    case "acceptForSession":
      return { kind: "approved" };
    case "decline":
    case "cancel":
    default:
      return { kind: "denied-interactively-by-user" };
  }
}

function inferRequestType(request: CopilotPermissionRequest): CanonicalRequestType {
  switch (request.kind) {
    case "shell":
      return "exec_command_approval";
    case "write":
      return "apply_patch_approval";
    case "read":
      return "file_read_approval";
    case "mcp":
    case "custom-tool":
      return "dynamic_tool_call";
    case "url":
      return "unknown";
    default:
      return "unknown";
  }
}

function permissionDetail(request: CopilotPermissionRequest): string | undefined {
  if (request.kind === "shell" && typeof request.fullCommandText === "string") {
    return request.fullCommandText;
  }
  if (request.kind === "write" && typeof request.fileName === "string") {
    return request.fileName;
  }
  if (request.kind === "read" && typeof request.path === "string") {
    return request.path;
  }
  if (request.kind === "mcp" && typeof request.toolTitle === "string") {
    return request.toolTitle;
  }
  if (request.kind === "url" && typeof request.url === "string") {
    return request.url;
  }
  if (request.kind === "custom-tool" && typeof request.toolName === "string") {
    return request.toolName;
  }
  return undefined;
}

function inferToolItemType(toolName: string): CanonicalItemType {
  const normalized = toolName.trim().toLowerCase();
  if (normalized === "shell" || normalized.includes("bash")) return "command_execution";
  if (normalized.includes("write") || normalized.includes("edit") || normalized.includes("patch"))
    return "file_change";
  if (normalized.includes("read")) return "dynamic_tool_call";
  if (normalized.includes("mcp")) return "mcp_tool_call";
  if (normalized.includes("web") || normalized.includes("fetch") || normalized.includes("search"))
    return "web_search";
  if (normalized.includes("image")) return "image_view";
  return "dynamic_tool_call";
}

function inferToolStreamKind(itemType: CanonicalItemType): RuntimeContentStreamKind {
  switch (itemType) {
    case "command_execution":
      return "command_output";
    case "file_change":
      return "file_change_output";
    default:
      return "unknown";
  }
}

function normalizeUsageFromAssistantEvent(
  event: Extract<SessionEvent, { type: "assistant.usage" }>,
) {
  const usedTokens = (event.data.inputTokens ?? 0) + (event.data.outputTokens ?? 0);
  if (usedTokens <= 0) {
    return undefined;
  }
  return {
    usedTokens,
    ...(event.data.inputTokens !== undefined ? { inputTokens: event.data.inputTokens } : {}),
    ...(event.data.outputTokens !== undefined ? { outputTokens: event.data.outputTokens } : {}),
    ...(event.data.cacheReadTokens !== undefined
      ? { cachedInputTokens: event.data.cacheReadTokens }
      : {}),
    ...(event.data.reasoningEffort ? { compactsAutomatically: true } : {}),
    ...(event.data.duration !== undefined ? { durationMs: event.data.duration } : {}),
    lastUsedTokens: usedTokens,
    ...(event.data.inputTokens !== undefined ? { lastInputTokens: event.data.inputTokens } : {}),
    ...(event.data.outputTokens !== undefined ? { lastOutputTokens: event.data.outputTokens } : {}),
  } satisfies ThreadTokenUsageSnapshot;
}

function buildUserInputQuestion(
  requestId: string,
  request: CopilotUserInputRequest,
): UserInputQuestion {
  return {
    id: requestId,
    header: "Copilot",
    question: request.question.trim() || "GitHub Copilot needs input.",
    options: (request.choices ?? []).map((choice: string) => ({
      label: choice,
      description: choice,
    })),
  };
}

function readCopilotProviderOptions(input: { readonly providerOptions?: unknown }) {
  if (!input.providerOptions || typeof input.providerOptions !== "object") {
    return {};
  }
  const providerOptions = input.providerOptions as Record<string, unknown>;
  const copilot = providerOptions.copilot;
  if (!copilot || typeof copilot !== "object") {
    return {};
  }
  const record = copilot as Record<string, unknown>;
  return {
    ...(typeof record.binaryPath === "string" ? { binaryPath: record.binaryPath } : {}),
    ...(typeof record.configDir === "string" ? { configDir: record.configDir } : {}),
  };
}

function getCopilotReasoningEffort(input: ProviderSendTurnInput): string | undefined {
  return input.modelOptions?.copilot?.reasoningEffort;
}

export function makeCopilotAdapterLive(options?: CopilotAdapterLiveOptions) {
  return Layer.effect(CopilotAdapter, makeCopilotAdapter(options));
}

const makeCopilotAdapter = (options?: CopilotAdapterLiveOptions) =>
  Effect.gen(function* () {
    const runtimeEventQueue = yield* Queue.unbounded<ProviderRuntimeEvent>();
    const sessions = new Map<ThreadId, CopilotSessionContext>();

    yield* Effect.addFinalizer(() =>
      Effect.forEach(
        Array.from(sessions.keys()),
        (threadId) => stopSession(threadId).pipe(Effect.ignore),
        { discard: true },
      ).pipe(Effect.ensuring(Queue.shutdown(runtimeEventQueue))),
    );
    const emitEvent = (event: ProviderRuntimeEvent) =>
      Queue.offer(runtimeEventQueue, event).pipe(
        Effect.tap(() =>
          options?.nativeEventLogger ? options.nativeEventLogger.write(event, null) : Effect.void,
        ),
        Effect.asVoid,
      );

    const makeBase = (
      threadId: ThreadId,
      extra?: {
        readonly turnId?: TurnId;
        readonly itemId?: string;
        readonly requestId?: string;
      },
      raw?: SessionEvent,
    ) => ({
      eventId: EventId.makeUnsafe(crypto.randomUUID()),
      provider: PROVIDER,
      threadId,
      createdAt: nowIsoString(),
      ...(extra?.turnId ? { turnId: extra.turnId } : {}),
      ...(extra?.itemId ? { itemId: RuntimeItemId.makeUnsafe(extra.itemId) } : {}),
      ...(extra?.requestId ? { requestId: RuntimeRequestId.makeUnsafe(extra.requestId) } : {}),
      providerRefs: {},
      ...(raw
        ? {
            raw: {
              source: "copilot.sdk.event" as const,
              messageType: raw.type,
              payload: raw,
            },
          }
        : {}),
    });

    const getContext = (threadId: ThreadId) => {
      const context = sessions.get(threadId);
      if (!context) {
        return Effect.fail(
          new ProviderAdapterSessionNotFoundError({
            provider: PROVIDER,
            threadId,
          }),
        );
      }
      if (context.stopped) {
        return Effect.fail(
          new ProviderAdapterSessionClosedError({
            provider: PROVIDER,
            threadId,
          }),
        );
      }
      return Effect.succeed(context);
    };

    const ensureAssistantItem = (
      context: CopilotSessionContext,
      messageId: string,
      raw: SessionEvent,
    ) =>
      Effect.gen(function* () {
        const turnState = context.turnState;
        if (!turnState) return;
        const itemId = `assistant:${messageId}`;
        if (turnState.assistantItemIds.has(itemId)) return;
        turnState.assistantItemIds.add(itemId);
        turnState.items.push({ itemId, itemType: "assistant_message" });
        yield* emitEvent({
          ...makeBase(context.session.threadId, { turnId: turnState.turnId, itemId }, raw),
          type: "item.started",
          payload: {
            itemType: "assistant_message",
            title: "Assistant message",
          },
        });
      });

    const ensureToolItem = (
      context: CopilotSessionContext,
      toolCallId: string,
      toolName: string,
      raw: SessionEvent,
    ) =>
      Effect.gen(function* () {
        const turnState = context.turnState;
        if (!turnState)
          return { itemId: `tool:${toolCallId}`, itemType: inferToolItemType(toolName) };
        const itemId = `tool:${toolCallId}`;
        const itemType = inferToolItemType(toolName);
        if (!turnState.toolItemIds.has(itemId)) {
          turnState.toolItemIds.add(itemId);
          turnState.items.push({ itemId, itemType, toolName });
          yield* emitEvent({
            ...makeBase(context.session.threadId, { turnId: turnState.turnId, itemId }, raw),
            type: "item.started",
            payload: {
              itemType,
              title: toolName,
              data: {
                toolName,
              },
            },
          });
        }
        return { itemId, itemType };
      });

    const completeTurn = (
      context: CopilotSessionContext,
      state: "completed" | "failed" | "cancelled" | "interrupted",
      raw?: SessionEvent,
      errorMessage?: string,
    ) =>
      Effect.gen(function* () {
        const turnState = context.turnState;
        if (!turnState) return;
        context.turns.push({ id: turnState.turnId, items: [...turnState.items] });
        context.turnState = undefined;
        context.session = {
          ...context.session,
          status: state === "failed" ? "error" : "ready",
          activeTurnId: undefined,
          updatedAt: nowIsoString(),
          ...(errorMessage ? { lastError: errorMessage } : {}),
        };
        yield* emitEvent({
          ...makeBase(context.session.threadId, { turnId: turnState.turnId }, raw),
          type: "turn.completed",
          payload: {
            state,
            ...(context.lastUsage ? { usage: context.lastUsage } : {}),
            ...(errorMessage ? { errorMessage } : {}),
          },
        });
        yield* emitEvent({
          ...makeBase(context.session.threadId, { turnId: turnState.turnId }, raw),
          type: "session.state.changed",
          payload: {
            state: state === "failed" ? "error" : "ready",
            ...(errorMessage ? { reason: errorMessage } : {}),
          },
        });
      });

    const handleSessionEvent = (context: CopilotSessionContext, event: SessionEvent) =>
      Effect.gen(function* () {
        switch (event.type) {
          case "assistant.message_delta": {
            const turnState = context.turnState;
            if (!turnState) return;
            yield* ensureAssistantItem(context, event.data.messageId, event);
            yield* emitEvent({
              ...makeBase(
                context.session.threadId,
                { turnId: turnState.turnId, itemId: `assistant:${event.data.messageId}` },
                event,
              ),
              type: "content.delta",
              payload: {
                streamKind: "assistant_text",
                delta: event.data.deltaContent,
              },
            });
            return;
          }
          case "assistant.message": {
            const turnState = context.turnState;
            if (!turnState) return;
            const itemId = `assistant:${event.data.messageId}`;
            yield* ensureAssistantItem(context, event.data.messageId, event);
            if (event.data.reasoningText?.trim()) {
              const reasoningItemId = `${itemId}:reasoning`;
              yield* emitEvent({
                ...makeBase(
                  context.session.threadId,
                  { turnId: turnState.turnId, itemId: reasoningItemId },
                  event,
                ),
                type: "item.started",
                payload: {
                  itemType: "reasoning",
                  title: "Reasoning",
                },
              });
              yield* emitEvent({
                ...makeBase(
                  context.session.threadId,
                  { turnId: turnState.turnId, itemId: reasoningItemId },
                  event,
                ),
                type: "content.delta",
                payload: {
                  streamKind: "reasoning_text",
                  delta: event.data.reasoningText,
                },
              });
              yield* emitEvent({
                ...makeBase(
                  context.session.threadId,
                  { turnId: turnState.turnId, itemId: reasoningItemId },
                  event,
                ),
                type: "item.completed",
                payload: {
                  itemType: "reasoning",
                  status: "completed",
                  title: "Reasoning",
                  data: {
                    text: event.data.reasoningText,
                  },
                },
              });
            }
            yield* emitEvent({
              ...makeBase(context.session.threadId, { turnId: turnState.turnId, itemId }, event),
              type: "item.completed",
              payload: {
                itemType: "assistant_message",
                status: "completed",
                title: "Assistant message",
                data: {
                  text: event.data.content,
                  ...(event.data.toolRequests ? { toolRequests: event.data.toolRequests } : {}),
                },
              },
            });
            return;
          }
          case "assistant.usage": {
            context.lastUsage = normalizeUsageFromAssistantEvent(event);
            if (!context.lastUsage) return;
            yield* emitEvent({
              ...makeBase(
                context.session.threadId,
                context.turnState ? { turnId: context.turnState.turnId } : undefined,
                event,
              ),
              type: "thread.token-usage.updated",
              payload: {
                usage: context.lastUsage,
              },
            });
            return;
          }
          case "tool.execution_start": {
            const { itemId, itemType } = yield* ensureToolItem(
              context,
              event.data.toolCallId,
              event.data.toolName,
              event,
            );
            yield* emitEvent({
              ...makeBase(
                context.session.threadId,
                context.turnState ? { turnId: context.turnState.turnId, itemId } : { itemId },
                event,
              ),
              type: "item.updated",
              payload: {
                itemType,
                status: "inProgress",
                title: event.data.toolName,
                data: {
                  ...(event.data.arguments ? { arguments: event.data.arguments } : {}),
                  ...(event.data.mcpServerName ? { mcpServerName: event.data.mcpServerName } : {}),
                },
              },
            });
            return;
          }
          case "tool.execution_partial_result": {
            const turnState = context.turnState;
            if (!turnState) return;
            const toolItem = turnState.items.find(
              (item) =>
                typeof item === "object" &&
                item !== null &&
                "itemId" in item &&
                (item as { itemId?: string }).itemId === `tool:${event.data.toolCallId}`,
            ) as { itemId?: string; itemType?: CanonicalItemType } | undefined;
            const itemId = toolItem?.itemId ?? `tool:${event.data.toolCallId}`;
            const itemType = toolItem?.itemType ?? "dynamic_tool_call";
            yield* emitEvent({
              ...makeBase(context.session.threadId, { turnId: turnState.turnId, itemId }, event),
              type: "content.delta",
              payload: {
                streamKind: inferToolStreamKind(itemType),
                delta: event.data.partialOutput,
              },
            });
            return;
          }
          case "tool.execution_complete": {
            const turnState = context.turnState;
            const toolItem = turnState?.items.find(
              (item) =>
                typeof item === "object" &&
                item !== null &&
                "itemId" in item &&
                (item as { itemId?: string }).itemId === `tool:${event.data.toolCallId}`,
            ) as { itemId?: string; itemType?: CanonicalItemType; toolName?: string } | undefined;
            const itemId = toolItem?.itemId ?? `tool:${event.data.toolCallId}`;
            const itemType = toolItem?.itemType ?? "dynamic_tool_call";
            yield* emitEvent({
              ...makeBase(
                context.session.threadId,
                turnState ? { turnId: turnState.turnId, itemId } : { itemId },
                event,
              ),
              type: "item.completed",
              payload: {
                itemType,
                status: event.data.success ? "completed" : "failed",
                title: toolItem?.toolName ?? "Tool execution",
                data: {
                  success: event.data.success,
                  ...(event.data.result !== undefined ? { result: event.data.result } : {}),
                  ...(event.data.error ? { error: event.data.error } : {}),
                },
              },
            });
            return;
          }
          case "session.idle":
            yield* completeTurn(context, "completed", event);
            return;
          case "abort":
            yield* completeTurn(context, "interrupted", event, event.data.reason);
            return;
          case "session.warning":
            yield* emitEvent({
              ...makeBase(
                context.session.threadId,
                context.turnState ? { turnId: context.turnState.turnId } : undefined,
                event,
              ),
              type: "runtime.warning",
              payload: {
                message: event.data.message,
                detail: event.data,
              },
            });
            return;
          case "session.error":
            yield* emitEvent({
              ...makeBase(
                context.session.threadId,
                context.turnState ? { turnId: context.turnState.turnId } : undefined,
                event,
              ),
              type: "runtime.error",
              payload: {
                message: event.data.message,
                class: "provider_error",
                detail: event.data,
              },
            });
            yield* completeTurn(context, "failed", event, event.data.message);
            return;
          default:
            return;
        }
      });

    const startSession: CopilotAdapterShape["startSession"] = (input) =>
      Effect.gen(function* () {
        const now = nowIsoString();
        const threadId = input.threadId;
        const resolvedCwd = input.cwd ?? process.cwd();
        const providerOptions = readCopilotProviderOptions(input);
        const sessionEnv = sanitizeShellEnvironment(
          mergeNodeProcessEnv(
            process.env,
            input.env ? compactNodeProcessEnv(input.env) : undefined,
          ),
        );

        const client = new CopilotClient({
          ...(providerOptions.binaryPath ? { cliPath: providerOptions.binaryPath } : {}),
          cwd: resolvedCwd,
          env: sessionEnv,
          logLevel: "error",
        });

        yield* Effect.tryPromise({
          try: () => client.start(),
          catch: (cause) =>
            toProcessError(threadId, "Failed to start GitHub Copilot CLI client.", cause),
        });

        const pendingApprovals = new Map<ApprovalRequestId, PendingApproval>();
        let context: CopilotSessionContext | undefined;
        const onPermissionRequest = (request: CopilotPermissionRequest) => {
          if (input.runtimeMode === "full-access") {
            return { kind: "approved" } satisfies CopilotPermissionRequestResult;
          }
          const requestId = ApprovalRequestId.makeUnsafe(
            `copilot-permission:${crypto.randomUUID()}`,
          );
          let resolve!: (decision: ProviderApprovalDecision) => void;
          const promise = new Promise<ProviderApprovalDecision>((resolvePromise) => {
            resolve = resolvePromise;
          });
          const detail = permissionDetail(request);
          pendingApprovals.set(requestId, {
            requestType: inferRequestType(request),
            ...(detail ? { detail } : {}),
            promise,
            resolve,
          });
          void Effect.runPromise(
            emitEvent({
              ...makeBase(
                threadId,
                context?.turnState
                  ? { turnId: context.turnState.turnId, requestId }
                  : { requestId },
              ),
              type: "request.opened",
              payload: {
                requestType: inferRequestType(request),
                ...(detail ? { detail } : {}),
                args: request,
              },
            }),
          );
          return promise.then((decision) => {
            const result = mapApprovalDecisionToPermissionResult(decision);
            void Effect.runPromise(
              emitEvent({
                ...makeBase(
                  threadId,
                  context?.turnState
                    ? { turnId: context.turnState.turnId, requestId }
                    : { requestId },
                ),
                type: "request.resolved",
                payload: {
                  requestType: inferRequestType(request),
                  decision: result.kind,
                  resolution: result,
                },
              }).pipe(Effect.ensuring(Effect.sync(() => pendingApprovals.delete(requestId)))),
            );
            return result;
          });
        };

        const reasonEffort = input.modelOptions?.copilot?.reasoningEffort;
        const sessionConfig = {
          ...(input.model ? { model: input.model } : {}),
          ...(reasonEffort ? { reasoningEffort: reasonEffort } : {}),
          workingDirectory: resolvedCwd,
          streaming: true,
          onPermissionRequest,
          ...(providerOptions.configDir ? { configDir: providerOptions.configDir } : {}),
        };

        const resumeCursor = readResumeCursor(input.resumeCursor);
        const copilotSession = yield* Effect.tryPromise({
          try: () =>
            resumeCursor
              ? client.resumeSession(resumeCursor.sessionId, {
                  ...sessionConfig,
                })
              : client.createSession({
                  ...sessionConfig,
                }),
          catch: (cause) =>
            toProcessError(threadId, "Failed to create GitHub Copilot session.", cause),
        }).pipe(
          Effect.tapError(() =>
            Effect.promise(() =>
              client
                .stop()
                .then(() => undefined)
                .catch(() => undefined),
            ),
          ),
        );

        const session: ProviderSession = {
          provider: PROVIDER,
          status: "ready",
          runtimeMode: input.runtimeMode,
          cwd: resolvedCwd,
          model: input.model,
          threadId,
          createdAt: now,
          updatedAt: now,
          resumeCursor: makeResumeCursor(copilotSession.sessionId),
        };

        context = {
          session,
          client,
          copilotSession,
          pendingApprovals,
          pendingUserInputs: new Map(),
          turns: [],
          turnState: undefined,
          lastUsage: undefined,
          stopped: false,
        };

        copilotSession.on((event) => {
          void Effect.runPromise(handleSessionEvent(context, event));
        });

        copilotSession.registerUserInputHandler((request) => {
          const requestId = ApprovalRequestId.makeUnsafe(
            `copilot-user-input:${crypto.randomUUID()}`,
          );
          let resolve!: (answers: ProviderUserInputAnswers) => void;
          const promise = new Promise<ProviderUserInputAnswers>((resolvePromise) => {
            resolve = resolvePromise;
          });
          const question = buildUserInputQuestion(requestId, request);
          context.pendingUserInputs.set(requestId, {
            question,
            promise,
            resolve,
          });
          void Effect.runPromise(
            emitEvent({
              ...makeBase(
                threadId,
                context.turnState ? { turnId: context.turnState.turnId, requestId } : { requestId },
              ),
              type: "user-input.requested",
              payload: {
                questions: [question],
              },
            }),
          );
          return promise.then((answers) => {
            const answerValue = answers[requestId] ?? answers[question.id];
            const answer = typeof answerValue === "string" ? answerValue : "";
            void Effect.runPromise(
              emitEvent({
                ...makeBase(
                  threadId,
                  context.turnState
                    ? { turnId: context.turnState.turnId, requestId }
                    : { requestId },
                ),
                type: "user-input.resolved",
                payload: {
                  answers: {
                    [question.id]: answer,
                  },
                },
              }).pipe(
                Effect.ensuring(Effect.sync(() => context.pendingUserInputs.delete(requestId))),
              ),
            );
            return {
              answer,
              wasFreeform: !(request.choices ?? []).includes(answer),
            } satisfies CopilotUserInputResponse;
          });
        });

        sessions.set(threadId, context);

        yield* emitEvent({
          ...makeBase(threadId),
          type: "session.started",
          payload: {
            message: "GitHub Copilot session started.",
            resume: makeResumeCursor(copilotSession.sessionId),
          },
        });
        yield* emitEvent({
          ...makeBase(threadId),
          type: "thread.started",
          payload: {
            providerThreadId: copilotSession.sessionId,
          },
        });
        yield* emitEvent({
          ...makeBase(threadId),
          type: "session.state.changed",
          payload: {
            state: "ready",
          },
        });

        return context.session;
      });

    const sendTurn: CopilotAdapterShape["sendTurn"] = (input) =>
      Effect.gen(function* () {
        const context = yield* getContext(input.threadId);
        if (context.turnState) {
          return yield* Effect.fail(
            new ProviderAdapterRequestError({
              provider: PROVIDER,
              method: "session.send",
              detail: "GitHub Copilot already has an active turn for this thread.",
            }),
          );
        }

        const turnId = TurnId.makeUnsafe(crypto.randomUUID());
        context.turnState = {
          turnId,
          startedAt: nowIsoString(),
          items: [],
          assistantItemIds: new Set(),
          toolItemIds: new Set(),
        };
        context.lastUsage = undefined;
        context.session = {
          ...context.session,
          status: "running",
          activeTurnId: turnId,
          updatedAt: nowIsoString(),
          ...(input.model ? { model: input.model } : {}),
        };

        const reasoningEffort = getCopilotReasoningEffort(input);
        const nextModel = input.model;
        if (nextModel) {
          yield* Effect.tryPromise({
            try: () =>
              context.copilotSession.rpc.model.switchTo({
                modelId: nextModel,
                ...(reasoningEffort ? { reasoningEffort } : {}),
              }),
            catch: (cause) => toRequestError(input.threadId, "session.model.switchTo", cause),
          });
        }

        yield* Effect.tryPromise({
          try: () =>
            context.copilotSession.rpc.mode.set({
              mode: mapInteractionModeToCopilotMode(input.interactionMode),
            }),
          catch: (cause) => toRequestError(input.threadId, "session.mode.set", cause),
        });

        yield* emitEvent({
          ...makeBase(input.threadId, { turnId }),
          type: "session.state.changed",
          payload: {
            state: "running",
          },
        });
        yield* emitEvent({
          ...makeBase(input.threadId, { turnId }),
          type: "turn.started",
          payload: {
            ...(context.session.model ? { model: context.session.model } : {}),
            ...(reasoningEffort ? { effort: reasoningEffort } : {}),
          },
        });

        yield* Effect.tryPromise({
          try: () =>
            context.copilotSession.send({
              prompt: input.input ?? "",
            }),
          catch: (cause) => toRequestError(input.threadId, "session.send", cause),
        });

        return {
          threadId: input.threadId,
          turnId,
          resumeCursor: makeResumeCursor(context.copilotSession.sessionId),
        };
      });

    const interruptTurn: CopilotAdapterShape["interruptTurn"] = (threadId) =>
      Effect.gen(function* () {
        const context = yield* getContext(threadId);
        yield* Effect.tryPromise({
          try: () => context.copilotSession.abort(),
          catch: (cause) => toRequestError(threadId, "session.abort", cause),
        });
      });

    const respondToRequest: CopilotAdapterShape["respondToRequest"] = (
      threadId,
      requestId,
      decision,
    ) =>
      Effect.gen(function* () {
        const context = yield* getContext(threadId);
        const pending = context.pendingApprovals.get(requestId);
        if (!pending) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "session.permissions.handlePendingPermissionRequest",
            detail: `Unknown pending approval request '${requestId}'.`,
          });
        }
        yield* Effect.sync(() => pending.resolve(decision));
      });

    const respondToUserInput: CopilotAdapterShape["respondToUserInput"] = (
      threadId,
      requestId,
      answers,
    ) =>
      Effect.gen(function* () {
        const context = yield* getContext(threadId);
        const pending = context.pendingUserInputs.get(requestId);
        if (!pending) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "session.userInput.respond",
            detail: `Unknown pending user input request '${requestId}'.`,
          });
        }
        yield* Effect.sync(() => pending.resolve(answers));
      });

    const stopContext = (context: CopilotSessionContext) =>
      Effect.gen(function* () {
        if (context.stopped) return;
        context.stopped = true;
        for (const pending of context.pendingApprovals.values()) {
          pending.resolve("cancel");
        }
        for (const pending of context.pendingUserInputs.values()) {
          pending.resolve({});
        }
        yield* Effect.promise(() => context.copilotSession.disconnect().catch(() => undefined));
        yield* Effect.promise(() =>
          context.client
            .stop()
            .then(() => undefined)
            .catch(() => undefined),
        );
        yield* emitEvent({
          ...makeBase(context.session.threadId),
          type: "session.exited",
          payload: {
            reason: "Session stopped.",
            exitKind: "graceful",
          },
        });
      });

    const stopSession: CopilotAdapterShape["stopSession"] = (threadId) =>
      Effect.gen(function* () {
        const context = yield* getContext(threadId);
        yield* stopContext(context);
        sessions.delete(threadId);
      });

    const listSessions: CopilotAdapterShape["listSessions"] = () =>
      Effect.sync(() =>
        [...sessions.values()]
          .filter((context) => !context.stopped)
          .map((context) => context.session),
      );

    const hasSession: CopilotAdapterShape["hasSession"] = (threadId) =>
      Effect.sync(() => {
        const context = sessions.get(threadId);
        return context !== undefined && !context.stopped;
      });

    const readThread: CopilotAdapterShape["readThread"] = (threadId) =>
      Effect.gen(function* () {
        const context = yield* getContext(threadId);
        const turns = [...context.turns];
        if (context.turnState) {
          turns.push({ id: context.turnState.turnId, items: [...context.turnState.items] });
        }
        return {
          threadId,
          turns,
        };
      });

    const rollbackThread: CopilotAdapterShape["rollbackThread"] = (threadId) =>
      Effect.fail(
        new ProviderAdapterRequestError({
          provider: PROVIDER,
          method: "session.rollback",
          detail: `GitHub Copilot rollback is not implemented for thread '${threadId}'.`,
        }),
      );

    const stopAll: CopilotAdapterShape["stopAll"] = () =>
      Effect.promise(async () => {
        await Promise.all(
          [...sessions.values()].map((context) =>
            Effect.runPromise(stopContext(context).pipe(Effect.asVoid)),
          ),
        );
      });

    return {
      provider: PROVIDER,
      capabilities: {
        sessionModelSwitch: "in-session",
      },
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
    } satisfies CopilotAdapterShape;
  });

export const CopilotAdapterLive = makeCopilotAdapterLive();
