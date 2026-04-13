import crypto from "node:crypto";
import {
  EventId,
  ProviderRuntimeEvent,
  ProviderSession,
  ProviderTurnStartResult,
  RuntimeItemId,
  TurnId,
} from "@okcode/contracts";
import type { ProviderSendTurnInput, ThreadId } from "@okcode/contracts";
import { Effect, Layer, Queue, Ref, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
} from "../Errors.ts";
import { GeminiAdapter, type GeminiAdapterShape } from "../Services/GeminiAdapter.ts";

type GeminiSessionContext = {
  readonly session: ProviderSession;
  readonly resumeId?: string | undefined;
  readonly turns: ReadonlyArray<{ readonly id: TurnId; readonly items: ReadonlyArray<unknown> }>;
};

type GeminiStreamEvent =
  | { type: "init"; session_id?: string; model?: string }
  | { type: "message"; role?: string; content?: string; delta?: boolean }
  | { type: "tool_use"; tool_name?: string; tool_id?: string; parameters?: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_id?: string;
      status?: "success" | "error";
      output?: string;
      error?: { type?: string; message?: string };
    }
  | {
      type: "error";
      severity?: "warning" | "error";
      message?: string;
    }
  | {
      type: "result";
      status?: "success" | "error";
      error?: { type?: string; message?: string };
      stats?: Record<string, unknown>;
    };

function nowIso(): string {
  return new Date().toISOString();
}

function eventId(prefix: string): EventId {
  return EventId.makeUnsafe(`${prefix}_${crypto.randomUUID()}`);
}

function turnId(): TurnId {
  return TurnId.makeUnsafe(`turn_${crypto.randomUUID()}`);
}

function runtimeItemId(value: string): RuntimeItemId {
  return RuntimeItemId.makeUnsafe(value);
}

function decodeNdjson(stdout: string): ReadonlyArray<GeminiStreamEvent> {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as GeminiStreamEvent];
      } catch {
        return [];
      }
    });
}

const makeGeminiAdapter = Effect.gen(function* () {
  const runtimeEventQueue = yield* Queue.unbounded<ProviderRuntimeEvent>();
  const sessionsRef = yield* Ref.make(new Map<string, GeminiSessionContext>());
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const emit = (event: ProviderRuntimeEvent) =>
    Queue.offer(runtimeEventQueue, event).pipe(Effect.asVoid);

  const getContext = (threadId: ThreadId) =>
    Ref.get(sessionsRef).pipe(
      Effect.flatMap((sessions) => {
        const context = sessions.get(threadId);
        return context
          ? Effect.succeed(context)
          : Effect.fail(
              new ProviderAdapterSessionNotFoundError({
                provider: "gemini",
                threadId,
              }),
            );
      }),
    );

  const setContext = (threadId: ThreadId, context: GeminiSessionContext) =>
    Ref.update(sessionsRef, (sessions) => {
      const next = new Map(sessions);
      next.set(threadId, context);
      return next;
    });

  const startSession: GeminiAdapterShape["startSession"] = (input) =>
    Effect.gen(function* () {
      const session: ProviderSession = {
        provider: "gemini",
        status: "ready",
        runtimeMode: input.runtimeMode,
        ...(input.cwd ? { cwd: input.cwd } : {}),
        ...(input.model ? { model: input.model } : {}),
        ...(input.resumeCursor ? { resumeCursor: input.resumeCursor } : {}),
        threadId: input.threadId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      yield* setContext(input.threadId, {
        session,
        resumeId: typeof input.resumeCursor === "string" ? input.resumeCursor : undefined,
        turns: [],
      });
      yield* emit({
        eventId: eventId("gemini_session_started"),
        provider: "gemini",
        type: "session.started",
        threadId: input.threadId,
        createdAt: nowIso(),
        payload: typeof input.resumeCursor === "string" ? { resume: input.resumeCursor } : {},
      });
      yield* emit({
        eventId: eventId("gemini_session_state"),
        provider: "gemini",
        type: "session.state.changed",
        threadId: input.threadId,
        createdAt: nowIso(),
        payload: { state: "ready" },
      });
      return session;
    });

  const sendTurn: GeminiAdapterShape["sendTurn"] = (input: ProviderSendTurnInput) =>
    Effect.gen(function* () {
      const existing = yield* getContext(input.threadId);
      const nextModel = input.model ?? existing.session.model ?? "auto-gemini-3";
      const currentTurnId = turnId();
      const prompt = input.input ?? "";
      const args = [
        "-p",
        prompt,
        "--output-format",
        "stream-json",
        "--model",
        nextModel,
        "--sandbox",
        "--approval-mode",
        "yolo",
      ];
      if (existing.resumeId) {
        args.push("--resume", existing.resumeId);
      }

      const nextSession: ProviderSession = {
        ...existing.session,
        status: "running",
        model: nextModel,
        activeTurnId: currentTurnId,
        updatedAt: nowIso(),
      };
      yield* setContext(input.threadId, { ...existing, session: nextSession });
      yield* emit({
        eventId: eventId("gemini_turn_started"),
        provider: "gemini",
        type: "turn.started",
        threadId: input.threadId,
        turnId: currentTurnId,
        createdAt: nowIso(),
        payload: { model: nextModel },
      });

      const { stdout, stderr, exitCode } = yield* Effect.scoped(
        Effect.gen(function* () {
          const command = ChildProcess.make("gemini", args, {
            shell: process.platform === "win32",
            env: process.env,
          });
          const child = yield* spawner.spawn(command);
          const stdout = yield* Stream.runFold(
            child.stdout,
            () => "",
            (acc, chunk) => acc + new TextDecoder().decode(chunk),
          );
          const stderr = yield* Stream.runFold(
            child.stderr,
            () => "",
            (acc, chunk) => acc + new TextDecoder().decode(chunk),
          );
          const exitCode = Number(yield* child.exitCode);
          return { stdout, stderr, exitCode };
        }),
      ).pipe(
        Effect.mapError(
          (cause) =>
            new ProviderAdapterProcessError({
              provider: "gemini",
              threadId: input.threadId,
              detail: cause instanceof Error ? cause.message : String(cause),
            }),
        ),
      );

      const streamEvents = decodeNdjson(stdout);
      let resumeId = existing.resumeId;
      for (const streamEvent of streamEvents) {
        if (streamEvent.type === "init" && typeof streamEvent.session_id === "string") {
          resumeId = streamEvent.session_id;
          continue;
        }
        if (
          streamEvent.type === "message" &&
          streamEvent.role === "assistant" &&
          typeof streamEvent.content === "string"
        ) {
          yield* emit({
            eventId: eventId("gemini_content_delta"),
            provider: "gemini",
            type: "content.delta",
            threadId: input.threadId,
            turnId: currentTurnId,
            createdAt: nowIso(),
            payload: {
              streamKind: "assistant_text",
              delta: streamEvent.content,
            },
          });
          continue;
        }
        if (streamEvent.type === "tool_use" && streamEvent.tool_id) {
          yield* emit({
            eventId: eventId("gemini_tool_started"),
            provider: "gemini",
            type: "item.started",
            threadId: input.threadId,
            turnId: currentTurnId,
            itemId: runtimeItemId(streamEvent.tool_id),
            createdAt: nowIso(),
            payload: {
              itemType: "dynamic_tool_call",
              title: streamEvent.tool_name,
              data: streamEvent.parameters,
            },
          });
          continue;
        }
        if (streamEvent.type === "tool_result" && streamEvent.tool_id) {
          yield* emit({
            eventId: eventId("gemini_tool_completed"),
            provider: "gemini",
            type: "item.completed",
            threadId: input.threadId,
            turnId: currentTurnId,
            itemId: runtimeItemId(streamEvent.tool_id),
            createdAt: nowIso(),
            payload: {
              itemType: "dynamic_tool_call",
              status: streamEvent.status === "error" ? "failed" : "completed",
              detail: streamEvent.output ?? streamEvent.error?.message,
            },
          });
          continue;
        }
        if (streamEvent.type === "error" && streamEvent.message) {
          yield* emit({
            eventId: eventId("gemini_runtime_warning"),
            provider: "gemini",
            type: streamEvent.severity === "error" ? "runtime.error" : "runtime.warning",
            threadId: input.threadId,
            turnId: currentTurnId,
            createdAt: nowIso(),
            payload:
              streamEvent.severity === "error"
                ? { message: streamEvent.message, class: "provider_error" }
                : { message: streamEvent.message },
          } as ProviderRuntimeEvent);
        }
      }

      const resultEvent = streamEvents.toReversed().find((entry) => entry.type === "result");
      const failed =
        exitCode !== 0 ||
        resultEvent?.status === "error" ||
        (!resultEvent && streamEvents.length === 0 && stderr.trim().length > 0);

      const completedSession: ProviderSession = {
        ...nextSession,
        status: failed ? "error" : "ready",
        activeTurnId: undefined,
        updatedAt: nowIso(),
        ...(failed
          ? {
              lastError:
                resultEvent?.error?.message ?? (stderr.trim() || "Gemini CLI turn failed."),
            }
          : {}),
        ...(resumeId ? { resumeCursor: resumeId } : {}),
      };
      yield* setContext(input.threadId, {
        session: completedSession,
        resumeId,
        turns: [
          ...existing.turns,
          {
            id: currentTurnId,
            items: [],
          },
        ],
      });

      if (failed) {
        const message = resultEvent?.error?.message ?? (stderr.trim() || "Gemini CLI turn failed.");
        yield* emit({
          eventId: eventId("gemini_runtime_error"),
          provider: "gemini",
          type: "runtime.error",
          threadId: input.threadId,
          turnId: currentTurnId,
          createdAt: nowIso(),
          payload: { message, class: "provider_error" },
        });
      }

      yield* emit({
        eventId: eventId("gemini_turn_completed"),
        provider: "gemini",
        type: "turn.completed",
        threadId: input.threadId,
        turnId: currentTurnId,
        createdAt: nowIso(),
        payload: {
          state: failed ? "failed" : "completed",
          ...(failed ? { errorMessage: resultEvent?.error?.message ?? stderr.trim() } : {}),
          ...(resultEvent?.stats ? { usage: resultEvent.stats } : {}),
        },
      });

      if (failed) {
        return yield* new ProviderAdapterRequestError({
          provider: "gemini",
          method: "gemini turn",
          detail:
            resultEvent?.error?.message ?? (stderr.trim() || "Gemini CLI exited with an error."),
        });
      }

      return {
        threadId: input.threadId,
        turnId: currentTurnId,
        ...(resumeId ? { resumeCursor: resumeId } : {}),
      } satisfies ProviderTurnStartResult;
    });

  const interruptTurn: GeminiAdapterShape["interruptTurn"] = () => Effect.void;
  const respondToRequest: GeminiAdapterShape["respondToRequest"] = (
    _threadId,
    _requestId,
    _decision,
  ) => Effect.void;
  const respondToUserInput: GeminiAdapterShape["respondToUserInput"] = (
    _threadId,
    _requestId,
    _answers,
  ) => Effect.void;

  const stopSession: GeminiAdapterShape["stopSession"] = (threadId) =>
    Ref.update(sessionsRef, (sessions) => {
      const next = new Map(sessions);
      next.delete(threadId);
      return next;
    });

  const listSessions: GeminiAdapterShape["listSessions"] = () =>
    Ref.get(sessionsRef).pipe(
      Effect.map((sessions) => Array.from(sessions.values(), (entry) => entry.session)),
    );

  const hasSession: GeminiAdapterShape["hasSession"] = (threadId) =>
    Ref.get(sessionsRef).pipe(Effect.map((sessions) => sessions.has(threadId)));

  const readThread: GeminiAdapterShape["readThread"] = (threadId) =>
    getContext(threadId).pipe(
      Effect.map((context) => ({
        threadId,
        turns: context.turns,
      })),
    );

  const rollbackThread: GeminiAdapterShape["rollbackThread"] = (threadId, numTurns) =>
    getContext(threadId).pipe(
      Effect.flatMap((context) => {
        const turns =
          numTurns <= 0
            ? context.turns
            : context.turns.slice(0, Math.max(0, context.turns.length - numTurns));
        return setContext(threadId, { ...context, turns }).pipe(
          Effect.as({
            threadId,
            turns,
          }),
        );
      }),
    );

  const stopAll: GeminiAdapterShape["stopAll"] = () => Ref.set(sessionsRef, new Map());

  return {
    provider: "gemini",
    capabilities: {
      sessionModelSwitch: "restart-session",
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
  } satisfies GeminiAdapterShape;
});

export const GeminiAdapterLive = Layer.effect(GeminiAdapter, makeGeminiAdapter);
