/**
 * GitHub - Effect service contract for GitHub issue operations.
 *
 * Provides listing, retrieval, and commenting on GitHub issues
 * via the `gh` CLI.
 *
 * @module GitHub
 */
import { ServiceMap } from "effect";
import type { Effect } from "effect";
import type {
  GitHubGetIssueInput,
  GitHubGetIssueResult,
  GitHubListIssuesInput,
  GitHubListIssuesResult,
  GitHubPostCommentInput,
  GitHubPostCommentResult,
} from "@okcode/contracts";
import type { GitHubIssueServiceError } from "../Errors.ts";

/**
 * GitHubShape - Service API for GitHub issue operations.
 */
export interface GitHubShape {
  /**
   * List issues for the current repository, optionally filtered by assignee/state/labels.
   */
  readonly listIssues: (
    input: GitHubListIssuesInput,
  ) => Effect.Effect<GitHubListIssuesResult, GitHubIssueServiceError>;

  /**
   * Get a single issue with its full body, comments, and metadata.
   */
  readonly getIssue: (
    input: GitHubGetIssueInput,
  ) => Effect.Effect<GitHubGetIssueResult, GitHubIssueServiceError>;

  /**
   * Post a comment on a GitHub issue.
   */
  readonly postComment: (
    input: GitHubPostCommentInput,
  ) => Effect.Effect<GitHubPostCommentResult, GitHubIssueServiceError>;
}

/**
 * GitHub - Service tag for GitHub issue operations.
 */
export class GitHub extends ServiceMap.Service<GitHub, GitHubShape>()(
  "okcode/github/Services/GitHub",
) {}
