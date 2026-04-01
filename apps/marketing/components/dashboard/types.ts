export interface User {
  name: string;
  avatar: string;
}

export interface Activity {
  user: string;
  action: string;
  time: string;
}

export interface IssueLink {
  id: string;
  url: string;
  title: string;
  type: "github" | "figma" | "docs" | "external";
}

export interface IssueAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  assignee: User;
  status: "todo" | "in-progress" | "bug" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  project: string;
  team: string;
  time: string;
  labels: string[];
  subtitle?: string;
  isProject?: boolean;
  activity: Activity[];
  links?: IssueLink[];
  attachments?: IssueAttachment[];
}

export interface CreateIssueData {
  title: string;
  description: string;
  assignee: User;
  status: Issue["status"];
  priority: Issue["priority"];
  project: string;
  team: string;
  labels: string[];
  isProject?: boolean;
  links?: IssueLink[];
  attachments?: IssueAttachment[];
}

export const TEAMS = ["Engineering", "Product", "Design", "Marketing"] as const;
export const PROJECTS = [
  "Spice harvester",
  "AI Features",
  "Core Platform",
  "Design System",
  "Navigation",
  "Growth",
  "Website",
] as const;
export const STATUSES: { value: Issue["status"]; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "bug", label: "Bug" },
  { value: "done", label: "Done" },
];
export const PRIORITIES: { value: Issue["priority"]; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];
export const AVAILABLE_LABELS = [
  "backend",
  "frontend",
  "refactor",
  "ai",
  "feature",
  "bug",
  "api",
  "design",
  "ui",
  "experiment",
  "growth",
  "marketing",
  "website",
  "critical",
] as const;
export const TEAM_MEMBERS: User[] = [
  { name: "nan", avatar: "https://i.pravatar.cc/32?img=1" },
  { name: "raissa", avatar: "https://i.pravatar.cc/32?img=2" },
  { name: "alex", avatar: "https://i.pravatar.cc/32?img=3" },
  { name: "karri", avatar: "https://i.pravatar.cc/32?img=4" },
  { name: "paul", avatar: "https://i.pravatar.cc/32?img=5" },
  { name: "edgar", avatar: "https://i.pravatar.cc/32?img=6" },
  { name: "erin", avatar: "https://i.pravatar.cc/32?img=7" },
  { name: "paco", avatar: "https://i.pravatar.cc/32?img=8" },
];
