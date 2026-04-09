import { useEffect, useState } from "react";
import type { SmeConversationId, SmeMessageEvent } from "@okcode/contracts";

import type { Project } from "~/types";
import { ensureNativeApi } from "~/nativeApi";
import { useSmeStore } from "~/smeStore";

import { SmeConversationRail } from "./SmeConversationRail";
import { SmeChatWorkspace } from "./SmeChatWorkspace";
import { SmeKnowledgePanel } from "./SmeKnowledgePanel";

interface SmeChatShellProps {
  project: Project;
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}

export function SmeChatShell({
  project,
  projects,
  selectedProjectId,
  onProjectChange,
}: SmeChatShellProps) {
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const activeConversationId = useSmeStore((s) => s.activeConversationId);

  // Load conversations and documents when project changes
  useEffect(() => {
    const api = ensureNativeApi();
    const { setConversations, setDocuments, setActiveConversationId } =
      useSmeStore.getState();
    void api.sme.listConversations({ projectId: project.id }).then((convs) => {
      setConversations(convs as any[]);
    });
    void api.sme.listDocuments({ projectId: project.id }).then((docs) => {
      setDocuments(docs as any[]);
    });
    // Reset active conversation when switching projects
    setActiveConversationId(null);
  }, [project.id]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversationId) return;
    const api = ensureNativeApi();
    void api.sme
      .getConversation({ conversationId: activeConversationId as SmeConversationId })
      .then((result) => {
        if (result) {
          useSmeStore.getState().setMessages(activeConversationId, result.messages as any[]);
        }
      });
  }, [activeConversationId]);

  // Subscribe to SME push events
  useEffect(() => {
    const api = ensureNativeApi();
    const unsubscribe = api.sme.onMessageEvent((event: SmeMessageEvent) => {
      if (event.type === "sme.message.delta") {
        useSmeStore.getState().appendStreamDelta(event.messageId, event.text);
      } else if (event.type === "sme.message.complete") {
        useSmeStore.getState().completeStream(event.messageId, event.text);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left rail - conversation list */}
      <SmeConversationRail
        project={project}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={onProjectChange}
      />

      {/* Center - chat workspace */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SmeChatWorkspace
          conversationId={activeConversationId}
          onToggleKnowledge={() => setKnowledgePanelOpen((v) => !v)}
          knowledgePanelOpen={knowledgePanelOpen}
        />
      </div>

      {/* Right panel - knowledge base */}
      {knowledgePanelOpen ? (
        <SmeKnowledgePanel project={project} onClose={() => setKnowledgePanelOpen(false)} />
      ) : null}
    </div>
  );
}
