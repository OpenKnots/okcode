import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenIcon, SendIcon } from "lucide-react";
import type { SmeConversationId, SmeMessage, SmeMessageId } from "@okcode/contracts";
import { ensureNativeApi } from "~/nativeApi";
import { useSmeStore } from "~/smeStore";
import { toastManager } from "~/components/ui/toast";

import { SmeMessageBubble } from "./SmeMessageBubble";

const EMPTY_MESSAGES: SmeMessage[] = [];

interface SmeChatWorkspaceProps {
  conversationId: string | null;
  onToggleKnowledge: () => void;
  knowledgePanelOpen: boolean;
}

export function SmeChatWorkspace({
  conversationId,
  onToggleKnowledge,
  knowledgePanelOpen,
}: SmeChatWorkspaceProps) {
  const messages = useSmeStore((s) =>
    conversationId ? (s.messagesByConversation[conversationId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );
  const streamingConversationId = useSmeStore((s) => s.streamingConversationId);
  const streamingMessageId = useSmeStore((s) => s.streamingMessageId);
  const streamingText = useSmeStore((s) => s.streamingText);
  const addUserMessage = useSmeStore((s) => s.addUserMessage);
  const clearStream = useSmeStore((s) => s.clearStream);
  const setMessages = useSmeStore((s) => s.setMessages);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    if (!conversationId || !inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText("");
    setSending(true);
    const previousMessages = messages;

    // Optimistically add user message
    addUserMessage(conversationId, {
      messageId: `temp-${Date.now()}` as SmeMessageId,
      conversationId: conversationId as SmeConversationId,
      role: "user",
      text,
      isStreaming: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as SmeMessage);

    try {
      const api = ensureNativeApi();
      await api.sme.sendMessage({ conversationId: conversationId as SmeConversationId, text });
      const result = await api.sme.getConversation({
        conversationId: conversationId as SmeConversationId,
      });
      if (result) {
        setMessages(conversationId, result.messages as any[]);
      }
    } catch (error) {
      clearStream();

      try {
        const api = ensureNativeApi();
        const result = await api.sme.getConversation({
          conversationId: conversationId as SmeConversationId,
        });
        if (result) {
          setMessages(conversationId, result.messages as any[]);
        } else {
          setMessages(conversationId, previousMessages);
        }
      } catch {
        setMessages(conversationId, previousMessages);
      }

      toastManager.add({
        type: "error",
        title: "SME Chat send failed",
        description: error instanceof Error ? error.message : "Unknown SME Chat error.",
      });
    } finally {
      setSending(false);
    }
  }, [conversationId, inputText, sending, messages, addUserMessage, clearStream, setMessages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          <BookOpenIcon className="mx-auto size-10 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            Select a conversation or create a new one to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium text-foreground">Conversation</span>
        <button
          type="button"
          onClick={onToggleKnowledge}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
            knowledgePanelOpen
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }`}
        >
          <BookOpenIcon className="size-3.5" />
          <span>Knowledge Base</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <SmeMessageBubble key={msg.messageId} message={msg} />
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
          {sending && !streamingText ? (
            <div className="flex items-center gap-2 py-2">
              <div className="flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
              <span className="text-xs text-muted-foreground">Thinking...</span>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your subject matter expert..."
            rows={1}
            className="min-h-[36px] max-h-[200px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!inputText.trim() || sending}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <SendIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
