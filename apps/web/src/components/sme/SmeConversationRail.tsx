import { useCallback, useState } from "react";
import { MessageSquarePlusIcon, TrashIcon } from "lucide-react";
import type { SmeConversationId } from "@okcode/contracts";

import type { Project } from "~/types";
import { ensureNativeApi } from "~/nativeApi";
import { useSmeStore } from "~/smeStore";
import { cn } from "~/lib/utils";

interface SmeConversationRailProps {
  project: Project;
  projects: Project[];
  selectedProjectId: string | null;
  onProjectChange: (projectId: string) => void;
}

export function SmeConversationRail({
  project,
  projects,
  selectedProjectId,
  onProjectChange,
}: SmeConversationRailProps) {
  const conversations = useSmeStore((s) => s.conversations);
  const activeConversationId = useSmeStore((s) => s.activeConversationId);
  const setActiveConversationId = useSmeStore((s) => s.setActiveConversationId);
  const addConversation = useSmeStore((s) => s.addConversation);
  const removeConversation = useSmeStore((s) => s.removeConversation);
  const [creating, setCreating] = useState(false);

  const handleNewConversation = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const api = ensureNativeApi();
      const conv = await api.sme.createConversation({
        projectId: project.id,
        title: "New Conversation",
        model: "claude-sonnet-4-6",
      });
      addConversation(conv);
      setActiveConversationId(conv.conversationId as string);
    } finally {
      setCreating(false);
    }
  }, [project.id, creating, addConversation, setActiveConversationId]);

  const handleDeleteConversation = useCallback(
    async (e: React.MouseEvent, conversationId: string) => {
      e.stopPropagation();
      const api = ensureNativeApi();
      await api.sme.deleteConversation({ conversationId: conversationId as SmeConversationId });
      removeConversation(conversationId);
    },
    [removeConversation],
  );

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Project selector */}
      {projects.length > 1 ? (
        <div className="border-b border-border px-3 py-2">
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => onProjectChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* New conversation button */}
      <div className="px-3 py-2">
        <button
          type="button"
          onClick={handleNewConversation}
          disabled={creating}
          className="flex w-full items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <MessageSquarePlusIcon className="size-3.5" />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-1.5">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-0.5 py-1">
            {conversations.map((conv) => (
              <button
                key={conv.conversationId}
                type="button"
                onClick={() => setActiveConversationId(conv.conversationId)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                  activeConversationId === conv.conversationId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{conv.title}</span>
                <button
                  type="button"
                  onClick={(e) => void handleDeleteConversation(e, conv.conversationId)}
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <TrashIcon className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
