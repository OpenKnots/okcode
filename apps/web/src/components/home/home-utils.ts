import type { ServerProviderStatus } from "@okcode/contracts";

export function formatEnvModeLabel(envMode: "local" | "worktree") {
  return envMode === "worktree" ? "New worktree" : "Local mode";
}

export function getProviderLabel(provider: ServerProviderStatus["provider"]) {
  switch (provider) {
    case "claudeAgent":
      return "Claude";
    case "codex":
      return "Codex";
  }
}

export function getProviderStatusLabel(provider: ServerProviderStatus) {
  if (!provider.available) {
    return "Unavailable";
  }
  if (provider.status === "ready") {
    return provider.authStatus === "authenticated" ? "Ready" : "Needs sign-in";
  }
  if (provider.status === "warning") {
    return "Needs attention";
  }
  return "Error";
}

export function getProviderBadgeVariant(
  provider: ServerProviderStatus,
): "success" | "warning" | "error" {
  if (!provider.available || provider.status === "error") {
    return "error";
  }
  if (provider.status === "warning" || provider.authStatus !== "authenticated") {
    return "warning";
  }
  return "success";
}

export function formatRelativeTimeCompact(value: string | undefined) {
  if (!value) {
    return "Just now";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "Just now";
  }
  if (diffMs < hour) {
    return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  }
  if (diffMs < day) {
    return `${Math.max(1, Math.round(diffMs / hour))}h ago`;
  }
  return `${Math.max(1, Math.round(diffMs / day))}d ago`;
}

export function getThreadActivityLabel(input: {
  updatedAt: string | undefined;
  sessionStatus: string | null | undefined;
  hasLatestTurn: boolean;
}) {
  if (input.sessionStatus === "running") {
    return "Running";
  }
  if (input.sessionStatus === "connecting") {
    return "Connecting";
  }
  if (input.sessionStatus === "error") {
    return "Needs attention";
  }
  if (input.hasLatestTurn) {
    return "Ready to resume";
  }
  if (input.updatedAt) {
    return "Recently updated";
  }
  return "New thread";
}

export interface RecentThread {
  id: string;
  title: string;
  projectName: string;
  updatedLabel: string;
  statusLabel: string;
}
