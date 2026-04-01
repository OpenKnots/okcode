"use client";

import { useState, useEffect, useCallback } from "react";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardInbox } from "./dashboard-inbox";
import { DashboardIssueDetail } from "./dashboard-issue-detail";
import { DashboardEmptyState } from "./dashboard-empty-state";
import { DashboardMobileHeader } from "./dashboard-mobile-header";
import { IssueFormModal } from "./issue-form-modal";
import type { Issue, CreateIssueData } from "./types";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

const initialIssues: Issue[] = [
  {
    id: "ENG-135",
    title: "Refactor sonic crawler",
    description: "The documentContent is defined wrongly. It should be a LazyManyToOne relation.",
    assignee: { name: "nan", avatar: "https://i.pravatar.cc/32?img=1" },
    status: "in-progress",
    priority: "high",
    project: "Spice harvester",
    team: "Engineering",
    time: "2h",
    labels: ["backend", "refactor"],
    activity: [
      { user: "nan", action: "moved from Backlog to In Progress", time: "5 months ago" },
      { user: "igor", action: "linked PR #20319", time: "5 months ago" },
    ],
  },
  {
    id: "LLM-042",
    title: "LLM Chatbot",
    description: "New project update by raissa. Implementing conversational AI features.",
    assignee: { name: "raissa", avatar: "https://i.pravatar.cc/32?img=2" },
    status: "todo",
    priority: "medium",
    project: "AI Features",
    team: "Product",
    time: "1d",
    labels: ["ai", "feature"],
    isProject: true,
    activity: [{ user: "raissa", action: "created this project", time: "1 day ago" }],
  },
  {
    id: "ENG-159",
    title: "Error uploading images via API",
    description:
      "Users are experiencing failures when uploading images larger than 5MB through the API endpoint.",
    assignee: { name: "alex", avatar: "https://i.pravatar.cc/32?img=3" },
    status: "bug",
    priority: "urgent",
    project: "Core Platform",
    team: "Engineering",
    time: "2d",
    labels: ["bug", "api"],
    subtitle: "SLA breached",
    activity: [
      { user: "alex", action: "marked as urgent", time: "2 days ago" },
      { user: "system", action: "SLA breached - 48h response time exceeded", time: "1 day ago" },
    ],
  },
  {
    id: "DES-498",
    title: "Redesign users settings page",
    description:
      "Update the settings page to match the new design system. Include dark mode toggle and notification preferences.",
    assignee: { name: "karri", avatar: "https://i.pravatar.cc/32?img=4" },
    status: "todo",
    priority: "medium",
    project: "Design System",
    team: "Design",
    time: "4h",
    labels: ["design", "ui"],
    subtitle: "karri mentioned you",
    activity: [{ user: "karri", action: "mentioned you in a comment", time: "4 hours ago" }],
  },
  {
    id: "ENG-160",
    title: "Holtzmann engine is broken",
    description:
      "The folding space calculations are returning incorrect values for long-distance jumps.",
    assignee: { name: "paul", avatar: "https://i.pravatar.cc/32?img=5" },
    status: "bug",
    priority: "high",
    project: "Navigation",
    team: "Engineering",
    time: "1w",
    labels: ["bug", "critical"],
    subtitle: "You asked to be reminded",
    activity: [{ user: "paul", action: "set a reminder", time: "1 week ago" }],
  },
  {
    id: "PRJ-001",
    title: "Sign up flow experiments",
    description: "A/B testing different onboarding flows to improve conversion rates.",
    assignee: { name: "edgar", avatar: "https://i.pravatar.cc/32?img=6" },
    status: "done",
    priority: "low",
    project: "Growth",
    team: "Product",
    time: "2w",
    labels: ["experiment", "growth"],
    isProject: true,
    subtitle: "Added as project member",
    activity: [
      { user: "edgar", action: "added you as a member", time: "2 weeks ago" },
      { user: "edgar", action: "completed the project", time: "3 days ago" },
    ],
  },
  {
    id: "MKT-122",
    title: "Design assets for marketing campaign",
    description: "Create banner ads, social media graphics, and email templates for Q1 campaign.",
    assignee: { name: "erin", avatar: "https://i.pravatar.cc/32?img=7" },
    status: "done",
    priority: "medium",
    project: "Marketing",
    team: "Marketing",
    time: "1w",
    labels: ["marketing", "design"],
    subtitle: "erin marked as Duplicate",
    activity: [{ user: "erin", action: "marked as duplicate of MKT-098", time: "1 week ago" }],
  },
  {
    id: "PRJ-002",
    title: "Homepage v3",
    description: "Major redesign of the landing page with new hero section and feature highlights.",
    assignee: { name: "paco", avatar: "https://i.pravatar.cc/32?img=8" },
    status: "in-progress",
    priority: "high",
    project: "Website",
    team: "Design",
    time: "3d",
    labels: ["design", "website"],
    isProject: true,
    subtitle: "New project update",
    activity: [{ user: "paco", action: "updated project status", time: "3 days ago" }],
  },
];

function generateIssueId(team: string): string {
  const prefix =
    {
      Engineering: "ENG",
      Product: "PRJ",
      Design: "DES",
      Marketing: "MKT",
    }[team] || "ISS";
  const num = Math.floor(Math.random() * 900) + 100;
  return `${prefix}-${num}`;
}

export function DashboardLayout() {
  const [issues, setIssues] = useState<Issue[]>(initialIssues);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [activeView, setActiveView] = useState<"inbox" | "my-issues" | "projects" | "views">(
    "inbox",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    if (isDesktop) {
      setSidebarOpen(false);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (isMobile && (sidebarOpen || selectedIssue)) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, sidebarOpen, selectedIssue]);

  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
  };

  const handleCloseDetail = () => {
    setSelectedIssue(null);
  };

  const handleCreateIssue = useCallback((data: CreateIssueData) => {
    const newIssue: Issue = {
      ...data,
      id: generateIssueId(data.team),
      time: "Just now",
      activity: [{ user: "you", action: "created this issue", time: "Just now" }],
    };
    setIssues((prev) => [newIssue, ...prev]);
  }, []);

  const handleUpdateIssue = useCallback(
    (data: CreateIssueData) => {
      if (!editingIssue) return;

      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === editingIssue.id
            ? {
                ...issue,
                ...data,
                activity: [
                  { user: "you", action: "updated this issue", time: "Just now" },
                  ...issue.activity,
                ],
              }
            : issue,
        ),
      );

      // Update selected issue if it's the one being edited
      if (selectedIssue?.id === editingIssue.id) {
        setSelectedIssue((prev) =>
          prev
            ? {
                ...prev,
                ...data,
                activity: [
                  { user: "you", action: "updated this issue", time: "Just now" },
                  ...prev.activity,
                ],
              }
            : null,
        );
      }

      setEditingIssue(null);
    },
    [editingIssue, selectedIssue],
  );

  const handleDeleteIssue = useCallback(() => {
    if (!editingIssue) return;

    setIssues((prev) => prev.filter((issue) => issue.id !== editingIssue.id));

    if (selectedIssue?.id === editingIssue.id) {
      setSelectedIssue(null);
    }

    setEditingIssue(null);
  }, [editingIssue, selectedIssue]);

  const handleOpenCreateModal = useCallback(() => {
    setEditingIssue(null);
    setIsCreateModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((issue: Issue) => {
    setEditingIssue(issue);
    setIsCreateModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingIssue(null);
  }, []);

  const handleQuickUpdate = useCallback(
    (issueId: string, updates: Partial<Issue>) => {
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                ...updates,
                activity: [
                  { user: "you", action: "updated this issue", time: "Just now" },
                  ...issue.activity,
                ],
              }
            : issue,
        ),
      );

      if (selectedIssue?.id === issueId) {
        setSelectedIssue((prev) =>
          prev
            ? {
                ...prev,
                ...updates,
                activity: [
                  { user: "you", action: "updated this issue", time: "Just now" },
                  ...prev.activity,
                ],
              }
            : null,
        );
      }
    },
    [selectedIssue],
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-background">
      {isMobile && (
        <DashboardMobileHeader
          onMenuToggle={() => setSidebarOpen(true)}
          activeView={activeView}
          onCreateIssue={handleOpenCreateModal}
        />
      )}

      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop: always visible */}
        {isDesktop && (
          <DashboardSidebar
            activeView={activeView}
            onViewChange={setActiveView}
            collapsed={false}
            onToggleCollapse={() => {}}
            isMobile={false}
            onClose={() => {}}
            onCreateIssue={handleOpenCreateModal}
          />
        )}

        {/* Tablet: collapsible sidebar */}
        {isTablet && (
          <DashboardSidebar
            activeView={activeView}
            onViewChange={setActiveView}
            collapsed={!sidebarOpen}
            onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
            isMobile={false}
            onClose={() => {}}
            onCreateIssue={handleOpenCreateModal}
          />
        )}

        {/* Mobile: full-screen overlay sidebar */}
        {isMobile && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 ${
                sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => setSidebarOpen(false)}
            />
            {/* Sidebar panel */}
            <div
              className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] transform transition-transform duration-300 ease-out ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <DashboardSidebar
                activeView={activeView}
                onViewChange={(view) => {
                  setActiveView(view);
                  setSidebarOpen(false);
                }}
                collapsed={false}
                onToggleCollapse={() => {}}
                isMobile={true}
                onClose={() => setSidebarOpen(false)}
                onCreateIssue={handleOpenCreateModal}
              />
            </div>
          </>
        )}

        <div className="flex-1 flex min-w-0">
          {/* Inbox/List panel */}
          <div
            className={`
              ${isMobile ? "w-full" : isTablet ? "w-72" : "w-80"}
              ${isMobile && selectedIssue ? "hidden" : "flex"}
              h-full
            `}
          >
            <DashboardInbox
              issues={issues}
              selectedIssue={selectedIssue}
              onSelectIssue={handleSelectIssue}
              activeView={activeView}
              isMobile={isMobile}
              onCreateIssue={handleOpenCreateModal}
            />
          </div>

          {/* Detail panel - responsive */}
          {!isMobile && (
            <div className="flex-1 min-w-0 border-l border-border">
              {selectedIssue ? (
                <DashboardIssueDetail
                  issue={selectedIssue}
                  onClose={handleCloseDetail}
                  isMobile={false}
                  onEdit={() => handleOpenEditModal(selectedIssue)}
                  onQuickUpdate={(updates) => handleQuickUpdate(selectedIssue.id, updates)}
                />
              ) : (
                <DashboardEmptyState onCreateIssue={handleOpenCreateModal} />
              )}
            </div>
          )}

          {/* Mobile: Full-screen detail panel */}
          {isMobile && selectedIssue && (
            <div className="fixed inset-0 z-30 bg-background">
              <DashboardIssueDetail
                issue={selectedIssue}
                onClose={handleCloseDetail}
                isMobile={true}
                onEdit={() => handleOpenEditModal(selectedIssue)}
                onQuickUpdate={(updates) => handleQuickUpdate(selectedIssue.id, updates)}
              />
            </div>
          )}
        </div>
      </div>

      <IssueFormModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseModal}
        onSubmit={editingIssue ? handleUpdateIssue : handleCreateIssue}
        onDelete={editingIssue ? handleDeleteIssue : undefined}
        editingIssue={editingIssue}
        isMobile={isMobile}
      />
    </div>
  );
}
