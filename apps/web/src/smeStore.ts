import type { SmeConversation, SmeKnowledgeDocument, SmeMessage } from "@okcode/contracts";
import { create } from "zustand";

export interface SmeState {
  conversations: SmeConversation[];
  documents: SmeKnowledgeDocument[];
  activeConversationId: string | null;
  messagesByConversation: Record<string, SmeMessage[]>;
  streamingMessageId: string | null;
  streamingText: string;
}

interface SmeActions {
  setConversations: (conversations: SmeConversation[]) => void;
  setDocuments: (documents: SmeKnowledgeDocument[]) => void;
  setActiveConversationId: (id: string | null) => void;
  setMessages: (conversationId: string, messages: SmeMessage[]) => void;
  appendStreamDelta: (messageId: string, text: string) => void;
  completeStream: (messageId: string, text: string) => void;
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

  appendStreamDelta: (messageId, text) =>
    set((state) => ({
      streamingMessageId: messageId,
      streamingText: state.streamingText + text,
    })),

  completeStream: (messageId, text) =>
    set((state) => {
      const conversationId = Object.keys(state.messagesByConversation).find((cid) =>
        state.messagesByConversation[cid]?.some(
          (m) => m.messageId === messageId || state.streamingMessageId === messageId,
        ),
      );

      if (!conversationId) {
        return { streamingMessageId: null, streamingText: "" };
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
        streamingMessageId: null,
        streamingText: "",
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: updatedMessages,
        },
      };
    }),

  clearStream: () => set({ streamingMessageId: null, streamingText: "" }),

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
