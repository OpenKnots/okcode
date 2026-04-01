"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { X, ChevronDown, Check, Plus, Trash2 } from "lucide-react";
import type { Issue, CreateIssueData, User } from "./types";
import { TEAMS, PROJECTS, STATUSES, PRIORITIES, AVAILABLE_LABELS, TEAM_MEMBERS } from "./types";

interface IssueFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateIssueData) => void;
  onDelete?: () => void;
  editingIssue?: Issue | null;
  isMobile?: boolean;
}

export function IssueFormModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  editingIssue,
  isMobile,
}: IssueFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Issue["status"]>("todo");
  const [priority, setPriority] = useState<Issue["priority"]>("medium");
  const [team, setTeam] = useState<string>(TEAMS[0]);
  const [project, setProject] = useState<string>(PROJECTS[0]);
  const [assignee, setAssignee] = useState<User>(TEAM_MEMBERS[0]);
  const [labels, setLabels] = useState<string[]>([]);
  const [isProject, setIsProject] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isEditing = !!editingIssue;

  useEffect(() => {
    if (editingIssue) {
      setTitle(editingIssue.title);
      setDescription(editingIssue.description);
      setStatus(editingIssue.status);
      setPriority(editingIssue.priority);
      setTeam(editingIssue.team);
      setProject(editingIssue.project);
      setAssignee(editingIssue.assignee);
      setLabels(editingIssue.labels);
      setIsProject(editingIssue.isProject || false);
    } else {
      resetForm();
    }
  }, [editingIssue, isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setTeam(TEAMS[0]);
    setProject(PROJECTS[0]);
    setAssignee(TEAM_MEMBERS[0]);
    setLabels([]);
    setIsProject(false);
    setShowDeleteConfirm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      team,
      project,
      assignee,
      labels,
      isProject,
    });

    if (!isEditing) {
      resetForm();
    }
    onClose();
  };

  const handleDelete = () => {
    if (showDeleteConfirm && onDelete) {
      onDelete();
      onClose();
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const toggleLabel = (label: string) => {
    setLabels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative bg-surface border border-border rounded-xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col ${
          isMobile ? "mx-4 max-w-lg" : "max-w-xl mx-4"
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
          <h2 className="text-foreground font-semibold text-[15px]">
            {isEditing ? "Edit Issue" : "Create New Issue"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-muted-foreground text-sm mb-1.5">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Issue title..."
                className="w-full bg-accent/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-muted-foreground text-sm mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="w-full bg-accent/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-ring"
              />
            </div>

            {/* Two-column grid for selects */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <label className="block text-muted-foreground text-sm mb-1.5">Status</label>
                <Dropdown
                  value={STATUSES.find((s) => s.value === status)?.label || ""}
                  isOpen={activeDropdown === "status"}
                  onToggle={() => setActiveDropdown(activeDropdown === "status" ? null : "status")}
                >
                  {STATUSES.map((s) => (
                    <DropdownOption
                      key={s.value}
                      label={s.label}
                      selected={status === s.value}
                      onClick={() => {
                        setStatus(s.value);
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </Dropdown>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-muted-foreground text-sm mb-1.5">Priority</label>
                <Dropdown
                  value={PRIORITIES.find((p) => p.value === priority)?.label || ""}
                  isOpen={activeDropdown === "priority"}
                  onToggle={() =>
                    setActiveDropdown(activeDropdown === "priority" ? null : "priority")
                  }
                >
                  {PRIORITIES.map((p) => (
                    <DropdownOption
                      key={p.value}
                      label={p.label}
                      selected={priority === p.value}
                      onClick={() => {
                        setPriority(p.value);
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </Dropdown>
              </div>

              {/* Team */}
              <div>
                <label className="block text-muted-foreground text-sm mb-1.5">Team</label>
                <Dropdown
                  value={team}
                  isOpen={activeDropdown === "team"}
                  onToggle={() => setActiveDropdown(activeDropdown === "team" ? null : "team")}
                >
                  {TEAMS.map((t) => (
                    <DropdownOption
                      key={t}
                      label={t}
                      selected={team === t}
                      onClick={() => {
                        setTeam(t);
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </Dropdown>
              </div>

              {/* Project */}
              <div>
                <label className="block text-muted-foreground text-sm mb-1.5">Project</label>
                <Dropdown
                  value={project}
                  isOpen={activeDropdown === "project"}
                  onToggle={() =>
                    setActiveDropdown(activeDropdown === "project" ? null : "project")
                  }
                >
                  {PROJECTS.map((p) => (
                    <DropdownOption
                      key={p}
                      label={p}
                      selected={project === p}
                      onClick={() => {
                        setProject(p);
                        setActiveDropdown(null);
                      }}
                    />
                  ))}
                </Dropdown>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-muted-foreground text-sm mb-1.5">Assignee</label>
              <Dropdown
                value={
                  <div className="flex items-center gap-2">
                    <img
                      src={assignee.avatar || "/placeholder.svg"}
                      alt={assignee.name}
                      className="w-5 h-5 rounded-full"
                    />
                    <span>{assignee.name}</span>
                  </div>
                }
                isOpen={activeDropdown === "assignee"}
                onToggle={() =>
                  setActiveDropdown(activeDropdown === "assignee" ? null : "assignee")
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
                    selected={assignee.name === member.name}
                    onClick={() => {
                      setAssignee(member);
                      setActiveDropdown(null);
                    }}
                  />
                ))}
              </Dropdown>
            </div>

            {/* Labels */}
            <div>
              <label className="block text-muted-foreground text-sm mb-1.5">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleLabel(label)}
                    className={`px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                      labels.includes(label)
                        ? "bg-brand text-brand-foreground"
                        : "bg-accent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {labels.includes(label) && <Check className="w-3 h-3 inline mr-1" />}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Is Project Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsProject(!isProject)}
                className={`w-10 h-6 rounded-full transition-colors relative ${isProject ? "bg-brand" : "bg-accent"}`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    isProject ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
              <label className="text-muted-foreground text-sm">Mark as Project</label>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border flex items-center justify-between shrink-0 bg-surface/50">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    showDeleteConfirm
                      ? "bg-status-error text-status-error-foreground"
                      : "text-status-error hover:bg-status-error/10"
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  {showDeleteConfirm ? "Confirm Delete" : "Delete"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed text-brand-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {isEditing ? "Save Changes" : "Create Issue"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Dropdown({
  value,
  isOpen,
  onToggle,
  children,
}: {
  value: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 bg-accent/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground hover:border-ring transition-colors"
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-10 max-h-48 overflow-y-auto">
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
      type="button"
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
