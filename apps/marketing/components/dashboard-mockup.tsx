"use client";

import type React from "react";
import { motion } from "framer-motion";
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
  CirclePower,
  Search,
  Plus,
  Link2,
  MoreHorizontal,
  Sparkles,
  Settings,
  HelpCircle,
} from "lucide-react";

export function DashboardMockup() {
  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.3,
        delayChildren: 0.5,
      },
    },
  };

  const panelVariants = {
    hidden: {
      opacity: 0,
      x: 100,
      y: -80,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration: 1.2,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

  return (
    <motion.div
      className="w-full h-full bg-background flex overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Sidebar - Use semantic tokens */}
      <motion.div
        className="w-[220px] h-full bg-card/80 border-r border-border/50 flex flex-col shrink-0"
        variants={panelVariants}
      >
        {/* Logo */}
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <CirclePower className="w-5 h-5 text-foreground" />
            <span className="text-foreground font-semibold text-sm">Sprint</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
          </div>
        </div>

        {/* Search - Use semantic tokens */}
        <div className="p-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-secondary/50 rounded-md text-muted-foreground text-xs">
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <span className="ml-auto text-[10px] bg-muted/50 px-1.5 py-0.5 rounded">⌘K</span>
          </div>
        </div>

        {/* Main nav */}
        <div className="px-3 space-y-0.5">
          <NavItem icon={Inbox} label="Inbox" badge={3} active />
          <NavItem icon={CircleUser} label="My Issues" />
        </div>

        {/* Workspace section - Use semantic tokens */}
        <div className="mt-5 px-3">
          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
            Workspace
          </div>
          <div className="space-y-0.5 mt-1">
            <NavItem icon={Layers} label="Initiatives" hasSubmenu />
            <NavItem icon={FolderKanban} label="Projects" hasSubmenu />
            <NavItem icon={LayoutGrid} label="Views" hasSubmenu />
            <NavItem icon={Users} label="Teams" hasSubmenu />
          </div>
        </div>

        {/* Favorites section - Use semantic tokens */}
        <div className="mt-5 px-3">
          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
            Favorites
          </div>
          <div className="space-y-0.5 mt-1">
            <NavItem icon={Smartphone} label="Mobile App" color="text-favorite-blue" />
            <NavItem icon={Map} label="Q1 Roadmap" color="text-accent-workflows" />
            <NavItem icon={FileText} label="API Docs" color="text-status-success" />
          </div>
        </div>

        {/* Teams section */}
        <div className="mt-5 px-3 flex-1">
          <div className="px-2 py-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
            Your Teams
          </div>
          <div className="space-y-0.5 mt-1">
            <NavItem icon={Sparkles} label="Product" hasSubmenu />
            <NavItem icon={Settings} label="Engineering" hasSubmenu />
          </div>
        </div>

        {/* Bottom - Use semantic tokens */}
        <div className="p-3 border-t border-border/50">
          <NavItem icon={HelpCircle} label="Help & Support" />
        </div>
      </motion.div>

      {/* Inbox List - Use semantic tokens */}
      <motion.div
        className="w-[320px] h-full bg-card/40 border-r border-border/50 flex flex-col shrink-0"
        variants={panelVariants}
      >
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-foreground font-semibold text-sm">Inbox</h3>
          <div className="flex items-center gap-2">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-hide">
          <InboxItem
            id="ENG-135"
            title="Refactor sonic crawler"
            subtitle="nan assigned you"
            time="2h"
            avatar="https://i.pravatar.cc/32?img=1"
            status="in-progress"
            active
          />
          <InboxItem
            id="LLM"
            title="LLM Chatbot"
            subtitle="New project update by raissa"
            time="1d"
            avatar="https://i.pravatar.cc/32?img=2"
            status="todo"
            isProject
          />
          <InboxItem
            id="ENG-159"
            title="Error uploading images via API"
            subtitle="SLA breached"
            time="2d"
            avatar="https://i.pravatar.cc/32?img=3"
            status="bug"
          />
          <InboxItem
            id="DES-498"
            title="Redesign users settings..."
            subtitle="karri mentioned you"
            time="4h"
            avatar="https://i.pravatar.cc/32?img=4"
            status="todo"
          />
          <InboxItem
            id="ENG-160"
            title="Holtzmann engine is broken"
            subtitle="You asked to be reminded"
            time="1w"
            avatar="https://i.pravatar.cc/32?img=5"
            status="bug"
          />
          <InboxItem
            title="Sign up flow experiments"
            subtitle="Added as project member"
            avatar="https://i.pravatar.cc/32?img=6"
            status="done"
            isProject
          />
          <InboxItem
            id="MKT-122"
            title="Design assets for marketing"
            subtitle="erin marked as Duplicate"
            time="1w"
            avatar="https://i.pravatar.cc/32?img=7"
            status="done"
          />
          <InboxItem
            title="Homepage v3"
            subtitle="New project update by paco"
            avatar="https://i.pravatar.cc/32?img=8"
            status="todo"
            isProject
          />
        </div>
      </motion.div>

      {/* Detail Panel - Use semantic tokens */}
      <motion.div
        className="flex-1 h-full bg-background flex flex-col overflow-hidden"
        variants={panelVariants}
      >
        {/* Header breadcrumb */}
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Engineering</span>
            <span className="text-muted-foreground/50">›</span>
            <span className="text-status-success">Spice harvester</span>
            <span className="text-muted-foreground/50">›</span>
            <span className="text-secondary-foreground">ENG-135</span>
          </div>
          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-auto scrollbar-hide">
          <h2 className="text-foreground text-xl font-semibold mb-5">Refactor sonic crawler</h2>

          {/* Code block - Use semantic tokens for code syntax */}
          <div className="bg-card/80 rounded-lg p-4 text-[11px] font-mono mb-5 border border-border/50">
            <div className="space-y-2">
              <div>
                <span className="text-muted-foreground">Comment.</span>
                <span className="text-code-variable">documentContent</span>
                <span className="text-muted-foreground"> is defined wrongly. It should be a </span>
                <span className="text-code-type">LazyManyToOne</span>
                <span className="text-muted-foreground"> relation.</span>
              </div>
              <div className="mt-3 text-muted-foreground/50">
                {/* The document content that this comment is associated with. */}
              </div>
              <div>
                <span className="text-code-keyword">@ManyToOne</span>
                <span className="text-muted-foreground">(</span>
                <span className="text-code-type">DocumentContent</span>
                <span className="text-muted-foreground">,</span>
                <span className="text-code-variable">comments</span>
                <span className="text-muted-foreground">,</span>
                <span className="text-code-variable">cascade</span>
                <span className="text-muted-foreground">:</span>
                <span className="text-code-constant">true</span>
                <span className="text-muted-foreground">,</span>
                <span className="text-code-variable">nullable</span>
                <span className="text-muted-foreground">:</span>
                <span className="text-code-constant">false</span>
                <span className="text-muted-foreground">)</span>
              </div>
              <div>
                <span className="text-favorite-blue">public </span>
                <span className="text-code-variable">documentContent</span>
                <span className="text-muted-foreground">?: </span>
                <span className="text-code-type">DocumentContent</span>
                <span className="text-muted-foreground">;</span>
              </div>
              <div className="mt-3 text-muted-foreground">
                We would be accessing
                <span className="text-status-success">CachedPromise&lt;DocumentContent&gt;</span>
                then, and document content would be hydrated.
              </div>
            </div>
          </div>

          {/* Meta actions - Use semantic tokens */}
          <div className="space-y-2 text-sm mb-5">
            <div className="flex items-center gap-2 text-muted-foreground hover:text-secondary-foreground cursor-pointer transition-colors">
              <Plus className="w-4 h-4" />
              <span>Add sub-issues</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground hover:text-secondary-foreground cursor-pointer transition-colors">
              <Link2 className="w-4 h-4" />
              <span>Links</span>
            </div>
          </div>

          {/* PR reference - Use semantic tokens */}
          <div className="text-xs text-muted-foreground mb-5">
            <span className="text-muted-foreground/50">#20319</span>
            <span> igor/eng-135 add source to insights slice and segment</span>
          </div>

          {/* Activity - Use semantic tokens */}
          <div className="pt-4 border-t border-border/50">
            <div className="text-xs text-muted-foreground font-medium mb-3 uppercase tracking-wider">
              Activity
            </div>
            <div className="space-y-3">
              <ActivityItem
                avatar="https://i.pravatar.cc/24?img=1"
                name="nan"
                action="moved from"
                from="Backlog"
                to="In Progress"
                time="5 months ago"
              />
              <ActivityItem
                avatar="https://i.pravatar.cc/24?img=2"
                name="alex"
                action="commented on"
                from="this issue"
                time="5 months ago"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function NavItem({
  icon: Icon,
  label,
  badge,
  active,
  hasSubmenu,
  color,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  active?: boolean;
  hasSubmenu?: boolean;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
      }`}
    >
      <Icon className={`w-4 h-4 ${color || ""}`} />
      <span className="flex-1 text-xs">{label}</span>
      {badge && (
        <span className="bg-brand/80 text-brand-foreground text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full font-medium px-1">
          {badge}
        </span>
      )}
      {hasSubmenu && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
    </div>
  );
}

function InboxItem({
  id,
  title,
  subtitle,
  time,
  avatar,
  status,
  isProject,
  active,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  time?: string;
  avatar: string;
  status: string;
  isProject?: boolean;
  active?: boolean;
}) {
  const statusColors: Record<string, string> = {
    "in-progress": "bg-status-progress",
    todo: "bg-muted-foreground",
    bug: "bg-status-error",
    done: "bg-status-success",
  };

  return (
    <div
      className={`px-4 py-3 border-b border-border/30 cursor-pointer transition-colors ${
        active ? "bg-secondary/50" : "hover:bg-secondary/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <img
          src={avatar || "/placeholder.svg"}
          alt=""
          className="w-8 h-8 rounded-full shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {id && <span className="text-muted-foreground text-[10px]">{id}</span>}
            {isProject && <span className="text-favorite-purple text-[10px]">Project</span>}
            <div
              className={`w-2 h-2 rounded-full ${statusColors[status] || "bg-muted-foreground"}`}
            />
          </div>
          <p className="text-foreground text-xs truncate leading-tight">{title}</p>
          {subtitle && (
            <p className="text-muted-foreground text-[10px] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {time && <span className="text-muted-foreground/50 text-[10px] shrink-0">{time}</span>}
      </div>
    </div>
  );
}

function ActivityItem({
  avatar,
  name,
  action,
  from,
  to,
  time,
}: {
  avatar: string;
  name: string;
  action: string;
  from: string;
  to?: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <img src={avatar || "/placeholder.svg"} alt="" className="w-5 h-5 rounded-full" />
      <div className="flex-1">
        <p className="text-muted-foreground text-xs">
          <span className="text-foreground">{name}</span>
          <span className="text-muted-foreground"> {action} </span>
          <span className="text-secondary-foreground">{from}</span>
          {to && (
            <>
              <span className="text-muted-foreground"> to </span>
              <span className="text-secondary-foreground">{to}</span>
            </>
          )}
        </p>
        <p className="text-muted-foreground/50 text-[10px] mt-0.5">{time}</p>
      </div>
    </div>
  );
}
