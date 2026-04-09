import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpenIcon, ArrowUpIcon, SparklesIcon } from "lucide-react";
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

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [inputText]);

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
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5">
          <SparklesIcon className="size-7 text-primary/60" />
        </div>
        <div className="space-y-2 text-center">
          <h3 className="text-base font-medium text-foreground">SME Chat</h3>
          <p className="max-w-xs text-sm text-muted-foreground">
            Select a conversation or create a new one to start chatting with your subject matter
            expert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Minimal Header */}
      <div className="flex items-center justify-end px-4 py-2">
        <button
          type="button"
          onClick={onToggleKnowledge}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            knowledgePanelOpen
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <BookOpenIcon className="size-3.5" />
          <span>Knowledge Base</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
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
            <div className="flex items-center gap-4 px-4 py-5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                <SparklesIcon className="size-4" />
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

      {/* Modern Composer */}
      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end rounded-2xl border border-border bg-muted/30 shadow-sm transition-colors focus-within:border-ring focus-within:bg-muted/50">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your SME..."
              rows={1}
              className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center gap-1 p-2">
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!inputText.trim() || sending}
                className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:bg-muted-foreground/20 disabled:text-muted-foreground/40"
              >
                <ArrowUpIcon className="size-4" />
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
            SME can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
