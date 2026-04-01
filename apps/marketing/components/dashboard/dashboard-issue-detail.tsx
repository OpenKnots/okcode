"use client";

import type React from "react";

import { useState } from "react";
import {
  MoreHorizontal,
  Plus,
  Link2,
  Copy,
  ExternalLink,
  User,
  Calendar,
  Flag,
  Tag,
  GitBranch,
  MessageSquare,
  Paperclip,
  ChevronDown,
  X,
  Check,
  Circle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Share,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Issue, IssueLink, IssueAttachment } from "./types";
import { STATUSES, PRIORITIES, TEAM_MEMBERS } from "./types";
import { LinkModal, AttachmentModal, getLinkIcon, getFileIcon } from "./link-attachment-modal";

interface DashboardIssueDetailProps {
  issue: Issue;
  onClose: () => void;
  isMobile?: boolean;
  onEdit: () => void;
  onQuickUpdate: (updates: Partial<Issue>) => void;
}

export function DashboardIssueDetail({
  issue,
  onClose,
  isMobile,
  onEdit,
  onQuickUpdate,
}: DashboardIssueDetailProps) {
  const [comment, setComment] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<IssueLink | null>(null);

  const handleAddLink = (link: IssueLink) => {
    const currentLinks = issue.links || [];
    const existingIndex = currentLinks.findIndex((l) => l.id === link.id);

    if (existingIndex >= 0) {
      const updatedLinks = [...currentLinks];
      updatedLinks[existingIndex] = link;
      onQuickUpdate({ links: updatedLinks });
    } else {
      onQuickUpdate({ links: [...currentLinks, link] });
    }
    setEditingLink(null);
  };

  const handleRemoveLink = (linkId: string) => {
    const currentLinks = issue.links || [];
    onQuickUpdate({ links: currentLinks.filter((l) => l.id !== linkId) });
  };

  const handleAddAttachment = (attachment: IssueAttachment) => {
    const currentAttachments = issue.attachments || [];
    onQuickUpdate({ attachments: [...currentAttachments, attachment] });
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    const currentAttachments = issue.attachments || [];
    onQuickUpdate({ attachments: currentAttachments.filter((a) => a.id !== attachmentId) });
  };

  return (
    <div className="h-full flex flex-col bg-surface/50">
      {isMobile ? (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-sidebar">
          <button
            onClick={onClose}
            className="w-10 h-10 -ml-2 flex items-center justify-center text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
            aria-label="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-foreground font-medium text-[15px]">{issue.id}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
              aria-label="Edit issue"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
              aria-label="Share"
            >
              <Share className="w-5 h-5" />
            </button>
            <button
              className="w-10 h-10 -mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        /* Desktop header breadcrumb */
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-muted-foreground">{issue.team}</span>
            <span className="text-muted-foreground/60">›</span>
            <span className="text-status-success">{issue.project}</span>
            <span className="text-muted-foreground/60">›</span>
            <span className="text-foreground/80">{issue.id}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              aria-label="Edit issue"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              aria-label="Copy link"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              aria-label="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors ml-2"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6">
          {isMobile && (
            <div className="flex items-center gap-1.5 text-[12px] mb-3">
              <span className="text-muted-foreground">{issue.team}</span>
              <span className="text-muted-foreground/60">›</span>
              <span className="text-status-success">{issue.project}</span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-foreground text-xl md:text-2xl font-semibold mb-6">{issue.title}</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <PropertyRow
              icon={StatusIcon}
              label="Status"
              value={
                <InlineDropdown
                  isOpen={activeDropdown === "status"}
                  onToggle={() => setActiveDropdown(activeDropdown === "status" ? null : "status")}
                  trigger={<StatusBadge status={issue.status} />}
                >
                  {STATUSES.map((s) => (
                    <DropdownOption
                      key={s.value}
                      label={s.label}
                      selected={issue.status === s.value}
                      onClick={() => {
                        onQuickUpdate({ status: s.value });
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </InlineDropdown>
              }
            />
            <PropertyRow
              icon={Flag}
              label="Priority"
              value={
                <InlineDropdown
                  isOpen={activeDropdown === "priority"}
                  onToggle={() =>
                    setActiveDropdown(activeDropdown === "priority" ? null : "priority")
                  }
                  trigger={<PriorityBadge priority={issue.priority} />}
                >
                  {PRIORITIES.map((p) => (
                    <DropdownOption
                      key={p.value}
                      label={p.label}
                      selected={issue.priority === p.value}
                      onClick={() => {
                        onQuickUpdate({ priority: p.value });
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </InlineDropdown>
              }
            />
            <PropertyRow
              icon={User}
              label="Assignee"
              value={
                <InlineDropdown
                  isOpen={activeDropdown === "assignee"}
                  onToggle={() =>
                    setActiveDropdown(activeDropdown === "assignee" ? null : "assignee")
                  }
                  trigger={
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5">
                      <img
                        src={issue.assignee.avatar || "/placeholder.svg"}
                        alt={issue.assignee.name}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-foreground/80 text-sm">{issue.assignee.name}</span>
                    </div>
                  }
                >
                  {TEAM_MEMBERS.map((member) => (
                    <DropdownOption
                      key={member.name}
                      label={
                        <div className="flex items-center gap-2">
                          <img
                            src={member.avatar || "/placeholder.svg"}
                            alt={member.name}
                            className="w-5 h-5 rounded-full"
                          />
                          <span>{member.name}</span>
                        </div>
                      }
                      selected={issue.assignee.name === member.name}
                      onClick={() => {
                        onQuickUpdate({ assignee: member });
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </InlineDropdown>
              }
            />
            <PropertyRow
              icon={Calendar}
              label="Due date"
              value={<span className="text-muted-foreground text-sm">Not set</span>}
            />
            <PropertyRow
              icon={Tag}
              label="Labels"
              value={
                <div className="flex items-center gap-1.5 flex-wrap">
                  {issue.labels.map((label) => (
                    <span
                      key={label}
                      className="bg-accent text-accent-foreground text-[11px] px-2 py-0.5 rounded"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              }
            />
            <PropertyRow
              icon={GitBranch}
              label="Branch"
              value={
                <span className="text-chart-1 text-sm font-mono truncate">
                  {issue.id.toLowerCase()}-
                  {issue.title.toLowerCase().replace(/\s+/g, "-").slice(0, 20)}
                </span>
              }
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-muted-foreground text-sm font-medium mb-2">Description</h3>
            <div className="bg-accent/30 rounded-lg p-4 text-foreground/80 text-sm leading-relaxed border border-border">
              {issue.description}
            </div>
          </div>

          {/* Code block for engineering issues */}
          {issue.team === "Engineering" && (
            <div className="mb-6 overflow-x-auto">
              <div className="bg-background rounded-lg p-4 text-[11px] font-mono border border-border space-y-2 min-w-max">
                <div>
                  <span className="text-muted-foreground">{"// "}</span>
                  <span className="text-muted-foreground">{"Related code context"}</span>
                </div>
                <div>
                  <span className="text-syntax-function">{"@ManyToOne"}</span>
                  <span className="text-muted-foreground">{"(() => "}</span>
                  <span className="text-syntax-string">{"DocumentContent"}</span>
                  <span className="text-muted-foreground">{", { "}</span>
                  <span className="text-syntax-variable">{"cascade"}</span>
                  <span className="text-muted-foreground">{": "}</span>
                  <span className="text-status-warning-foreground">{"true"}</span>
                  <span className="text-muted-foreground">{" })"}</span>
                </div>
                <div>
                  <span className="text-syntax-keyword">{"public "}</span>
                  <span className="text-syntax-variable">{"documentContent"}</span>
                  <span className="text-muted-foreground">{"?: "}</span>
                  <span className="text-syntax-string">{"DocumentContent"}</span>
                  <span className="text-muted-foreground">{";"}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-muted-foreground text-sm font-medium">Links</h3>
              <button
                onClick={() => {
                  setEditingLink(null);
                  setIsLinkModalOpen(true);
                }}
                className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {issue.links && issue.links.length > 0 ? (
              <div className="space-y-2">
                {issue.links.map((link) => {
                  const LinkIcon = getLinkIcon(link.type);
                  return (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-accent/30 border border-border group"
                    >
                      <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-sm text-foreground/80 hover:text-foreground truncate"
                      >
                        {link.title}
                      </a>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingLink(link);
                            setIsLinkModalOpen(true);
                          }}
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
                          aria-label="Edit link"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveLink(link.id)}
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-status-error rounded transition-colors"
                          aria-label="Remove link"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors text-sm"
              >
                <Link2 className="w-4 h-4" />
                Add a link
              </button>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-muted-foreground text-sm font-medium">Attachments</h3>
              <button
                onClick={() => setIsAttachmentModalOpen(true)}
                className="text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
            {issue.attachments && issue.attachments.length > 0 ? (
              <div className="space-y-2">
                {issue.attachments.map((attachment) => {
                  const FileIcon = getFileIcon(attachment.type);
                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-accent/30 border border-border group"
                    >
                      <div className="w-8 h-8 rounded bg-accent flex items-center justify-center shrink-0">
                        <FileIcon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground/80 truncate">{attachment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.size} • {attachment.uploadedAt}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded transition-colors"
                          aria-label="Download"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => handleRemoveAttachment(attachment.id)}
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-status-error rounded transition-colors"
                          aria-label="Remove attachment"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <button
                onClick={() => setIsAttachmentModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-colors text-sm"
              >
                <Paperclip className="w-4 h-4" />
                Attach a file
              </button>
            )}
          </div>

          {/* Meta actions - Sub-issues only now */}
          <div className="space-y-2 mb-6">
            <MetaAction icon={Plus} label="Add sub-issues" />
          </div>

          {/* Activity section */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-muted-foreground text-sm font-medium">Activity</h3>
              <button className="text-muted-foreground text-[12px] flex items-center gap-1 hover:text-foreground">
                Show all
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-4">
              {issue.activity.map((activity, index) => (
                <ActivityItem
                  key={index}
                  user={activity.user}
                  action={activity.action}
                  time={activity.time}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div className="p-4 border-t border-border shrink-0 bg-surface/50">
        <div className="flex items-start gap-3">
          <img
            src="https://i.pravatar.cc/32?img=10"
            alt="You"
            className="w-8 h-8 rounded-full shrink-0 hidden md:block"
          />
          <div className="flex-1">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full bg-accent/50 border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring min-h-[60px] md:min-h-[80px]"
            />
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAttachmentModalOpen(true)}
                  className="w-9 h-9 md:w-auto md:h-auto flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  className="w-9 h-9 md:w-auto md:h-auto flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Add mention"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
              <button className="px-4 py-2 md:px-3 md:py-1.5 bg-brand hover:bg-brand/90 text-brand-foreground text-sm font-medium rounded-lg md:rounded-md transition-colors">
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={() => {
          setIsLinkModalOpen(false);
          setEditingLink(null);
        }}
        onAddLink={handleAddLink}
        editingLink={editingLink}
      />

      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        onAddAttachment={handleAddAttachment}
      />
    </div>
  );
}

function InlineDropdown({
  isOpen,
  onToggle,
  trigger,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div onClick={onToggle} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownOption({
  label,
  selected,
  onClick,
}: {
  label: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
        selected
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <span className="w-4 flex items-center justify-center">
        {selected && <Check className="w-3.5 h-3.5 text-brand" />}
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function StatusIcon({ className }: { className?: string }) {
  return <Circle className={className} />;
}

function PropertyRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground text-sm w-20 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { bg: string; text: string; icon: React.ElementType; label: string }
  > = {
    "in-progress": {
      bg: "bg-status-progress/20",
      text: "text-status-progress-foreground",
      icon: Clock,
      label: "In Progress",
    },
    todo: { bg: "bg-muted", text: "text-muted-foreground", icon: Circle, label: "Todo" },
    bug: {
      bg: "bg-status-error/20",
      text: "text-status-error-foreground",
      icon: AlertCircle,
      label: "Bug",
    },
    done: {
      bg: "bg-status-success/20",
      text: "text-status-success-foreground",
      icon: Check,
      label: "Done",
    },
  };

  const { bg, text, icon: StatusIconComponent, label } = config[status] || config.todo;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${bg}`}
    >
      <StatusIconComponent className={`w-3.5 h-3.5 ${text}`} />
      <span className={`text-sm ${text}`}>{label}</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    urgent: { bg: "bg-status-error/20", text: "text-status-error-foreground", label: "Urgent" },
    high: { bg: "bg-status-warning/20", text: "text-status-warning-foreground", label: "High" },
    medium: {
      bg: "bg-status-progress/20",
      text: "text-status-progress-foreground",
      label: "Medium",
    },
    low: { bg: "bg-muted", text: "text-muted-foreground", label: "Low" },
  };

  const { bg, text, label } = config[priority] || config.medium;

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${bg}`}
    >
      <Flag className={`w-3.5 h-3.5 ${text}`} />
      <span className={`text-sm ${text}`}>{label}</span>
    </div>
  );
}

function MetaAction({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm group py-1">
      <Icon className="w-4 h-4" />
      <span>{label}</span>
      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

function ActivityItem({ user, action, time }: { user: string; action: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <img
        src={`https://i.pravatar.cc/24?u=${user}`}
        alt={user}
        className="w-6 h-6 rounded-full shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground text-[12px] leading-relaxed">
          <span className="text-foreground font-medium">{user}</span>
          <span className="text-muted-foreground"> {action}</span>
        </p>
        <p className="text-muted-foreground/60 text-[11px] mt-0.5">{time}</p>
      </div>
    </div>
  );
}
