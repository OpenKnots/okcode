"use client";

import { Inbox, Plus } from "lucide-react";

interface DashboardEmptyStateProps {
  onCreateIssue: () => void;
}

export function DashboardEmptyState({ onCreateIssue }: DashboardEmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
        <Inbox className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-foreground text-lg font-medium mb-2">No issue selected</h3>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">
        Select an issue from the list to view its details, or create a new one.
      </p>
      <button
        onClick={onCreateIssue}
        className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 text-brand-foreground text-sm font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Issue
      </button>
    </div>
  );
}
