"use client";

import type React from "react";
import Link from "next/link";

import {
  Inbox,
  CircleUser,
  Layers,
  FolderKanban,
  LayoutGrid,
  Users,
  Smartphone,
  Map,
  FileText,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Search,
  Plus,
  Settings,
  Bell,
  CirclePower,
  PanelLeftClose,
  PanelLeft,
  Command,
  Home,
  X,
} from "lucide-react";

interface DashboardSidebarProps {
  activeView: string;
  onViewChange: (view: "inbox" | "my-issues" | "projects" | "views") => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
  onClose: () => void;
  onCreateIssue: () => void;
}

export function DashboardSidebar({
  activeView,
  onViewChange,
  collapsed,
  onToggleCollapse,
  isMobile,
  onClose,
  onCreateIssue,
}: DashboardSidebarProps) {
  if (collapsed && !isMobile) {
    return (
      <div className="w-16 h-full bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapse}
          className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <Link
          href="/"
          className="w-8 h-8 rounded bg-gradient-to-br from-brand to-highlight flex items-center justify-center mt-2 hover:opacity-90 transition-opacity"
        >
          <CirclePower className="w-4 h-4 text-brand-foreground" />
        </Link>

        <div className="flex-1 flex flex-col items-center gap-1 mt-4">
          <NavIconButton
            icon={Inbox}
            active={activeView === "inbox"}
            onClick={() => onViewChange("inbox")}
            label="Inbox"
          />
          <NavIconButton
            icon={CircleUser}
            active={activeView === "my-issues"}
            onClick={() => onViewChange("my-issues")}
            label="My Issues"
          />
          <NavIconButton
            icon={FolderKanban}
            active={activeView === "projects"}
            onClick={() => onViewChange("projects")}
            label="Projects"
          />
          <NavIconButton
            icon={LayoutGrid}
            active={activeView === "views"}
            onClick={() => onViewChange("views")}
            label="Views"
          />
        </div>

        <button
          onClick={onCreateIssue}
          className="w-10 h-10 flex items-center justify-center text-brand-foreground bg-brand hover:bg-brand/90 rounded-lg transition-colors mb-2"
          aria-label="New issue"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center gap-1">
          <Link
            href="/"
            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            aria-label="Back to website"
          >
            <Home className="w-5 h-5" />
          </Link>
          <NavIconButton icon={Settings} label="Settings" />
          <NavIconButton icon={Bell} label="Notifications" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${isMobile ? "w-full" : "w-60"} h-full bg-sidebar border-r border-sidebar-border flex flex-col text-sm`}
    >
      {/* Header */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-brand to-highlight flex items-center justify-center">
              <CirclePower className="w-3.5 h-3.5 text-brand-foreground" />
            </div>
            <span className="text-foreground font-medium">Sprint</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </Link>
          {isMobile ? (
            <button
              onClick={onClose}
              className="w-10 h-10 -mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onToggleCollapse}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded transition-colors"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <button className="w-full flex items-center gap-2 px-2.5 py-2.5 md:py-1.5 bg-sidebar-accent border border-sidebar-border rounded-lg text-muted-foreground hover:border-ring transition-colors">
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left text-[13px]">Search...</span>
          {!isMobile && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          )}
        </button>
      </div>

      {/* Main nav */}
      <div className="px-2 space-y-0.5">
        <NavItem
          icon={Inbox}
          label="Inbox"
          badge={3}
          active={activeView === "inbox"}
          onClick={() => onViewChange("inbox")}
          isMobile={isMobile}
        />
        <NavItem
          icon={CircleUser}
          label="My Issues"
          active={activeView === "my-issues"}
          onClick={() => onViewChange("my-issues")}
          isMobile={isMobile}
        />
      </div>

      {/* Workspace section */}
      <div className="mt-4 px-2">
        <SectionHeader label="Workspace" />
        <div className="space-y-0.5">
          <NavItem icon={Layers} label="Initiatives" hasSubmenu isMobile={isMobile} />
          <NavItem
            icon={FolderKanban}
            label="Projects"
            hasSubmenu
            active={activeView === "projects"}
            onClick={() => onViewChange("projects")}
            isMobile={isMobile}
          />
          <NavItem
            icon={LayoutGrid}
            label="Views"
            hasSubmenu
            active={activeView === "views"}
            onClick={() => onViewChange("views")}
            isMobile={isMobile}
          />
          <NavItem icon={Users} label="Teams" hasSubmenu isMobile={isMobile} />
        </div>
      </div>

      {/* Favorites section */}
      <div className="mt-4 px-2">
        <SectionHeader label="Favorites" />
        <div className="space-y-0.5">
          <NavItem icon={Smartphone} label="Mobile App" color="text-chart-1" isMobile={isMobile} />
          <NavItem
            icon={Map}
            label="Q1 2026 Roadmap"
            color="text-status-warning"
            isMobile={isMobile}
          />
          <NavItem icon={FileText} label="Docs" hasSubmenu isMobile={isMobile} />
        </div>
      </div>

      {/* Your teams section */}
      <div className="mt-4 px-2">
        <SectionHeader label="Your teams" />
        <div className="space-y-0.5">
          <NavItem
            icon={Sparkles}
            label="Product"
            hasSubmenu
            teamColor="bg-chart-4"
            isMobile={isMobile}
          />
          <NavItem
            icon={CircleUser}
            label="Engineering"
            hasSubmenu
            teamColor="bg-status-success"
            isMobile={isMobile}
          />
          <NavItem
            icon={Layers}
            label="Design"
            hasSubmenu
            teamColor="bg-status-warning"
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="p-3 border-t border-sidebar-border">
        <Link
          href="/"
          className="w-full flex items-center gap-2 px-2 py-2.5 md:py-1.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors mb-1"
        >
          <Home className="w-4 h-4" />
          <span className="text-[13px]">Back to Website</span>
        </Link>
        <button
          onClick={onCreateIssue}
          className="w-full flex items-center gap-2 px-2 py-2.5 md:py-1.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[13px]">New issue</span>
          {!isMobile && (
            <div className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
              <span>C</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-2 py-1 text-[11px] text-muted-foreground font-medium flex items-center justify-between group cursor-pointer">
      <div className="flex items-center gap-1">
        {label}
        <ChevronDown className="w-3 h-3" />
      </div>
      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  badge,
  active,
  hasSubmenu,
  color,
  teamColor,
  onClick,
  isMobile: _isMobile,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  active?: boolean;
  hasSubmenu?: boolean;
  color?: string;
  teamColor?: string;
  onClick?: () => void;
  isMobile?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-2.5 md:py-1.5 rounded-md cursor-pointer transition-colors ${
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      }`}
    >
      {teamColor ? (
        <div className={`w-4 h-4 rounded ${teamColor} flex items-center justify-center`}>
          <Icon className="w-2.5 h-2.5 text-primary-foreground" />
        </div>
      ) : (
        <Icon className={`w-4 h-4 ${color || ""}`} />
      )}
      <span className="flex-1 text-left text-[13px]">{label}</span>
      {badge && (
        <span className="bg-brand text-brand-foreground text-[10px] min-w-4 h-4 flex items-center justify-center rounded font-medium px-1">
          {badge}
        </span>
      )}
      {hasSubmenu && <ChevronRight className="w-3 h-3 text-muted-foreground/60" />}
    </button>
  );
}

function NavIconButton({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
        active
          ? "bg-sidebar-accent text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
      }`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
