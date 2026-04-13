import {
  type ProviderKind,
  type ProviderRuntimeEvent,
  type ProviderStartOptions,
  type SmeMessageEvent,
  ThreadId,
} from "@okcode/contracts";
import { Effect, Fiber, Ref, Stream } from "effect";
import { randomUUID } from "node:crypto";

import type { ProviderServiceShape } from "../../provider/Services/ProviderService.ts";
import { SmeChatError } from "../Services/SmeChatService.ts";

export const SME_CHAT_ONLY_PROVIDER_WORKFLOW_ERROR =
  "Selected SME provider attempted an interactive/tool workflow; SME chat only supports direct conversational replies.";

function isToolWorkflowItem(event: ProviderRuntimeEvent): boolean {
  if (
    (event.type === "item.started" ||
      event.type === "item.updated" ||
      event.type === "item.completed") &&
    event.payload.itemType !== "assistant_message" &&
    event.payload.itemType !== "reasoning" &&
    event.payload.itemType !== "plan" &&
    event.payload.itemType !== "user_message" &&
    event.payload.itemType !== "unknown"
  ) {
    return true;
  }
  return false;
}

function toRuntimeFailure(
  event: Extract<ProviderRuntimeEvent, { type: "turn.completed" }>,
): string {
  if (event.payload.errorMessage) {
    return event.payload.errorMessage;
  }
  return `Provider turn ended in state '${event.payload.state}'.`;
}

export interface SendSmeViaProviderRuntimeInput {
  readonly providerService: ProviderServiceShape;
  readonly provider: ProviderKind;
  readonly conversationId: string;
  readonly assistantMessageId: string;
  readonly model: string;
  readonly compiledPrompt: string;
  readonly providerOptions?: ProviderStartOptions | undefined;
  readonly onEvent?: ((event: SmeMessageEvent) => void) | undefined;
  readonly setInterruptEffect: (interrupt: Effect.Effect<void, never>) => Effect.Effect<void>;
  readonly clearInterruptEffect: Effect.Effect<void>;
}

export function sendSmeViaProviderRuntime(input: SendSmeViaProviderRuntimeInput) {
  return Effect.gen(function* () {
    const threadId = ThreadId.makeUnsafe(`sme-${input.conversationId}-${randomUUID()}`);
    const responseText = yield* Ref.make("");
    const completionRef = yield* Ref.make<{
      readonly done: boolean;
      readonly text?: string;
      readonly error?: SmeChatError;
    }>({ done: false });

    const resolveOnce = (result: { readonly text?: string; readonly error?: SmeChatError }) =>
      Ref.modify(completionRef, (state) => {
        if (state.done) {
          return [false, state] as const;
        }
        return [true, { done: true, ...result }] as const;
      }).pipe(Effect.asVoid);

    const safeStopSession = input.providerService
      .stopSession({ threadId })
      .pipe(Effect.orElseSucceed(() => undefined));

    const streamFiber = yield* Stream.runForEach(
      input.providerService.streamEvents.pipe(
        Stream.filter((event) => event.threadId === threadId),
      ),
      (event) =>
        Effect.gen(function* () {
          if (event.type === "content.delta" && event.payload.streamKind === "assistant_text") {
            yield* Ref.update(responseText, (current) => current + event.payload.delta);
            input.onEvent?.({
              type: "sme.message.delta",
              conversationId: input.conversationId as never,
              messageId: input.assistantMessageId as never,
              text: event.payload.delta,
            });
            return;
          }

          if (
            event.type === "request.opened" ||
            event.type === "user-input.requested" ||
            isToolWorkflowItem(event)
          ) {
            yield* resolveOnce({
              error: new SmeChatError(
                "sendMessage:providerRuntime",
                SME_CHAT_ONLY_PROVIDER_WORKFLOW_ERROR,
              ),
            });
            return;
          }

          if (event.type === "runtime.error") {
            yield* resolveOnce({
              error: new SmeChatError("sendMessage:providerRuntime", event.payload.message),
            });
            return;
          }

          if (event.type === "turn.aborted") {
            yield* resolveOnce({
              error: new SmeChatError("sendMessage:providerRuntime", event.payload.reason),
            });
            return;
          }

          if (event.type === "turn.completed") {
            if (event.payload.state !== "completed") {
              yield* resolveOnce({
                error: new SmeChatError("sendMessage:providerRuntime", toRuntimeFailure(event)),
              });
              return;
            }
            const text = yield* Ref.get(responseText);
            yield* resolveOnce({ text });
          }
        }),
    ).pipe(Effect.forkScoped);

    const startSessionInput = {
      threadId,
      provider: input.provider,
      model: input.model,
      ...(input.providerOptions ? { providerOptions: input.providerOptions } : {}),
      runtimeMode: "approval-required" as const,
    };
    yield* input.providerService
      .startSession(threadId, startSessionInput)
      .pipe(
        Effect.mapError(
          (cause) => new SmeChatError("sendMessage:providerRuntime", String(cause), cause),
        ),
      );

    const turn = yield* input.providerService
      .sendTurn({
        threadId,
        input: input.compiledPrompt,
        model: input.model,
        interactionMode: "chat",
      })
      .pipe(
        Effect.mapError(
          (cause) => new SmeChatError("sendMessage:providerRuntime", String(cause), cause),
        ),
      );

    yield* input.setInterruptEffect(
      Effect.gen(function* () {
        yield* input.providerService
          .interruptTurn({ threadId, turnId: turn.turnId })
          .pipe(Effect.orElseSucceed(() => undefined));
        yield* safeStopSession;
      }),
    );

    const awaitCompletion = (): Effect.Effect<{
      readonly done: boolean;
      readonly text?: string;
      readonly error?: SmeChatError;
    }> =>
      Ref.get(completionRef).pipe(
        Effect.flatMap((result) =>
          result.done
            ? Effect.succeed(result)
            : Effect.sleep("100 millis").pipe(Effect.flatMap(() => awaitCompletion())),
        ),
      );

    const settled = yield* awaitCompletion().pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          yield* input.clearInterruptEffect;
          yield* Fiber.interrupt(streamFiber);
          yield* safeStopSession;
        }),
      ),
    );

    if (settled.error) {
      return yield* Effect.fail(settled.error);
    }

    return settled.text ?? "";
  }).pipe(Effect.scoped);
}
