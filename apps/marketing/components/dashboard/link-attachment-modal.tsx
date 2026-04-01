"use client";

import type React from "react";
import { useState } from "react";
import {
  X,
  Link2,
  Github,
  Figma,
  FileText,
  ExternalLink,
  Upload,
  File,
  ImageIcon,
  FileCode,
} from "lucide-react";
import type { IssueLink, IssueAttachment } from "./types";

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLink: (link: IssueLink) => void;
  editingLink?: IssueLink | null;
}

export function LinkModal({ isOpen, onClose, onAddLink, editingLink }: LinkModalProps) {
  const [url, setUrl] = useState(editingLink?.url || "");
  const [title, setTitle] = useState(editingLink?.title || "");
  const [type, setType] = useState<IssueLink["type"]>(editingLink?.type || "external");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    onAddLink({
      id: editingLink?.id || `link-${Date.now()}`,
      url: url.trim(),
      title: title.trim() || url.trim(),
      type,
    });

    setUrl("");
    setTitle("");
    setType("external");
    onClose();
  };

  const linkTypes: { value: IssueLink["type"]; label: string; icon: React.ElementType }[] = [
    { value: "github", label: "GitHub", icon: Github },
    { value: "figma", label: "Figma", icon: Figma },
    { value: "docs", label: "Documentation", icon: FileText },
    { value: "external", label: "External", icon: ExternalLink },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-foreground font-semibold text-[15px]">
              {editingLink ? "Edit Link" : "Add Link"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-muted-foreground text-sm mb-1.5">URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-accent/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Link title (optional)"
              className="w-full bg-accent/50 border border-input rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-muted-foreground text-sm mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {linkTypes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    type === value
                      ? "bg-brand text-brand-foreground"
                      : "bg-accent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim()}
              className="px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed text-brand-foreground text-sm font-medium rounded-lg transition-colors"
            >
              {editingLink ? "Save" : "Add Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAttachment: (attachment: IssueAttachment) => void;
}

export function AttachmentModal({ isOpen, onClose, onAddAttachment }: AttachmentModalProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const attachment: IssueAttachment = {
        id: `attachment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || "application/octet-stream",
        url: URL.createObjectURL(file),
        uploadedBy: "you",
        uploadedAt: "Just now",
      };
      onAddAttachment(attachment);
    });

    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-foreground font-semibold text-[15px]">Attach Files</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <label
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
              isDragging ? "border-brand bg-brand/5" : "border-border hover:border-muted-foreground"
            }`}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="sr-only"
            />
            <Upload
              className={`w-10 h-10 mb-3 ${isDragging ? "text-brand" : "text-muted-foreground"}`}
            />
            <p className="text-foreground text-sm font-medium mb-1">
              {isDragging ? "Drop files here" : "Click to upload or drag and drop"}
            </p>
            <p className="text-muted-foreground text-xs">PNG, JPG, PDF, ZIP up to 10MB</p>
          </label>
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("pdf")) return FileText;
  if (type.includes("zip") || type.includes("rar")) return File;
  if (type.includes("javascript") || type.includes("typescript") || type.includes("json"))
    return FileCode;
  return File;
}

export function getLinkIcon(type: IssueLink["type"]) {
  switch (type) {
    case "github":
      return Github;
    case "figma":
      return Figma;
    case "docs":
      return FileText;
    default:
      return ExternalLink;
  }
}
