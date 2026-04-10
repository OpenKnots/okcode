import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpIcon, BookOpenIcon, Settings2Icon, SparklesIcon, XIcon } from "lucide-react";
import type { SmeConversationId, SmeMessage, SmeMessageId } from "@okcode/contracts";

import { getProviderStartOptions, useAppSettings } from "~/appSettings";
import { ProviderHealthBanner } from "~/components/chat/ProviderHealthBanner";
import { Button } from "~/components/ui/button";
import { ensureNativeApi } from "~/nativeApi";
import { useSmeStore } from "~/smeStore";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { serverConfigQueryOptions } from "~/lib/serverReactQuery";
import { toastManager } from "~/components/ui/toast";

import { SmeConversationDialog } from "./SmeConversationDialog";
import { SmeMessageBubble } from "./SmeMessageBubble";
import { SME_PROVIDER_LABELS } from "./smeConversationConfig";

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
  const { settings } = useAppSettings();
  const providerOptions = useMemo(() => getProviderStartOptions(settings), [settings]);
  const conversations = useSmeStore((state) => state.conversations);
  const conversation = useMemo(
    () => conversations.find((item) => item.conversationId === conversationId) ?? null,
    [conversationId, conversations],
  );
  const messages = useSmeStore((state) =>
    conversationId
      ? (state.messagesByConversation[conversationId] ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );
  const conversationError = useSmeStore((state) =>
    conversationId ? state.errorsByConversation[conversationId] : undefined,
  );
  const streamingConversationId = useSmeStore((state) => state.streamingConversationId);
  const streamingMessageId = useSmeStore((state) => state.streamingMessageId);
  const streamingText = useSmeStore((state) => state.streamingText);
  const addUserMessage = useSmeStore((state) => state.addUserMessage);
  const clearStream = useSmeStore((state) => state.clearStream);
  const setMessages = useSmeStore((state) => state.setMessages);
  const setConversationError = useSmeStore((state) => state.setConversationError);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const validationQuery = useQuery({
    queryKey: [
      "sme",
      "validateSetup",
      conversation?.conversationId ?? null,
      conversation?.provider ?? null,
      conversation?.authMethod ?? null,
      conversation?.model ?? null,
      providerOptions ?? null,
    ],
    enabled: conversation !== null,
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.sme.validateSetup({
        conversationId: conversation!.conversationId,
        providerOptions,
      });
    },
  });

  const providerStatus = useMemo(
    () =>
      conversation
        ? (serverConfigQuery.data?.providers.find(
            (status) => status.provider === conversation.provider,
          ) ?? null)
        : null,
    [conversation, serverConfigQuery.data?.providers],
  );
  const sendDisabled =
    sending ||
    validationQuery.isLoading ||
    (validationQuery.data ? !validationQuery.data.ok : false);

  useEffect(() => {
    setBannerDismissed(false);
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [inputText]);

  const handleSend = useCallback(async () => {
    if (!conversationId || !conversation || !inputText.trim() || sendDisabled) {
      return;
    }

    const text = inputText.trim();
    setInputText("");
    setSending(true);
    setConversationError(conversationId, undefined);
    const previousMessages = messages;

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
      await api.sme.sendMessage({
        conversationId: conversationId as SmeConversationId,
        text,
        providerOptions,
      });
      const result = await api.sme.getConversation({
        conversationId: conversationId as SmeConversationId,
      });
      if (result) {
        setMessages(conversationId, result.messages as SmeMessage[]);
      }
    } catch (error) {
      clearStream();

      try {
        const api = ensureNativeApi();
        const result = await api.sme.getConversation({
          conversationId: conversationId as SmeConversationId,
        });
        if (result) {
          setMessages(conversationId, result.messages as SmeMessage[]);
        } else {
          setMessages(conversationId, previousMessages);
        }
      } catch {
        setMessages(conversationId, previousMessages);
      }

      const description = error instanceof Error ? error.message : "Unknown SME Chat error.";
      setConversationError(conversationId, description);
      toastManager.add({
        type: "error",
        title: "SME Chat send failed",
        description,
      });
    } finally {
      setSending(false);
    }
  }, [
    addUserMessage,
    clearStream,
    conversation,
    conversationId,
    inputText,
    messages,
    providerOptions,
    sendDisabled,
    setConversationError,
    setMessages,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  if (!conversationId || !conversation) {
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
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">{conversation.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {SME_PROVIDER_LABELS[conversation.provider]} · {conversation.authMethod} ·{" "}
            {conversation.model}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setDialogOpen(true)}
          >
            <Settings2Icon className="size-3.5" />
            Settings
          </Button>
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
      </div>

      <div className="px-4">
        <ProviderHealthBanner status={providerStatus} />
        {validationQuery.data && !bannerDismissed ? (
          <div className="mx-auto max-w-3xl pt-3">
            <Alert variant={validationQuery.data.ok ? "default" : "error"}>
              <AlertTitle className="flex items-center justify-between">
                <span>
                  {validationQuery.data.ok ? "Provider ready" : "Provider setup required"}
                </span>
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <XIcon className="size-3.5" />
                </button>
              </AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>{validationQuery.data.message}</span>
                {!validationQuery.data.ok ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDialogOpen(true)}
                  >
                    Settings
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}
        {conversationError ? (
          <div className="mx-auto max-w-3xl pt-3">
            <Alert variant="error">
              <AlertTitle>Latest send failed</AlertTitle>
              <AlertDescription>{conversationError}</AlertDescription>
            </Alert>
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
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

      <div className="px-4 pb-4 pt-2">
        <div className="mx-auto max-w-3xl">
          <div className="relative flex items-end rounded-2xl border border-border bg-muted/30 shadow-sm transition-colors focus-within:border-ring focus-within:bg-muted/50">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your SME..."
              rows={1}
              className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center gap-1 p-2">
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!inputText.trim() || sendDisabled}
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

      <SmeConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={conversation.projectId}
        conversation={conversation}
      />
    </div>
  );
}
