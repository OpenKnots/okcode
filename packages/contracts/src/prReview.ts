import { Schema } from "effect";
import { NonNegativeInt, PositiveInt, TrimmedNonEmptyString } from "./baseSchemas";

const PrWorkflowStepKind = Schema.Literals([
  "checklist",
  "remoteCheck",
  "reviewAction",
  "skillSet",
  "conflictAnalysis",
  "manualApproval",
  "openExternal",
]);
export type PrWorkflowStepKind = typeof PrWorkflowStepKind.Type;

export const PrWorkflowStepStatus = Schema.Literals([
  "todo",
  "running",
  "blocked",
  "done",
  "failed",
  "skipped",
]);
export type PrWorkflowStepStatus = typeof PrWorkflowStepStatus.Type;

export const PrReviewThreadState = Schema.Literals(["open", "resolved", "outdated"]);
export type PrReviewThreadState = typeof PrReviewThreadState.Type;

export const PrSubmitReviewEvent = Schema.Literals(["COMMENT", "APPROVE", "REQUEST_CHANGES"]);
export type PrSubmitReviewEvent = typeof PrSubmitReviewEvent.Type;

export const PrConflictResolutionConfidence = Schema.Literals(["safe", "review"]);
export type PrConflictResolutionConfidence = typeof PrConflictResolutionConfidence.Type;

export const PrReviewConfigIssueSeverity = Schema.Literals(["warning", "error"]);
export type PrReviewConfigIssueSeverity = typeof PrReviewConfigIssueSeverity.Type;

export const GitHubUserPreview = Schema.Struct({
  login: TrimmedNonEmptyString,
  avatarUrl: Schema.String,
  url: Schema.String,
  name: Schema.NullOr(Schema.String),
  bio: Schema.NullOr(Schema.String),
  company: Schema.NullOr(Schema.String),
  location: Schema.NullOr(Schema.String),
});
export type GitHubUserPreview = typeof GitHubUserPreview.Type;

export const PrReviewParticipantRole = Schema.Literals([
  "author",
  "reviewer",
  "commenter",
  "requestedReviewer",
  "participant",
]);
export type PrReviewParticipantRole = typeof PrReviewParticipantRole.Type;

export const PrReviewParticipant = Schema.Struct({
  user: GitHubUserPreview,
  role: PrReviewParticipantRole,
});
export type PrReviewParticipant = typeof PrReviewParticipant.Type;

export const PrReviewStatusCheck = Schema.Struct({
  name: TrimmedNonEmptyString,
  status: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  detailsUrl: Schema.NullOr(Schema.String),
});
export type PrReviewStatusCheck = typeof PrReviewStatusCheck.Type;

export const PrReviewComment = Schema.Struct({
  id: TrimmedNonEmptyString,
  databaseId: Schema.NullOr(PositiveInt),
  body: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  url: Schema.NullOr(Schema.String),
  author: Schema.NullOr(GitHubUserPreview),
  replyToId: Schema.NullOr(TrimmedNonEmptyString),
  path: Schema.NullOr(TrimmedNonEmptyString),
  line: Schema.NullOr(PositiveInt),
  originalLine: Schema.NullOr(PositiveInt),
  startLine: Schema.NullOr(PositiveInt),
  side: Schema.NullOr(Schema.String),
  startSide: Schema.NullOr(Schema.String),
  diffHunk: Schema.NullOr(Schema.String),
});
export type PrReviewComment = typeof PrReviewComment.Type;

export const PrReviewThread = Schema.Struct({
  id: TrimmedNonEmptyString,
  path: Schema.NullOr(TrimmedNonEmptyString),
  line: Schema.NullOr(PositiveInt),
  originalLine: Schema.NullOr(PositiveInt),
  startLine: Schema.NullOr(PositiveInt),
  side: Schema.NullOr(Schema.String),
  startSide: Schema.NullOr(Schema.String),
  isResolved: Schema.Boolean,
  isOutdated: Schema.Boolean,
  state: PrReviewThreadState,
  comments: Schema.Array(PrReviewComment),
});
export type PrReviewThread = typeof PrReviewThread.Type;

export const PrReviewFile = Schema.Struct({
  path: TrimmedNonEmptyString,
  additions: NonNegativeInt,
  deletions: NonNegativeInt,
  changeType: Schema.String,
  patch: Schema.NullOr(Schema.String),
});
export type PrReviewFile = typeof PrReviewFile.Type;

export const PrWorkflowStep = Schema.Struct({
  id: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  kind: PrWorkflowStepKind,
  blocking: Schema.Boolean,
  action: Schema.NullOr(Schema.String),
  skillSet: Schema.NullOr(TrimmedNonEmptyString),
  requiresConfirmation: Schema.Boolean,
  successMessage: Schema.NullOr(Schema.String),
  failureMessage: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
});
export type PrWorkflowStep = typeof PrWorkflowStep.Type;

export const PrWorkflowDefinition = Schema.Struct({
  id: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  description: Schema.NullOr(Schema.String),
  appliesTo: Schema.Array(TrimmedNonEmptyString),
  blocking: Schema.Boolean,
  steps: Schema.Array(PrWorkflowStep),
  body: Schema.String,
  relativePath: TrimmedNonEmptyString,
});
export type PrWorkflowDefinition = typeof PrWorkflowDefinition.Type;

export const PrSkillSetDefinition = Schema.Struct({
  id: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  description: Schema.NullOr(Schema.String),
  skills: Schema.Array(TrimmedNonEmptyString),
  allowedTools: Schema.Array(TrimmedNonEmptyString),
  runPolicy: Schema.NullOr(Schema.String),
  body: Schema.String,
  relativePath: TrimmedNonEmptyString,
});
export type PrSkillSetDefinition = typeof PrSkillSetDefinition.Type;

export const PrWorkflowStepResolution = Schema.Struct({
  stepId: TrimmedNonEmptyString,
  status: PrWorkflowStepStatus,
  detail: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
});
export type PrWorkflowStepResolution = typeof PrWorkflowStepResolution.Type;

export const PrReviewMentionGroup = Schema.Struct({
  id: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  users: Schema.Array(TrimmedNonEmptyString),
});
export type PrReviewMentionGroup = typeof PrReviewMentionGroup.Type;

export const PrReviewRuleDefinition = Schema.Struct({
  id: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  description: Schema.NullOr(Schema.String),
});
export type PrReviewRuleDefinition = typeof PrReviewRuleDefinition.Type;

export const PrReviewRules = Schema.Struct({
  version: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  mergePolicy: TrimmedNonEmptyString,
  conflictPolicy: TrimmedNonEmptyString,
  requiredChecks: Schema.Array(TrimmedNonEmptyString),
  requiredApprovals: NonNegativeInt,
  blockingRules: Schema.Array(PrReviewRuleDefinition),
  advisoryRules: Schema.Array(PrReviewRuleDefinition),
  defaultWorkflow: TrimmedNonEmptyString,
  mentionGroups: Schema.Array(PrReviewMentionGroup),
  body: Schema.String,
  relativePath: TrimmedNonEmptyString,
});
export type PrReviewRules = typeof PrReviewRules.Type;

export const PrReviewConfigIssue = Schema.Struct({
  severity: PrReviewConfigIssueSeverity,
  path: TrimmedNonEmptyString,
  message: TrimmedNonEmptyString,
});
export type PrReviewConfigIssue = typeof PrReviewConfigIssue.Type;

export const PrReviewConfig = Schema.Struct({
  source: Schema.Literals(["default", "repo", "localProfile"]),
  rules: PrReviewRules,
  workflows: Schema.Array(PrWorkflowDefinition),
  skillSets: Schema.Array(PrSkillSetDefinition),
  defaultWorkflowId: TrimmedNonEmptyString,
  issues: Schema.Array(PrReviewConfigIssue),
});
export type PrReviewConfig = typeof PrReviewConfig.Type;

export const PrReviewSummary = Schema.Struct({
  id: TrimmedNonEmptyString,
  number: PositiveInt,
  title: TrimmedNonEmptyString,
  body: Schema.String,
  url: Schema.String,
  state: TrimmedNonEmptyString,
  isDraft: Schema.Boolean,
  mergeable: Schema.NullOr(Schema.String),
  mergeStateStatus: Schema.NullOr(Schema.String),
  reviewDecision: Schema.NullOr(Schema.String),
  baseBranch: TrimmedNonEmptyString,
  headBranch: TrimmedNonEmptyString,
  author: Schema.NullOr(GitHubUserPreview),
  labels: Schema.Array(
    Schema.Struct({
      name: TrimmedNonEmptyString,
      color: Schema.String,
    }),
  ),
  statusChecks: Schema.Array(PrReviewStatusCheck),
  participants: Schema.Array(PrReviewParticipant),
  reviewRequests: Schema.Array(PrReviewParticipant),
  recentReviews: Schema.Array(
    Schema.Struct({
      authorLogin: TrimmedNonEmptyString,
      state: TrimmedNonEmptyString,
      body: Schema.String,
      submittedAt: Schema.String,
    }),
  ),
  totalThreadCount: NonNegativeInt,
  unresolvedThreadCount: NonNegativeInt,
  headSha: Schema.NullOr(TrimmedNonEmptyString),
  baseSha: Schema.NullOr(TrimmedNonEmptyString),
});
export type PrReviewSummary = typeof PrReviewSummary.Type;

export const PrReviewDashboardResult = Schema.Struct({
  pullRequest: PrReviewSummary,
  files: Schema.Array(PrReviewFile),
  threads: Schema.Array(PrReviewThread),
  workflowSteps: Schema.Array(PrWorkflowStepResolution),
  readOnlyReason: Schema.NullOr(Schema.String),
});
export type PrReviewDashboardResult = typeof PrReviewDashboardResult.Type;

export const PrReviewPatchResult = Schema.Struct({
  pullRequestNumber: PositiveInt,
  combinedPatch: Schema.String,
  files: Schema.Array(PrReviewFile),
});
export type PrReviewPatchResult = typeof PrReviewPatchResult.Type;

export const PrConflictCandidateResolution = Schema.Struct({
  id: TrimmedNonEmptyString,
  path: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString,
  description: Schema.String,
  confidence: PrConflictResolutionConfidence,
  previewPatch: Schema.String,
});
export type PrConflictCandidateResolution = typeof PrConflictCandidateResolution.Type;

export const PrConflictAnalysis = Schema.Struct({
  status: Schema.Literals(["clean", "conflicted", "unavailable"]),
  mergeableState: Schema.NullOr(Schema.String),
  summary: Schema.String,
  candidates: Schema.Array(PrConflictCandidateResolution),
});
export type PrConflictAnalysis = typeof PrConflictAnalysis.Type;

export const PrConflictApplyResult = Schema.Struct({
  candidateId: TrimmedNonEmptyString,
  applied: Schema.Boolean,
  summary: Schema.String,
});
export type PrConflictApplyResult = typeof PrConflictApplyResult.Type;

export const PrReviewDraft = Schema.Struct({
  projectId: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  path: Schema.NullOr(TrimmedNonEmptyString),
  line: Schema.NullOr(PositiveInt),
  body: Schema.String,
});
export type PrReviewDraft = typeof PrReviewDraft.Type;

export const PrSubmitReviewResult = Schema.Struct({
  submitted: Schema.Boolean,
  event: PrSubmitReviewEvent,
  summary: Schema.String,
});
export type PrSubmitReviewResult = typeof PrSubmitReviewResult.Type;

export const PrWorkflowStepRunResult = Schema.Struct({
  stepId: TrimmedNonEmptyString,
  status: PrWorkflowStepStatus,
  summary: Schema.String,
  requiresConfirmation: Schema.Boolean,
});
export type PrWorkflowStepRunResult = typeof PrWorkflowStepRunResult.Type;

export const PrReviewConfigInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
});
export type PrReviewConfigInput = typeof PrReviewConfigInput.Type;

export const PrReviewDashboardInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
});
export type PrReviewDashboardInput = typeof PrReviewDashboardInput.Type;

export const PrReviewPatchInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
});
export type PrReviewPatchInput = typeof PrReviewPatchInput.Type;

export const PrReviewAddThreadInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  body: Schema.String,
  path: TrimmedNonEmptyString,
  line: PositiveInt,
  side: Schema.optional(TrimmedNonEmptyString),
  startLine: Schema.optional(PositiveInt),
  startSide: Schema.optional(TrimmedNonEmptyString),
});
export type PrReviewAddThreadInput = typeof PrReviewAddThreadInput.Type;

export const PrReviewReplyToThreadInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  threadId: TrimmedNonEmptyString,
  body: Schema.String,
});
export type PrReviewReplyToThreadInput = typeof PrReviewReplyToThreadInput.Type;

export const PrReviewResolveThreadInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  threadId: TrimmedNonEmptyString,
});
export type PrReviewResolveThreadInput = typeof PrReviewResolveThreadInput.Type;

export const PrReviewSearchUsersInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  query: TrimmedNonEmptyString,
  limit: Schema.optional(PositiveInt),
});
export type PrReviewSearchUsersInput = typeof PrReviewSearchUsersInput.Type;

export const PrReviewUserPreviewInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  login: TrimmedNonEmptyString,
});
export type PrReviewUserPreviewInput = typeof PrReviewUserPreviewInput.Type;

export const PrReviewSearchUsersResult = Schema.Struct({
  users: Schema.Array(GitHubUserPreview),
});
export type PrReviewSearchUsersResult = typeof PrReviewSearchUsersResult.Type;

export const PrReviewAnalyzeConflictsInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
});
export type PrReviewAnalyzeConflictsInput = typeof PrReviewAnalyzeConflictsInput.Type;

export const PrReviewApplyConflictResolutionInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  candidateId: TrimmedNonEmptyString,
});
export type PrReviewApplyConflictResolutionInput = typeof PrReviewApplyConflictResolutionInput.Type;

export const PrReviewRunWorkflowStepInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  stepId: TrimmedNonEmptyString,
});
export type PrReviewRunWorkflowStepInput = typeof PrReviewRunWorkflowStepInput.Type;

export const PrSubmitReviewInput = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
  event: PrSubmitReviewEvent,
  body: Schema.String,
});
export type PrSubmitReviewInput = typeof PrSubmitReviewInput.Type;

export const PrReviewSyncUpdatedPayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  prNumber: PositiveInt,
});
export type PrReviewSyncUpdatedPayload = typeof PrReviewSyncUpdatedPayload.Type;

export const PrReviewRepoConfigUpdatedPayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  relativePaths: Schema.Array(TrimmedNonEmptyString),
});
export type PrReviewRepoConfigUpdatedPayload = typeof PrReviewRepoConfigUpdatedPayload.Type;
