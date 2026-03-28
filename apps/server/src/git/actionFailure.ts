import type {
  GitActionFailure,
  GitActionFailureCode,
  GitActionProgressPhase,
  GitStackedAction,
} from "@okcode/contracts";
import { Schema } from "effect";
import { GitCommandError, GitHubCliError, GitManagerError, TextGenerationError } from "./Errors.ts";

const DETAIL_MAX_CHARS = 1_200;
const RAW_MESSAGE_MAX_CHARS = 4_000;

interface GitActionFailureContext {
  readonly action: GitStackedAction;
  readonly phase: GitActionProgressPhase | null;
  readonly error: unknown;
}

interface ErrorMetadata {
  readonly command: string | undefined;
  readonly detail: string | undefined;
  readonly operation: string | undefined;
  readonly rawMessage: string;
  readonly source: "git" | "github" | "manager" | "text_generation" | "unknown";
}

function trimToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function limitText(value: string | undefined, maxChars: number): string | undefined {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function uniqueNextSteps(steps: ReadonlyArray<string>): string[] {
  const unique: string[] = [];
  for (const step of steps) {
    const trimmed = trimToUndefined(step);
    if (!trimmed || unique.includes(trimmed)) {
      continue;
    }
    unique.push(trimmed);
  }
  return unique;
}

function toErrorMetadata(error: unknown): ErrorMetadata {
  if (Schema.is(GitCommandError)(error)) {
    return {
      source: "git",
      operation: trimToUndefined(error.operation),
      command: trimToUndefined(error.command),
      detail: trimToUndefined(error.detail),
      rawMessage: trimToUndefined(error.message) ?? "Git command failed.",
    };
  }

  if (Schema.is(GitHubCliError)(error)) {
    return {
      source: "github",
      operation: trimToUndefined(error.operation),
      command: undefined,
      detail: trimToUndefined(error.detail),
      rawMessage: trimToUndefined(error.message) ?? "GitHub CLI failed.",
    };
  }

  if (Schema.is(GitManagerError)(error)) {
    return {
      source: "manager",
      operation: trimToUndefined(error.operation),
      command: undefined,
      detail: trimToUndefined(error.detail),
      rawMessage: trimToUndefined(error.message) ?? "Git action failed.",
    };
  }

  if (Schema.is(TextGenerationError)(error)) {
    return {
      source: "text_generation",
      operation: trimToUndefined(error.operation),
      command: undefined,
      detail: trimToUndefined(error.detail),
      rawMessage: trimToUndefined(error.message) ?? "Text generation failed.",
    };
  }

  if (error instanceof Error) {
    return {
      source: "unknown",
      command: undefined,
      detail: undefined,
      operation: undefined,
      rawMessage: trimToUndefined(error.message) ?? "Unknown error.",
    };
  }

  return {
    source: "unknown",
    command: undefined,
    detail: undefined,
    operation: undefined,
    rawMessage: trimToUndefined(String(error)) ?? "Unknown error.",
  };
}

function buildFailure(input: {
  readonly metadata: ErrorMetadata;
  readonly code: GitActionFailureCode;
  readonly phase: GitActionProgressPhase | null;
  readonly title: string;
  readonly summary: string;
  readonly nextSteps: ReadonlyArray<string>;
  readonly detail: string | undefined;
}): GitActionFailure {
  const detail = limitText(
    input.detail ?? input.metadata.detail ?? input.metadata.rawMessage,
    DETAIL_MAX_CHARS,
  );
  const rawMessage = limitText(input.metadata.rawMessage, RAW_MESSAGE_MAX_CHARS);
  return {
    code: input.code,
    phase: input.phase,
    title: input.title,
    summary: input.summary,
    nextSteps: uniqueNextSteps(input.nextSteps),
    ...(detail ? { detail } : {}),
    ...(input.metadata.command ? { command: input.metadata.command } : {}),
    ...(input.metadata.operation ? { operation: input.metadata.operation } : {}),
    ...(rawMessage ? { rawMessage } : {}),
  };
}

function phaseOutcomeSummary(
  action: GitStackedAction,
  phase: GitActionProgressPhase | null,
): string | null {
  if (phase === "push" && action !== "commit") {
    return "The commit completed locally, but the push did not finish.";
  }

  if (phase === "pr" && action === "commit_push_pr") {
    return "The branch was pushed, but GitHub could not finish creating the pull request.";
  }

  if (phase === "branch") {
    return "OK Code could not prepare a feature branch for this action.";
  }

  if (phase === "commit") {
    return "OK Code could not finish the commit.";
  }

  return null;
}

function detailWithPhaseOutcome(
  action: GitStackedAction,
  phase: GitActionProgressPhase | null,
  detail: string | undefined,
): string | undefined {
  const outcome = phaseOutcomeSummary(action, phase);
  if (outcome && detail) {
    return `${outcome}\n\n${detail}`;
  }
  return outcome ?? detail;
}

function isGitHubAuthFailure(haystack: string): boolean {
  return (
    haystack.includes("gh auth login") ||
    haystack.includes("not authenticated") ||
    haystack.includes("not logged in") ||
    haystack.includes("no oauth token") ||
    haystack.includes("authentication failed")
  );
}

function isGitHubCliMissingFailure(haystack: string): boolean {
  return (
    haystack.includes("github cli (`gh`) is required") || haystack.includes("command not found: gh")
  );
}

function isGitHubAccessFailure(haystack: string): boolean {
  return (
    haystack.includes("permission denied") ||
    haystack.includes("resource not accessible") ||
    haystack.includes("not authorized") ||
    haystack.includes("repository not found") ||
    haystack.includes("could not resolve to a repository") ||
    haystack.includes("http 403") ||
    haystack.includes("http 404") ||
    haystack.includes("forbidden")
  );
}

function isBranchProtectionFailure(haystack: string): boolean {
  return (
    haystack.includes("protected branch hook declined") ||
    haystack.includes("protected branch update failed") ||
    haystack.includes("gh006") ||
    haystack.includes("branch protection") ||
    haystack.includes("pushes to this branch are not allowed")
  );
}

function isNonFastForwardFailure(haystack: string): boolean {
  return (
    haystack.includes("non-fast-forward") ||
    haystack.includes("fetch first") ||
    haystack.includes("failed to push some refs") ||
    haystack.includes("remote contains work that you do not have locally")
  );
}

function isRemoteMissingFailure(haystack: string): boolean {
  return (
    haystack.includes("no git remote is configured") ||
    haystack.includes("no configured push destination") ||
    haystack.includes("does not appear to be a git repository") ||
    haystack.includes("no such remote")
  );
}

function isBranchNotPushedFailure(haystack: string): boolean {
  return (
    haystack.includes("has not been pushed") ||
    haystack.includes("no upstream branch") ||
    haystack.includes("set-upstream") ||
    haystack.includes("publish branch")
  );
}

function isDetachedHeadFailure(haystack: string): boolean {
  return haystack.includes("detached head");
}

function isHookFailure(haystack: string, metadata: ErrorMetadata): boolean {
  return (
    metadata.command?.startsWith("git commit") === true &&
    (haystack.includes("pre-commit") ||
      haystack.includes("pre-push") ||
      haystack.includes("commit-msg") ||
      haystack.includes("hook"))
  );
}

function isNoChangesFailure(haystack: string): boolean {
  return (
    haystack.includes("no changes to commit") ||
    haystack.includes("nothing to commit") ||
    haystack.includes("there are no changes to commit")
  );
}

export function buildGitActionFailure(input: GitActionFailureContext): GitActionFailure {
  const metadata = toErrorMetadata(input.error);
  const haystack = [metadata.rawMessage, metadata.detail, metadata.command]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n")
    .toLowerCase();

  if (isDetachedHeadFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "detached_head",
      title: "Checkout a branch first",
      summary: "This action cannot run from a detached HEAD.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Create or checkout a branch for this work.",
        "Run the git action again from that branch.",
      ],
    });
  }

  if (isBranchProtectionFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "branch_protected",
      title: "Protected branch rejected the push",
      summary: "GitHub blocked the push because this branch is protected.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Create or switch to a feature branch for this change.",
        "Push that branch and open a pull request instead of pushing directly.",
        "If direct pushes should be allowed, ask a repository admin to change branch protection.",
      ],
    });
  }

  if (isNonFastForwardFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "non_fast_forward",
      title: "Pull or rebase before pushing",
      summary: "The remote branch has commits that your local branch does not have yet.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Pull or rebase onto the remote branch.",
        "Resolve any conflicts that appear during the sync.",
        "Retry the push or PR action after your branch is up to date.",
      ],
    });
  }

  if (isRemoteMissingFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "remote_missing",
      title: "Configure a Git remote",
      summary:
        "This repository does not have a usable remote for pushing or creating pull requests.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Add or fix the repository remote configuration.",
        "Verify the remote URL points to the correct repository.",
        "Retry the push or PR action.",
      ],
    });
  }

  if (isBranchNotPushedFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "branch_not_pushed",
      title: "Publish this branch first",
      summary: "GitHub can only open a pull request for a branch that exists on the remote.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Push this branch to the remote so it has an upstream.",
        "Retry the PR action after the branch is published.",
      ],
    });
  }

  if (metadata.source === "github" && isGitHubCliMissingFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "github_cli_missing",
      title: "Install GitHub CLI",
      summary: "Creating pull requests from OK Code requires GitHub CLI (`gh`) to be installed.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Install GitHub CLI (`gh`) and ensure it is available on PATH.",
        "Authenticate it with `gh auth login`.",
        "Retry the PR action.",
      ],
    });
  }

  if (metadata.source === "github" && isGitHubAuthFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "github_auth_required",
      title: "Authenticate GitHub CLI",
      summary:
        input.phase === "pr"
          ? "The branch was pushed, but GitHub CLI is not authenticated so the pull request could not be created."
          : "GitHub CLI is not authenticated for this repository.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Run `gh auth login` in this environment.",
        "Confirm access with `gh auth status`.",
        "Retry the action after authentication succeeds.",
      ],
    });
  }

  if (metadata.source === "github" && isGitHubAccessFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "github_access_denied",
      title: "GitHub rejected the request",
      summary:
        input.phase === "pr"
          ? "The branch was pushed, but GitHub rejected the pull request creation request."
          : "GitHub rejected this request for the current repository or branch.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Verify that your GitHub account can access both the base and head repositories.",
        "Check whether your authentication token has the permissions this repository requires.",
        "Retry the action after repository access or permissions are fixed.",
      ],
    });
  }

  if (metadata.source === "text_generation") {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "text_generation_failed",
      title:
        input.phase === "pr" ? "PR draft generation failed" : "Commit message generation failed",
      summary:
        input.phase === "pr"
          ? "OK Code could not generate the pull request title and body automatically."
          : "OK Code could not generate the commit message automatically.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Retry the action once the text generation issue is resolved.",
        "If the failure persists, finish the commit or pull request manually outside the generated flow.",
      ],
    });
  }

  if (isHookFailure(haystack, metadata)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "hook_failed",
      title: "Commit hook blocked the action",
      summary: "A repository hook rejected the commit.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Review the hook output in the technical details below.",
        "Fix the issue reported by the hook.",
        "Retry the git action.",
      ],
    });
  }

  if (isNoChangesFailure(haystack)) {
    return buildFailure({
      metadata,
      phase: input.phase,
      code: "no_changes",
      title: "No changes to commit",
      summary: "There were no staged or working tree changes available for this action.",
      detail: detailWithPhaseOutcome(input.action, input.phase, metadata.detail),
      nextSteps: [
        "Make or stage the changes you want to include.",
        "Retry the action after the worktree contains the intended edits.",
      ],
    });
  }

  return buildFailure({
    metadata,
    phase: input.phase,
    code: "unknown",
    title:
      input.phase === "pr"
        ? "PR creation failed"
        : input.phase === "push"
          ? "Push failed"
          : input.phase === "commit"
            ? "Commit failed"
            : input.phase === "branch"
              ? "Feature branch setup failed"
              : "Git action failed",
    summary: phaseOutcomeSummary(input.action, input.phase) ?? "Git reported an unexpected error.",
    detail: metadata.detail ?? metadata.rawMessage,
    nextSteps: [
      "Review the technical details below.",
      "Fix the underlying git or GitHub issue.",
      "Retry the action once the repository is back in a good state.",
    ],
  });
}
