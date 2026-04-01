"use client";

import type React from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  File,
  Folder,
  FolderOpen,
  Terminal,
  FileText,
  Settings,
  GitBranch,
  MessageSquare,
  Code,
  Clock,
  Monitor,
} from "lucide-react";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.25,
      delayChildren: 0.4,
    },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  },
};

export function OKCodeMockup() {
  return (
    <motion.div
      className="flex h-full w-full overflow-hidden bg-[#0a0a0a]"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Sidebar */}
      <motion.div
        className="flex w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0e0e0e]"
        variants={panelVariants}
      >
        {/* Project header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/50">
            Projects
          </span>
          <div className="flex gap-0.5">
            <span className="p-1 text-white/25">
              <Settings className="h-3 w-3" />
            </span>
            <span className="p-1 text-white/25">
              <Plus className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Active project */}
        <div className="border-b border-white/[0.06] p-2">
          <div className="flex items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-1.5">
            <Code className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-white/90">acme-app</span>
            <span className="ml-auto text-[10px] text-white/25">3m</span>
          </div>
        </div>

        {/* Active thread */}
        <div className="border-b border-white/[0.06] p-2">
          <div className="rounded-md bg-white/[0.04] px-2.5 py-1.5">
            <span className="text-xs font-medium text-white/80">refactor auth flow</span>
          </div>
        </div>

        {/* File tree — static, minimal */}
        <div className="flex-1 overflow-hidden p-2">
          <div className="mb-1.5 flex items-center px-2 py-0.5">
            <span className="text-[10px] uppercase tracking-wider text-white/30">Files</span>
          </div>
          <div className="mb-2 px-2">
            <div className="flex items-center gap-1.5 rounded-md bg-white/[0.03] px-2 py-1 text-[11px] text-white/30">
              <Search className="h-3 w-3" />
              <span>Search files</span>
            </div>
          </div>

          <TreeFolder name="src" open>
            <TreeFolder name="components" indent={1} open>
              <TreeFile name="auth-form.tsx" indent={2} active />
              <TreeFile name="dashboard.tsx" indent={2} />
            </TreeFolder>
            <TreeFolder name="lib" indent={1}>
              <TreeFile name="api.ts" indent={2} />
            </TreeFolder>
            <TreeFile name="app.tsx" indent={1} />
          </TreeFolder>
          <TreeFile name="package.json" dim />
          <TreeFile name="tsconfig.json" dim />
        </div>

        {/* Bottom nav */}
        <div className="border-t border-white/[0.06] p-2">
          <SidebarLink icon={GitBranch} label="PR Review" />
          <SidebarLink icon={MessageSquare} label="Merge Conflicts" />
          <SidebarLink icon={File} label="File View" />
          <SidebarLink icon={Settings} label="Settings" />
        </div>

        <div className="flex items-center gap-1.5 border-t border-white/[0.06] px-3 py-2">
          <span className="rounded bg-white/[0.04] p-1 text-white/25">
            <Monitor className="h-3 w-3" />
          </span>
          <span className="p-1 text-white/25">
            <Settings className="h-3 w-3" />
          </span>
        </div>
      </motion.div>

      {/* Center — Chat */}
      <motion.div className="flex flex-1 flex-col overflow-hidden" variants={panelVariants}>
        {/* Thread header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-medium text-white/90">refactor auth flow</span>
            <span className="text-xs text-white/30">acme-app</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-2 py-1 text-xs text-white/60">
            <GitBranch className="h-3 w-3" />
            <span>feat/auth-refactor</span>
          </div>
        </div>

        {/* Chat content — static, no scroll */}
        <div className="flex-1 space-y-5 p-5">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[280px] rounded-2xl rounded-br-md bg-white/[0.06] px-4 py-2.5">
              <p className="text-[13px] leading-relaxed text-white/80">
                Refactor the auth form to use server actions and add proper validation
              </p>
            </div>
          </div>

          {/* Agent response */}
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-white/60">
              {
                "I'll refactor the auth form to use Next.js server actions with Zod validation. Let me start by updating the form component."
              }
            </p>

            <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <ChevronDown className="h-3.5 w-3.5 text-white/30" />
              <Terminal className="h-3.5 w-3.5 text-white/30" />
              <span className="text-[11px] text-white/50">Edited 3 files</span>
              <span className="ml-auto text-[10px] text-emerald-400/60">+47 -23</span>
            </div>

            <p className="text-[13px] leading-relaxed text-white/60">
              Done. The auth form now uses <Mono>useActionState</Mono> with a server action that
              validates input through <Mono>authSchema</Mono>. Error messages render inline per
              field.
            </p>

            <div className="flex items-center justify-center">
              <div className="flex items-center gap-1.5 rounded-full bg-white/[0.03] px-3 py-1 text-[10px] text-white/30">
                <Clock className="h-2.5 w-2.5" />
                RESPONSE &middot; 8S
              </div>
            </div>
          </div>
        </div>

        {/* Input — static */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-2.5 text-[13px] text-white/25">
              Ask anything, @tag files, or / for commands
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Pill>
                  <Code className="h-3 w-3" />
                  Claude
                </Pill>
                <span className="text-white/10">|</span>
                <Pill>
                  <MessageSquare className="h-3 w-3" />
                  Chat
                </Pill>
                <span className="text-white/10">|</span>
                <Pill>
                  <File className="h-3 w-3" />
                  Full access
                </Pill>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="p-1 text-white/20">
                  <Plus className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-white/90 p-1.5 text-[#0a0a0a]">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right — Diff panel */}
      <motion.div
        className="flex w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-[#080808]"
        variants={panelVariants}
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-3 py-1.5">
          <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/80">
            auth-form.tsx
          </span>
          <span className="px-2 py-0.5 text-[11px] text-white/30">api.ts</span>
          <span className="px-2 py-0.5 text-[11px] text-white/30">schema.ts</span>
        </div>

        {/* Diff content — static */}
        <div className="flex-1 overflow-hidden p-4 font-mono text-[11px] leading-[1.7]">
          <DiffLine type="context" num="1">{`"use server";`}</DiffLine>
          <DiffLine type="context" num="2">{``}</DiffLine>
          <DiffLine type="add" num="3">{`import { z } from "zod";`}</DiffLine>
          <DiffLine type="add" num="4">{`import { authSchema } from "./schema";`}</DiffLine>
          <DiffLine type="context" num="5">{``}</DiffLine>
          <DiffLine type="remove" num="6">{`export async function login(data) {`}</DiffLine>
          <DiffLine type="add" num="6">{`export async function login(`}</DiffLine>
          <DiffLine type="add" num="7">{`  _prev: unknown,`}</DiffLine>
          <DiffLine type="add" num="8">{`  formData: FormData`}</DiffLine>
          <DiffLine type="add" num="9">{`) {`}</DiffLine>
          <DiffLine type="add" num="10">{`  const parsed = authSchema.safeParse({`}</DiffLine>
          <DiffLine type="add" num="11">{`    email: formData.get("email"),`}</DiffLine>
          <DiffLine type="add" num="12">{`    password: formData.get("pass"),`}</DiffLine>
          <DiffLine type="add" num="13">{`  });`}</DiffLine>
          <DiffLine type="context" num="14">{``}</DiffLine>
          <DiffLine type="add" num="15">{`  if (!parsed.success) {`}</DiffLine>
          <DiffLine
            type="add"
            num="16"
          >{`    return { errors: parsed.error.flatten() };`}</DiffLine>
          <DiffLine type="add" num="17">{`  }`}</DiffLine>
        </div>

        {/* Diff footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-emerald-400/70">+47</span>
            <span className="text-red-400/70">-23</span>
            <span className="text-white/25">3 files</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-white/[0.08] px-2.5 py-1 text-[11px] text-white/50">
              Reject
            </span>
            <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-[11px] text-emerald-400">
              Accept
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* Helper components — purely presentational, no state */

function TreeFolder({
  name,
  children,
  indent = 0,
  open = false,
}: {
  name: string;
  children?: React.ReactNode;
  indent?: number;
  open?: boolean;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1 rounded px-2 py-px text-[11px] text-white/50"
        style={{ paddingLeft: `${8 + indent * 14}px` }}
      >
        {open ? (
          <>
            <ChevronDown className="h-2.5 w-2.5 text-white/20" />
            <FolderOpen className="h-3 w-3 text-blue-400/60" />
          </>
        ) : (
          <>
            <ChevronRight className="h-2.5 w-2.5 text-white/20" />
            <Folder className="h-3 w-3 text-blue-400/60" />
          </>
        )}
        <span>{name}</span>
      </div>
      {open && children}
    </div>
  );
}

function TreeFile({
  name,
  indent = 0,
  active = false,
  dim = false,
}: {
  name: string;
  indent?: number;
  active?: boolean;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 rounded px-2 py-px text-[11px] ${
        active ? "bg-blue-500/10 text-blue-400/80" : dim ? "text-white/25" : "text-white/45"
      }`}
      style={{ paddingLeft: `${22 + indent * 14}px` }}
    >
      <FileText className={`h-3 w-3 ${active ? "text-blue-400/60" : "text-white/20"}`} />
      <span>{name}</span>
    </div>
  );
}

function SidebarLink({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded px-2 py-1 text-[11px] text-white/30">
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-white/30">
      {children}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[12px] text-emerald-400/80">
      {children}
    </code>
  );
}

function DiffLine({
  type,
  num,
  children,
}: {
  type: "add" | "remove" | "context";
  num: string;
  children: React.ReactNode;
}) {
  const colors = {
    add: "bg-emerald-500/[0.06] text-emerald-300/70",
    remove: "bg-red-500/[0.06] text-red-300/60 line-through",
    context: "text-white/30",
  };
  const prefix = { add: "+", remove: "-", context: " " };

  return (
    <div className={`flex ${colors[type]} -mx-4 px-4`}>
      <span className="w-7 shrink-0 select-none text-right text-white/15">{num}</span>
      <span className="mx-2 w-3 shrink-0 select-none text-center">{prefix[type]}</span>
      <span className="whitespace-pre">{children}</span>
    </div>
  );
}
