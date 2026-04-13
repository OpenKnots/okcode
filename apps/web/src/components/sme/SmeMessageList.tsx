import { memo, useEffect, useRef } from "react";
import type { SmeConversationId, SmeMessage, SmeMessageId } from "@okcode/contracts";

import { isScrollContainerNearBottom } from "~/chat-scroll";
import { useSmeStore } from "~/smeStore";

import { SmeMessageBubble } from "./SmeMessageBubble";

const EMPTY_MESSAGES: SmeMessage[] = [];

interface SmeMessageListProps {
  conversationId: string;
  sending: boolean;
}

export const SmeMessageList = memo(function SmeMessageList({
  conversationId,
  sending,
}: SmeMessageListProps) {
  const messages = useSmeStore(
    (state) => state.messagesByConversation[conversationId] ?? EMPTY_MESSAGES,
  );
  const streamingConversationId = useSmeStore((state) => state.streamingConversationId);
  const streamingMessageId = useSmeStore((state) => state.streamingMessageId);
  const streamingText = useSmeStore((state) => state.streamingText);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    shouldAutoScrollRef.current = isScrollContainerNearBottom(scrollContainer);

    const handleScroll = () => {
      shouldAutoScrollRef.current = isScrollContainerNearBottom(scrollContainer);
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!shouldAutoScrollRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: streamingConversationId === conversationId ? "auto" : "smooth",
      block: "end",
    });
  }, [conversationId, messages, streamingConversationId, streamingText]);

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl">
        {messages.map((message) => (
          <SmeMessageBubble key={message.messageId} message={message} />
        ))}
        {streamingConversationId === conversationId && streamingText ? (
          <SmeMessageBubble
            message={
              {
                messageId: (streamingMessageId ?? "streaming") as SmeMessageId,
                conversationId: conversationId as SmeConversationId,
                role: "assistant",
                text: streamingText,
                isStreaming: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as SmeMessage
            }
          />
        ) : null}
        {sending && streamingConversationId !== conversationId ? (
          <div className="flex items-center gap-4 px-4 py-5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
              <div className="size-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">SME Assistant</p>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});
