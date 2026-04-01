"use client";

import { Menu, Plus, Search, Bell } from "lucide-react";
import { OkCodeMark } from "../OkCodeLogo";

interface DashboardMobileHeaderProps {
  onMenuToggle: () => void;
  activeView: string;
  onCreateIssue: () => void;
}

export function DashboardMobileHeader({
  onMenuToggle,
  activeView,
  onCreateIssue,
}: DashboardMobileHeaderProps) {
  const viewTitle =
    {
      inbox: "Inbox",
      "my-issues": "My Issues",
      projects: "Projects",
      views: "Views",
    }[activeView] || "Inbox";

  return (
    <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 shrink-0">
      {/* Left side - menu and logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="w-10 h-10 flex items-center justify-center text-foreground hover:bg-sidebar-accent rounded-lg transition-colors -ml-2"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <OkCodeMark className="w-5 h-5 text-foreground" />
          <span className="text-foreground font-medium">{viewTitle}</span>
        </div>
      </div>

      {/* Right side - actions */}
      <div className="flex items-center gap-1">
        <button
          className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
        </button>
        <button
          onClick={onCreateIssue}
          className="w-10 h-10 flex items-center justify-center text-brand-foreground bg-brand hover:bg-brand/90 rounded-lg transition-colors"
          aria-label="New issue"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
