import { redactSensitiveText } from "@okcode/shared/redaction";

export interface ThreadErrorPresentation {
  title: string | null;
  description: string;
  technicalDetails: string | null;
}

export interface ThreadErrorDiagnosticsCopyOptions {
  includeTips?: boolean;
}

const WORKTREE_COMMAND_PREFIX = "Git command failed in GitCore.createWorktree:";
const AUTH_FAILURE_PATTERNS = [
  "run `codex login`",
  "run codex login",
  "run `claude auth login`",
  "run claude auth login",
  "codex cli is not authenticated",
  "claude is not authenticated",
  "authentication required",
] as const;

function extractWorktreeDetail(error: string): string | null {
  if (!error.startsWith(WORKTREE_COMMAND_PREFIX)) {
    return null;
  }

  const separatorIndex = error.lastIndexOf(" - ");
  const detail = separatorIndex >= 0 ? error.slice(separatorIndex + 3).trim() : error.trim();
  return detail.length > 0 ? detail : null;
}

function getProviderLoginCommand(error: string): string | null {
  const lower = error.toLowerCase();
  if (lower.includes("claude")) {
    return "`claude auth login`";
  }
  if (lower.includes("codex")) {
    return "`codex login`";
  }
  return null;
}

function buildTroubleshootingTips(error: string, presentation: ThreadErrorPresentation): string[] {
  const tips: string[] = [];

  if (isAuthenticationThreadError(error)) {
    const loginCommand = getProviderLoginCommand(error);
    tips.push(
      loginCommand
        ? `Run ${loginCommand} and retry the turn.`
        : "Run the provider login command for this CLI, then retry the turn.",
    );
  }

  if (presentation.title === "Worktree thread could not start") {
    tips.push(
      "Create the first commit or switch to a base branch that resolves to a commit before starting a worktree thread.",
    );
  }

  return tips;
}

export function isAuthenticationThreadError(error: string | null | undefined): boolean {
  const trimmed = error?.trim();
  if (!trimmed) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  return AUTH_FAILURE_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function humanizeThreadError(error: string): ThreadErrorPresentation {
  const trimmed = redactSensitiveText(error).trim();
  const worktreeDetail = extractWorktreeDetail(trimmed);
  if (worktreeDetail) {
    return {
      title: "Worktree thread could not start",
      description: worktreeDetail,
      technicalDetails: trimmed,
    };
  }

  return {
    title: null,
    description: trimmed.length > 0 ? trimmed : "An unexpected error occurred.",
    technicalDetails: null,
  };
}

export function buildThreadErrorDiagnosticsCopy(
  error: string,
  options: ThreadErrorDiagnosticsCopyOptions = {},
): string {
  const presentation = humanizeThreadError(error);
  const lines: string[] = [];
  const message = presentation.title
    ? `${presentation.title}: ${presentation.description}`
    : presentation.description;

  lines.push(`Message: ${message}`);

  if (
    presentation.technicalDetails &&
    presentation.technicalDetails.trim() !== presentation.description.trim()
  ) {
    lines.push("");
    lines.push("Technical details:");
    lines.push(presentation.technicalDetails);
  }

  if (options.includeTips) {
    const tips = buildTroubleshootingTips(error, presentation);
    if (tips.length > 0) {
      lines.push("");
      lines.push("Troubleshooting:");
      for (const tip of tips) {
        lines.push(`- ${tip}`);
      }
    }
  }

  return lines.join("\n");
}
