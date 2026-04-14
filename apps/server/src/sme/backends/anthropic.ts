import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources";
import type { SmeMessageEvent } from "@okcode/contracts";
import { Effect } from "effect";

import { SmeChatError } from "../Services/SmeChatService.ts";
import type { ProviderStartOptions } from "@okcode/contracts";

type AnthropicMessagesClient = Pick<Anthropic, "messages">;

export interface ResolvedAnthropicClientOptions {
  readonly apiKey: string | null;
  readonly authToken: string | null;
  readonly baseURL?: string;
}

export interface ResolveAnthropicClientOptionsInput {
  readonly providerOptions?: ProviderStartOptions["claudeAgent"];
  readonly env?: NodeJS.ProcessEnv;
}

function nonEmptyTrimmed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveAnthropicClientOptions(
  input?: ResolveAnthropicClientOptionsInput,
): ResolvedAnthropicClientOptions {
  const env = input?.env ?? process.env;
  const explicitApiKey = nonEmptyTrimmed(env.ANTHROPIC_API_KEY);
  const explicitAuthToken = nonEmptyTrimmed(env.ANTHROPIC_AUTH_TOKEN);
  const baseURL = nonEmptyTrimmed(env.ANTHROPIC_BASE_URL ?? env.ANTHROPIC_API_BASE_URL);

  return {
    apiKey: explicitAuthToken ? null : (explicitApiKey ?? null),
    authToken: explicitAuthToken ?? null,
    ...(baseURL ? { baseURL } : {}),
  };
}

function createAnthropicClient(options: ResolvedAnthropicClientOptions): AnthropicMessagesClient {
  return new Anthropic({
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.authToken ? { authToken: options.authToken } : {}),
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });
}

export interface SendSmeViaAnthropicInput {
  readonly client?: AnthropicMessagesClient;
  readonly messages: Array<MessageParam>;
  readonly conversationId: string;
  readonly assistantMessageId: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly clientOptions?: ResolvedAnthropicClientOptions;
  readonly onEvent?: ((event: SmeMessageEvent) => void) | undefined;
  readonly abortSignal?: AbortSignal | undefined;
}

export function sendSmeViaAnthropic(input: SendSmeViaAnthropicInput) {
  return Effect.tryPromise({
    try: async () => {
      let result = "";
      const client =
        input.client ??
        createAnthropicClient(input.clientOptions ?? resolveAnthropicClientOptions());
      const stream = client.messages.stream(
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
