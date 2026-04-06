import { Schema } from "effect";
import { NonNegativeInt, PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";
import { GitHubUserPreview } from "./prReview";

// ── GitHub Reference ────────────────────────────────────────────────

export const GitHubRefKind = Schema.Literals(["issue", "pr"]);
export type GitHubRefKind = typeof GitHubRefKind.Type;

export const GitHubRef = Schema.Struct({
  kind: GitHubRefKind,
  owner: TrimmedNonEmptyString,
  repo: TrimmedNonEmptyString,
  number: PositiveInt,
});
export type GitHubRef = typeof GitHubRef.Type;

// ── Issue Schemas ───────────────────────────────────────────────────

export const GitHubIssueLabel = Schema.Struct({
  name: TrimmedNonEmptyString,
  color: Schema.String,
});
export type GitHubIssueLabel = typeof GitHubIssueLabel.Type;

export const GitHubIssueState = Schema.Literals(["open", "closed"]);
export type GitHubIssueState = typeof GitHubIssueState.Type;

export const GitHubIssueComment = Schema.Struct({
  id: TrimmedNonEmptyString,
  body: Schema.String,
  author: Schema.NullOr(GitHubUserPreview),
  createdAt: Schema.String,
  url: Schema.NullOr(Schema.String),
});
export type GitHubIssueComment = typeof GitHubIssueComment.Type;

export const GitHubIssueSummary = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyString,
  state: GitHubIssueState,
  labels: Schema.Array(GitHubIssueLabel),
  author: Schema.NullOr(GitHubUserPreview),
  url: Schema.String,
  updatedAt: Schema.String,
});
export type GitHubIssueSummary = typeof GitHubIssueSummary.Type;

export const GitHubIssueDetail = Schema.Struct({
  number: PositiveInt,
  title: TrimmedNonEmptyString,
  state: GitHubIssueState,
  body: Schema.String,
  labels: Schema.Array(GitHubIssueLabel),
  author: Schema.NullOr(GitHubUserPreview),
  assignees: Schema.Array(GitHubUserPreview),
  comments: Schema.Array(GitHubIssueComment),
  milestone: Schema.NullOr(Schema.String),
  url: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  commentsCount: NonNegativeInt,
});
export type GitHubIssueDetail = typeof GitHubIssueDetail.Type;

// ── RPC Input / Result Schemas ──────────────────────────────────────

export const GitHubListIssuesInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  assignee: Schema.optional(Schema.String),
  state: Schema.optional(GitHubIssueState),
  labels: Schema.optional(Schema.String),
  limit: Schema.optional(PositiveInt),
});
export type GitHubListIssuesInput = typeof GitHubListIssuesInput.Type;

export const GitHubListIssuesResult = Schema.Struct({
  issues: Schema.Array(GitHubIssueSummary),
});
export type GitHubListIssuesResult = typeof GitHubListIssuesResult.Type;

export const GitHubGetIssueInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  number: PositiveInt,
});
export type GitHubGetIssueInput = typeof GitHubGetIssueInput.Type;

export const GitHubGetIssueResult = Schema.Struct({
  issue: GitHubIssueDetail,
});
export type GitHubGetIssueResult = typeof GitHubGetIssueResult.Type;

export const GitHubPostCommentInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  issueNumber: PositiveInt,
  body: TrimmedNonEmptyString,
});
export type GitHubPostCommentInput = typeof GitHubPostCommentInput.Type;

export const GitHubPostCommentResult = Schema.Struct({
  url: Schema.String,
});
export type GitHubPostCommentResult = typeof GitHubPostCommentResult.Type;
