"use client";

import type React from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  MoreHorizontal,
  File,
  Folder,
  FolderOpen,
  Terminal,
  FileText,
  Settings,
  GitBranch,
  Play,
  Square,
  Sun,
  Monitor,
  MessageSquare,
  Code,
  Check,
  Clock,
} from "lucide-react";
import { useState } from "react";

export function OKCodeMockup() {
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
      className="w-full h-full bg-[#0d0d0d] flex overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Left Sidebar - File Tree */}
      <motion.div
        className="w-[240px] h-full bg-[#111111] border-r border-[#1e1e1e] flex flex-col shrink-0"
        variants={panelVariants}
      >
        {/* Project Header */}
        <div className="p-2 border-b border-[#1e1e1e]">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[#e5e5e5] font-medium text-xs uppercase tracking-wider">
              Projects
            </span>
            <div className="flex items-center gap-1">
              <button className="p-1 text-[#666] hover:text-[#999] transition-colors">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 text-[#666] hover:text-[#999] transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Project Selector */}
        <div className="p-2 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1a1a1a] rounded text-[#e5e5e5] text-xs">
            <Code className="w-4 h-4 text-[#4ade80]" />
            <span className="font-medium">psi-claw</span>
            <span className="text-[#666] text-[10px] ml-auto">15m ago</span>
          </div>
        </div>

        {/* Current Task */}
        <div className="p-2 border-b border-[#1e1e1e]">
          <div className="px-2 py-1.5 bg-[#1a1a1a] rounded">
            <div className="text-[#e5e5e5] text-xs font-medium mb-0.5">install deps</div>
          </div>
        </div>

        {/* Files Section */}
        <div className="flex-1 overflow-auto scrollbar-hide">
          <div className="p-2">
            <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#666] uppercase tracking-wider mb-1">
              <span>Files</span>
            </div>
            {/* Search */}
            <div className="px-2 mb-2">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1a1a1a] rounded text-[#666] text-xs">
                <Search className="w-3 h-3" />
                <span>Search files</span>
              </div>
            </div>

            {/* File Tree */}
            <FileTreeFolder name="docs" defaultOpen>
              <FileTreeItem name="psiclaw-system-prompt-v2.md" />
              <FileTreeItem name="psiclaw-training-plan.md" />
            </FileTreeFolder>
            <FileTreeFolder name="public" />
            <FileTreeFolder name="src" defaultOpen>
              <FileTreeFolder name="app" indent={1} />
              <FileTreeFolder name="components" indent={1} defaultOpen>
                <FileTreeFolder name="ui" indent={2}>
                  <FileTreeItem name="app-shell.tsx" indent={3} active />
                </FileTreeFolder>
              </FileTreeFolder>
              <FileTreeFolder name="lib" indent={1} />
            </FileTreeFolder>
            <FileTreeItem name=".gitignore" type="config" />
            <FileTreeItem name="AGENTS.md" type="doc" />
            <FileTreeItem name="CLAUDE.md" type="doc" />
            <FileTreeItem name="components.json" type="config" />
            <FileTreeItem name="eslint.config.mjs" type="config" />
            <FileTreeItem name="LICENSE" type="doc" />
            <FileTreeItem name="next.config.ts" type="config" />
            <FileTreeItem name="package.json" type="config" highlight />
            <FileTreeItem name="pnpm-lock.yaml" type="config" />
            <FileTreeItem name="pnpm-workspace.yaml" type="config" />
            <FileTreeItem name="postcss.config.mjs" type="config" />
            <FileTreeItem name="README.md" type="doc" />
            <FileTreeItem name="tsconfig.json" type="config" />
          </div>
        </div>

        {/* Worktree Section */}
        <div className="border-t border-[#1e1e1e] p-2">
          <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#666] uppercase tracking-wider mb-1">
            <span>Files</span>
          </div>
          <NavItem icon={FileText} label="YouTube" />
          <NavItem icon={GitBranch} label="PR Review" />
          <NavItem icon={MessageSquare} label="Merge Conflicts" />
          <NavItem icon={File} label="File View" />
          <NavItem icon={Settings} label="Settings" />
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#1e1e1e] p-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="p-1.5 bg-[#1a1a1a] rounded text-[#666] hover:text-[#999]">
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 text-[#666] hover:text-[#999]">
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 text-[#666] hover:text-[#999]">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Center Panel - Chat/AI Conversation */}
      <motion.div
        className="flex-1 h-full bg-[#0d0d0d] flex flex-col overflow-hidden"
        variants={panelVariants}
      >
        {/* Header */}
        <div className="px-4 py-2 border-b border-[#1e1e1e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[#e5e5e5] text-sm font-medium">install deps</span>
            <span className="text-[#666] text-xs">psi-claw</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1a] rounded text-[#e5e5e5] text-xs">
              <Play className="w-3 h-3" />
              <span>Dev</span>
              <ChevronDown className="w-3 h-3 text-[#666]" />
            </button>
            <button className="p-1.5 text-[#666] hover:text-[#999]">
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-auto scrollbar-hide p-4">
          {/* Task Title */}
          <motion.div
            className="flex justify-end mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.8 }}
          >
            <div className="bg-[#1a1a1a] rounded-lg px-4 py-2 max-w-[200px]">
              <div className="text-[#e5e5e5] text-sm font-medium">install deps</div>
              <div className="text-[#666] text-[10px] mt-0.5">2:47:33 AM</div>
            </div>
          </motion.div>

          {/* AI Response */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 2.6 }}
            >
              <p className="text-[#b3b3b3] text-sm leading-relaxed">
                {
                  "I'm checking the repo for its package manager and lockfiles first, then I'll install dependencies with the project's intended tool."
                }
              </p>
              <div className="text-[#666] text-[10px] mt-4">2:47:44 AM • 11s</div>
            </motion.div>

            {/* Collapsed Command */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 3.4 }}
            >
              <CollapsedCommand label="Ran command x3" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 4.2 }}
            >
              <p className="text-[#b3b3b3] text-sm leading-relaxed">
                The repo is pinned to <InlineCode>pnpm</InlineCode> via{" "}
                <InlineCode>pnpm-lock.yaml</InlineCode>. {"I'm installing with"}{" "}
                <InlineCode>pnpm install</InlineCode> from the workspace root now.
              </p>
              <div className="text-[#666] text-[10px] mt-4">2:47:46 AM • 2.5s</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 5.0 }}
            >
              <p className="text-[#b3b3b3] text-sm leading-relaxed">
                <InlineCode>pnpm</InlineCode> has started linking packages from the lockfile.{" "}
                {"I'm waiting for it to finish and checking for any postinstall failures."}
              </p>
              <div className="text-[#666] text-[10px] mt-4">2:47:50 AM • 4.1s</div>
            </motion.div>

            {/* Expanded Command */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 5.8 }}
            >
              <div className="bg-[#111111] rounded-lg border border-[#1e1e1e] overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2">
                  <ChevronDown className="w-4 h-4 text-[#666]" />
                  <span className="text-[#b3b3b3] text-xs">
                    {"Ran command - /bin/zsh -lc 'pnpm install'"}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Response Status */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 6.6 }}
            >
              <div className="flex items-center justify-center py-2">
                <div className="px-3 py-1 bg-[#1a1a1a] rounded-full text-[#666] text-[10px] flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  RESPONSE • WORKED FOR 22S
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 7.2 }}
            >
              <p className="text-[#b3b3b3] text-sm leading-relaxed">
                Dependencies are installed with <InlineCode>pnpm</InlineCode>.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 7.8 }}
            >
              <p className="text-[#b3b3b3] text-sm leading-relaxed">
                <InlineCode>pnpm install</InlineCode> completed successfully in{" "}
                <InlineCode>/Users/buns/.okcode/worktrees/psi-claw/okcode-ad7415a3</InlineCode>, and{" "}
                <InlineCode>node_modules</InlineCode> is now populated. One note:{" "}
                <InlineCode>pnpm</InlineCode> ignored the <InlineCode>msw</InlineCode> build script
                under its build-approval policy. If this app depends on <InlineCode>msw</InlineCode>
                {"'s"} postinstall behavior, run <InlineCode>pnpm approve-builds</InlineCode> and
                allow it.
              </p>
              <div className="text-[#666] text-[10px] mt-4">2:47:55 AM • 4.2s</div>
            </motion.div>

            {/* Typing indicator - appears while messages are loading, fades out after last message */}
            <TypingIndicator />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-[#1e1e1e] p-4">
          <div className="bg-[#111111] rounded-lg border border-[#1e1e1e] p-3">
            <div className="text-[#666] text-sm mb-3">
              Ask anything, @tag files/folders, or use / to show available commands
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-2 py-1 text-[#666] text-xs hover:text-[#999]">
                  <Code className="w-3.5 h-3.5" />
                  GPT-5.4
                  <ChevronDown className="w-3 h-3" />
                </button>
                <span className="text-[#333] text-xs">|</span>
                <button className="flex items-center gap-1.5 px-2 py-1 text-[#666] text-xs hover:text-[#999]">
                  High
                  <ChevronDown className="w-3 h-3" />
                </button>
                <span className="text-[#333] text-xs">|</span>
                <button className="flex items-center gap-1.5 px-2 py-1 text-[#666] text-xs hover:text-[#999]">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </button>
                <span className="text-[#333] text-xs">|</span>
                <button className="flex items-center gap-1.5 px-2 py-1 text-[#666] text-xs hover:text-[#999]">
                  <File className="w-3.5 h-3.5" />
                  Full access
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-[#666] hover:text-[#999]">
                  <Plus className="w-4 h-4" />
                </button>
                <motion.button
                  className="p-2 bg-[#4ade80] rounded-full text-[#0d0d0d]"
                  animate={{
                    boxShadow: [
                      "0 0 0px rgba(74,222,128,0.0)",
                      "0 0 12px rgba(74,222,128,0.4)",
                      "0 0 0px rgba(74,222,128,0.0)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronRight className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </div>

          {/* Worktree Status */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-3 h-3 text-[#666]" />
              <span className="text-[#666] text-xs">Worktree</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[#666] text-xs">okcode/install-deps</span>
              <ChevronDown className="w-3 h-3 text-[#666]" />
            </div>
          </div>

          {/* Terminal Line */}
          <div className="mt-2 flex items-center gap-2 text-xs font-mono">
            <span className="text-[#4ade80]">buns@MB-Black</span>
            <span className="text-[#60a5fa]">okcode-ad7415a3</span>
            <span className="text-[#666]">%</span>
            <span className="w-2 h-4 bg-[#e5e5e5] animate-pulse" />
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Documentation Viewer */}
      <motion.div
        className="w-[400px] h-full bg-[#0a0a0a] border-l border-[#1e1e1e] flex flex-col shrink-0"
        variants={panelVariants}
      >
        {/* Tab Bar */}
        <div className="px-2 py-1.5 border-b border-[#1e1e1e] flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <TabButton label="release.md" active />
          <TabButton label="psiclaw-training-pla..." />
          <TabButton label="psiclaw-system-prom..." />
          <div className="ml-auto flex items-center gap-2 text-[#666] text-[10px] shrink-0 px-2">
            <span>Select code + ⌘L to add context</span>
            <button className="p-0.5 hover:text-[#999]">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-auto scrollbar-hide p-6">
          <h1 className="text-[#e5e5e5] text-2xl font-bold mb-4">Release Runbook</h1>
          <p className="text-[#999] text-sm mb-2">
            Canonical release process documentation for the OK Code project.
          </p>
          <p className="text-[#666] text-sm mb-6">
            <span className="font-medium">Last updated:</span> 2026-03-31
          </p>

          {/* Table of Contents */}
          <div className="mb-8">
            <h2 className="text-[#e5e5e5] text-lg font-semibold mb-3">Table of contents</h2>
            <ul className="space-y-1.5">
              <TOCItem label="Overview" />
              <TOCItem label="Prerequisites" />
              <TOCItem label="Version numbering" />
              <TOCItem label="Pre-release checklist" />
              <TOCItem label="Cutting a release" />
              <TOCItem label="What the pipeline does" />
              <TOCItem label="Release assets inventory" />
              <TOCItem label="Post-release verification checklist" />
              <TOCItem label="Hotfix releases" />
              <TOCItem label="Desktop auto-update notes" />
              <TOCItem label="Troubleshooting" />
            </ul>
          </div>

          {/* Overview Section */}
          <div className="mb-6">
            <h2 className="text-[#e5e5e5] text-lg font-semibold mb-3">Overview</h2>
            <p className="text-[#999] text-sm leading-relaxed mb-4">
              A release of OK Code produces:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="text-[#999]">
                <span className="font-semibold text-[#e5e5e5]">Desktop installers</span> for macOS
                (arm64 + x64 DMG), Linux (x64 AppImage), and Windows (x64 NSIS).
              </li>
              <li className="text-[#999]">
                <span className="font-semibold text-[#e5e5e5]">GitHub Release</span> with all
                installer binaries, Electron updater metadata, and documentation attachments.
              </li>
              <li className="text-[#999]">
                <span className="font-semibold text-[#e5e5e5]">Post-release version bump</span>{" "}
                committed to <InlineCode>main</InlineCode> by a GitHub App bot.
              </li>
            </ul>
            <p className="text-[#999] text-sm leading-relaxed mt-4">
              The <InlineCode>okcodes</InlineCode>{" "}
              <span className="font-semibold text-[#e5e5e5]">CLI npm package</span> is{" "}
              <span className="font-semibold">not</span> published by CI; publish it manually when
              needed (see <span className="text-[#60a5fa]">npm publishing (CLI, manual)</span>).
            </p>
            <p className="text-[#999] text-sm leading-relaxed mt-4">
              Releases follow Semantic Versioning and are triggered either by pushing a version tag
              (<InlineCode>v*.*.*</InlineCode>) or by manual workflow dispatch. macOS release builds
              fail closed unless signing and notarization are enabled. Windows signing is used when
              Azure Trusted Signing secrets are configured, and Linux AppImage builds remain
              unsigned.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function FileTreeFolder({
  name,
  children,
  defaultOpen = false,
  indent = 0,
}: {
  name: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  indent?: number;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-0.5 text-[#999] text-xs cursor-pointer hover:bg-[#1a1a1a] rounded"
        style={{ paddingLeft: `${8 + indent * 12}px` }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <>
            <ChevronDown className="w-3 h-3 text-[#666]" />
            <FolderOpen className="w-3.5 h-3.5 text-[#60a5fa]" />
          </>
        ) : (
          <>
            <ChevronRight className="w-3 h-3 text-[#666]" />
            <Folder className="w-3.5 h-3.5 text-[#60a5fa]" />
          </>
        )}
        <span>{name}</span>
      </div>
      {isOpen && children}
    </div>
  );
}

function FileTreeItem({
  name,
  type = "file",
  indent = 0,
  active = false,
  highlight = false,
}: {
  name: string;
  type?: "file" | "config" | "doc";
  indent?: number;
  active?: boolean;
  highlight?: boolean;
}) {
  const iconColor =
    type === "doc" ? "text-[#f59e0b]" : type === "config" ? "text-[#666]" : "text-[#999]";

  const El = active ? motion.div : ("div" as unknown as typeof motion.div);

  return (
    <El
      className={`flex items-center gap-1 px-2 py-0.5 text-xs cursor-pointer rounded ${
        active
          ? "bg-[#1e3a5f] text-[#60a5fa]"
          : highlight
            ? "text-[#ef4444]"
            : "text-[#999] hover:bg-[#1a1a1a]"
      }`}
      style={{ paddingLeft: `${8 + indent * 12}px` }}
      {...(active
        ? {
            animate: {
              backgroundColor: ["rgba(30,58,95,0.5)", "rgba(30,58,95,1)", "rgba(30,58,95,0.5)"],
            },
            transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
          }
        : {})}
    >
      <span className="w-3 h-3" /> {/* Spacer for alignment */}
      <FileText className={`w-3.5 h-3.5 ${iconColor}`} />
      <span>{name}</span>
    </El>
  );
}

function NavItem({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[#666] text-xs cursor-pointer hover:bg-[#1a1a1a] rounded">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

function CollapsedCommand({ label }: { label: string }) {
  return (
    <div className="bg-[#111111] rounded-lg border border-[#1e1e1e] px-3 py-2 flex items-center gap-2">
      <ChevronRight className="w-4 h-4 text-[#666]" />
      <Terminal className="w-4 h-4 text-[#666]" />
      <span className="text-[#b3b3b3] text-xs">{label}</span>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-[#1a1a1a] rounded text-[#4ade80] text-xs font-mono">
      {children}
    </code>
  );
}

function TabButton({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-2 py-1 text-xs rounded shrink-0 ${
        active ? "bg-[#1a1a1a] text-[#e5e5e5]" : "text-[#666] hover:text-[#999]"
      }`}
    >
      {label}
    </button>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      className="flex items-center gap-1.5 py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{
        duration: 8,
        delay: 2.0,
        times: [0, 0.02, 0.95, 1],
      }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

function TOCItem({ label }: { label: string }) {
  return (
    <li>
      <a href="#" className="text-[#60a5fa] text-sm hover:underline">
        {label}
      </a>
    </li>
  );
}
