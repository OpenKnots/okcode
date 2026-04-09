import type { SmeConversation, SmeKnowledgeDocument, SmeMessage } from "@okcode/contracts";
import { create } from "zustand";

export interface SmeState {
  conversations: SmeConversation[];
  documents: SmeKnowledgeDocument[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, SmeMessage[]>;
  streamingConversationId: string | null;
  streamingMessageId: string | null;
  streamingText: string;
}

interface SmeActions {
  setConversations: (conversations: SmeConversation[]) => void;
  setDocuments: (documents: SmeKnowledgeDocument[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: SmeMessage[]) => void;
  appendStreamDelta: (conversationId: string, messageId: string, text: string) => void;
  completeStream: (conversationId: string, messageId: string, text: string) => void;
  clearStream: () => void;
  addConversation: (conversation: SmeConversation) => void;
  removeConversation: (conversationId: string) => void;
  addDocument: (document: SmeKnowledgeDocument) => void;
  removeDocument: (documentId: string) => void;
  addUserMessage: (conversationId: string, message: SmeMessage) => void;
}

export const useSmeStore = create<SmeState & SmeActions>((set) => ({
  conversations: [],
  documents: [],
  activeConversationId: null,
  messagesByConversation: {},
  streamingConversationId: null,
  streamingMessageId: null,
  streamingText: "",

  setConversations: (conversations) => set({ conversations }),
  setDocuments: (documents) => set({ documents }),
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),

  appendStreamDelta: (conversationId, messageId, text) =>
    set((state) => ({
      streamingConversationId: conversationId,
      streamingMessageId: messageId,
      streamingText:
        state.streamingConversationId === conversationId && state.streamingMessageId === messageId
          ? state.streamingText + text
          : text,
    })),

  completeStream: (conversationId, messageId, text) =>
    set((state) => {
      if (
        state.streamingMessageId !== messageId ||
        state.streamingConversationId !== conversationId
      ) {
        return {
          streamingConversationId: null,
          streamingMessageId: null,
          streamingText: "",
        };
      }

      const messages = state.messagesByConversation[conversationId] ?? [];
      const updatedMessages = messages.map((m) =>
        m.messageId === messageId ? { ...m, text, isStreaming: false } : m,
      );

      // If the message doesn't exist yet, append it
      const exists = messages.some((m) => m.messageId === messageId);
      if (!exists) {
        updatedMessages.push({
          messageId,
          conversationId,
          role: "assistant",
          text,
          isStreaming: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as SmeMessage);
      }

      return {
        streamingConversationId: null,
        streamingMessageId: null,
        streamingText: "",
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updatedMessages,
        },
      };
    }),

  clearStream: () =>
    set({ streamingConversationId: null, streamingMessageId: null, streamingText: "" }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  removeConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.conversationId !== conversationId),
      activeConversationId:
        state.activeConversationId === conversationId ? null : state.activeConversationId,
    })),

  addDocument: (document) =>
    set((state) => ({
      documents: [...state.documents, document],
    })),

  removeDocument: (documentId) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.documentId !== documentId),
    })),

  addUserMessage: (conversationId, message) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: [...(state.messagesByConversation[conversationId] ?? []), message],
      },
    })),
}));
