import { useCallback, useState } from "react";
import { PlusIcon, TrashIcon, MessageSquareIcon } from "lucide-react";
import type { SmeConversationId } from "@okcode/contracts";

import type { Project } from "~/types";
import { ensureNativeApi } from "~/nativeApi";
import { useSmeStore } from "~/smeStore";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";

import { SmeConversationDialog } from "./SmeConversationDialog";
import { SME_PROVIDER_LABELS } from "./smeConversationConfig";

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
  const removeConversation = useSmeStore((s) => s.removeConversation);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleNewConversation = useCallback(async () => {
    setCreateDialogOpen(true);
  }, []);

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
    <div className="flex w-64 shrink-0 flex-col bg-muted/30">
      {/* Header with new chat button */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Chats</span>
        <button
          type="button"
          onClick={handleNewConversation}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          title="New conversation"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {/* Project selector */}
      {projects.length > 1 ? (
        <div className="px-3 pb-2">
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => onProjectChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <MessageSquareIcon className="size-5 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-0.5 py-1">
            {conversations.map((conv) => (
              <button
                key={conv.conversationId}
                type="button"
                onClick={() => setActiveConversationId(conv.conversationId)}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                  activeConversationId === conv.conversationId
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{conv.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                      {SME_PROVIDER_LABELS[conv.provider]}
                    </Badge>
                    <span className="truncate text-[10px] text-muted-foreground/80">
                      {conv.model}
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={(e) => void handleDeleteConversation(e, conv.conversationId)}
                  className="shrink-0 rounded-md p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                >
                  <TrashIcon className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
      <SmeConversationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        projectId={project.id}
      />
    </div>
  );
}
