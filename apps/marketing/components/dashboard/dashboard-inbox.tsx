"use client";

import { useState } from "react";
import { Filter, SortAsc, MoreHorizontal, Check, Plus } from "lucide-react";
import type { Issue } from "./types";

interface DashboardInboxProps {
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue) => void;
  activeView: string;
  isMobile?: boolean;
  onCreateIssue: () => void;
}

export function DashboardInbox({
  issues,
  selectedIssue,
  onSelectIssue,
  activeView,
  isMobile,
  onCreateIssue,
}: DashboardInboxProps) {
  const [filter, setFilter] = useState<"all" | "unread" | "assigned">("all");

  const viewTitle =
    {
      inbox: "Inbox",
      "my-issues": "My Issues",
      projects: "Projects",
      views: "Views",
    }[activeView] || "Inbox";

  return (
    <div className="w-full h-full bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header - hidden on mobile since we have mobile header */}
      {!isMobile && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-foreground font-medium text-[15px]">{viewTitle}</h2>
            <div className="flex items-center gap-1">
              {/* Create button */}
              <button
                onClick={onCreateIssue}
                className="w-7 h-7 flex items-center justify-center text-brand bg-brand/10 hover:bg-brand/20 rounded transition-colors"
                aria-label="Create issue"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded transition-colors"
                aria-label="Filter"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded transition-colors"
                aria-label="Sort"
              >
                <SortAsc className="w-4 h-4" />
              </button>
              <button
                className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded transition-colors"
                aria-label="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            <FilterTab label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterTab
              label="Unread"
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
              count={3}
            />
            <FilterTab
              label="Assigned"
              active={filter === "assigned"}
              onClick={() => setFilter("assigned")}
            />
          </div>
        </div>
      )}

      {isMobile && (
        <div className="px-4 py-2 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto">
            <FilterTab label="All" active={filter === "all"} onClick={() => setFilter("all")} />
            <FilterTab
              label="Unread"
              active={filter === "unread"}
              onClick={() => setFilter("unread")}
              count={3}
            />
            <FilterTab
              label="Assigned"
              active={filter === "assigned"}
              onClick={() => setFilter("assigned")}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
              aria-label="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
              aria-label="Sort"
            >
              <SortAsc className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm mb-4">No issues yet</p>
            <button
              onClick={onCreateIssue}
              className="px-4 py-2 bg-brand hover:bg-brand/90 text-brand-foreground text-sm font-medium rounded-lg transition-colors"
            >
              Create your first issue
            </button>
          </div>
        ) : (
          issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              selected={!isMobile && selectedIssue?.id === issue.id}
              onClick={() => onSelectIssue(issue)}
              isMobile={isMobile}
            />
          ))
        )}
      </div>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 rounded-md text-[12px] transition-colors flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
      }`}
    >
      {label}
      {count && (
        <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </button>
  );
}

function IssueRow({
  issue,
  selected,
  onClick,
  isMobile,
}: {
  issue: Issue;
  selected: boolean;
  onClick: () => void;
  isMobile?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 md:py-3 cursor-pointer transition-colors border-l-2 ${
        selected
          ? "bg-sidebar-accent border-l-brand"
          : "border-l-transparent hover:bg-sidebar-accent/50 active:bg-sidebar-accent"
      }`}
    >
      <div className="flex items-start gap-3">
        <img
          src={issue.assignee.avatar || "/placeholder.svg"}
          alt={issue.assignee.name}
          className="w-9 h-9 md:w-8 md:h-8 rounded-full shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-muted-foreground text-[11px]">{issue.id}</span>
            {issue.isProject && (
              <span className="text-label-project text-[11px] font-medium">Project</span>
            )}
            <StatusDot status={issue.status} />
            {issue.priority === "urgent" && (
              <span className="text-status-error text-[10px]">Urgent</span>
            )}
          </div>
          <p className="text-foreground text-[13px] truncate leading-tight font-medium">
            {issue.title}
          </p>
          {issue.subtitle ? (
            <p className="text-muted-foreground text-[11px] mt-0.5 truncate">{issue.subtitle}</p>
          ) : (
            <p className="text-muted-foreground text-[11px] mt-0.5">
              {issue.assignee.name} assigned you
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-muted-foreground/60 text-[11px]">{issue.time}</span>
          {issue.status === "done" && <Check className="w-3.5 h-3.5 text-status-success" />}
        </div>
      </div>
    </button>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "in-progress": "bg-status-progress",
    todo: "bg-muted-foreground/50",
    bug: "bg-status-error",
    done: "bg-status-success",
  };

  return <div className={`w-2 h-2 rounded-full ${colors[status] || "bg-muted-foreground"}`} />;
}
