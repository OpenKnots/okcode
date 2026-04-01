"use client";

import type React from "react";
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  CirclePower,
} from "lucide-react";

export function UIPanelSidebar() {
  return (
    <div className="w-[240px] h-[580px] bg-zinc-900/95 backdrop-blur rounded-xl border border-zinc-800/80 p-3 text-sm shadow-2xl shadow-black/50">
      {/* Top controls */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
          <div className="w-3 h-3 rounded-full bg-zinc-700" />
        </div>
        <div className="flex items-center gap-1 text-zinc-500">
          <ChevronLeft className="w-4 h-4" />
          <RotateCcw className="w-4 h-4" />
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Logo area */}
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <CirclePower className="w-3 h-3 text-white" />
        </div>
        <span className="text-white font-medium">Sprint</span>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-500 ml-auto" />
      </div>

      {/* Main nav */}
      <div className="space-y-0.5">
        <NavItem icon={Inbox} label="Inbox" badge={1} active />
        <NavItem icon={CircleUser} label="My Issues" />
      </div>

      {/* Workspace section */}
      <div className="mt-4">
        <div className="px-2 py-1 text-[11px] text-zinc-500 font-medium flex items-center gap-1">
          Workspace <ChevronDown className="w-3 h-3" />
        </div>
        <div className="space-y-0.5">
          <NavItem icon={Layers} label="Initiatives" hasSubmenu />
          <NavItem icon={FolderKanban} label="Projects" hasSubmenu />
          <NavItem icon={LayoutGrid} label="Views" hasSubmenu />
          <NavItem icon={Users} label="Teams" hasSubmenu />
        </div>
      </div>

      {/* Favorites section */}
      <div className="mt-4">
        <div className="px-2 py-1 text-[11px] text-zinc-500 font-medium flex items-center gap-1">
          Favorites <ChevronDown className="w-3 h-3" />
        </div>
        <div className="space-y-0.5">
          <NavItem icon={Smartphone} label="Mobile App" color="text-blue-400" />
          <NavItem icon={Map} label="3Q24 Roadmap" color="text-orange-400" />
          <NavItem icon={FolderKanban} label="Projects" hasSubmenu />
          <NavItem icon={FileText} label="Docs" hasSubmenu />
        </div>
      </div>

      {/* Your teams section */}
      <div className="mt-4">
        <div className="px-2 py-1 text-[11px] text-zinc-500 font-medium flex items-center gap-1">
          Your teams <ChevronDown className="w-3 h-3" />
        </div>
        <div className="space-y-0.5">
          <NavItem icon={Sparkles} label="Product" hasSubmenu />
          <NavItem icon={CircleUser} label="Issues" hasSubmenu />
        </div>
      </div>
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
        active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300"
      }`}
    >
      <Icon className={`w-4 h-4 ${color || ""}`} />
      <span className="flex-1 text-[13px]">{label}</span>
      {badge && (
        <span className="bg-indigo-500/80 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded font-medium">
          {badge}
        </span>
      )}
      {hasSubmenu && <ChevronRight className="w-3 h-3 text-zinc-600" />}
    </div>
  );
}
