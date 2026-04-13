import Anthropic from "@anthropic-ai/sdk";
import type { SmeMessageEvent } from "@okcode/contracts";
import { Effect } from "effect";

import { SmeChatError } from "../Services/SmeChatService.ts";

type AnthropicMessagesClient = Pick<Anthropic, "messages">;

export interface ResolvedAnthropicClientOptions {
  readonly apiKey: string | null;
  readonly authToken: string | null;
  readonly baseURL?: string;
}

export interface SendSmeViaAnthropicInput {
  readonly client: AnthropicMessagesClient;
  readonly conversationId: string;
  readonly assistantMessageId: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly messages: Array<{ role: "user" | "assistant"; content: string }>;
  readonly onEvent?: ((event: SmeMessageEvent) => void) | undefined;
  readonly abortSignal?: AbortSignal | undefined;
}

export function sendSmeViaAnthropic(input: SendSmeViaAnthropicInput) {
  return Effect.tryPromise({
    try: async () => {
      let result = "";
      const stream = input.client.messages.stream(
        {
          model: input.model,
          max_tokens: 8192,
          system: input.systemPrompt,
          messages: input.messages,
        },
        input.abortSignal ? { signal: input.abortSignal } : undefined,
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          result += event.delta.text;
          input.onEvent?.({
            type: "sme.message.delta",
            conversationId: input.conversationId as never,
            messageId: input.assistantMessageId as never,
            text: event.delta.text,
          });
        }
      }

      return result;
    },
    catch: (cause) => new SmeChatError("sendMessage:anthropic", String(cause), cause),
  });
}
