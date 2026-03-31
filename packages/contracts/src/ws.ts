import { Schema, Struct } from "effect";
import { NonNegativeInt, ProjectId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas";

import {
  ClientOrchestrationCommand,
  OrchestrationEvent,
  ORCHESTRATION_WS_CHANNELS,
  OrchestrationGetFullThreadDiffInput,
  ORCHESTRATION_WS_METHODS,
  OrchestrationGetSnapshotInput,
  OrchestrationGetTurnDiffInput,
  OrchestrationReplayEventsInput,
} from "./orchestration";
import {
  GitActionProgressEvent,
  GitCheckoutInput,
  GitCloneRepositoryInput,
  GitCreateBranchInput,
  GitPreparePullRequestThreadInput,
  GitCreateWorktreeInput,
  GitInitInput,
  GitListBranchesInput,
  GitListPullRequestsInput,
  GitPullInput,
  GitPullRequestRefInput,
  GitRemoveWorktreeInput,
  GitRunStackedActionInput,
  GitStatusInput,
} from "./git";
import {
  GitHubUserPreview,
  PrConflictAnalysis,
  PrConflictApplyResult,
  PrReviewAddThreadInput,
  PrReviewApplyConflictResolutionInput,
  PrReviewConfig,
  PrReviewConfigInput,
  PrReviewDashboardInput,
  PrReviewDashboardResult,
  PrReviewPatchInput,
  PrReviewPatchResult,
  PrReviewRepoConfigUpdatedPayload,
  PrReviewReplyToThreadInput,
  PrReviewResolveThreadInput,
  PrReviewRunWorkflowStepInput,
  PrReviewSearchUsersInput,
  PrReviewSearchUsersResult,
  PrReviewSyncUpdatedPayload,
  PrReviewUserPreviewInput,
  PrSubmitReviewInput,
  PrSubmitReviewResult,
  PrWorkflowStepRunResult,
} from "./prReview";
import {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalWriteInput,
} from "./terminal";
import { KeybindingRule } from "./keybindings";
import {
  ProjectEnvironmentVariablesInput,
  SaveGlobalEnvironmentVariablesInput,
  SaveProjectEnvironmentVariablesInput,
} from "./environment";
import {
  ProjectListDirectoryInput,
  ProjectReadFileInput,
  ProjectSearchEntriesInput,
  ProjectWriteFileInput,
} from "./project";
import { OpenInEditorInput } from "./editor";
import { ServerConfigUpdatedPayload } from "./server";
import {
  SkillListInput,
  SkillReadInput,
  SkillCreateInput,
  SkillDeleteInput,
  SkillSearchInput,
} from "./skill";

// ── WebSocket RPC Method Names ───────────────────────────────────────

export const WS_METHODS = {
  // Project registry methods
  projectsList: "projects.list",
  projectsAdd: "projects.add",
  projectsRemove: "projects.remove",
  projectsSearchEntries: "projects.searchEntries",
  projectsListDirectory: "projects.listDirectory",
  projectsWriteFile: "projects.writeFile",
  projectsReadFile: "projects.readFile",

  // Shell methods
  shellOpenInEditor: "shell.openInEditor",

  // Git methods
  gitPull: "git.pull",
  gitStatus: "git.status",
  gitRunStackedAction: "git.runStackedAction",
  gitListBranches: "git.listBranches",
  gitCreateWorktree: "git.createWorktree",
  gitRemoveWorktree: "git.removeWorktree",
  gitCreateBranch: "git.createBranch",
  gitCheckout: "git.checkout",
  gitInit: "git.init",
  gitCloneRepository: "git.cloneRepository",
  gitResolvePullRequest: "git.resolvePullRequest",
  gitPreparePullRequestThread: "git.preparePullRequestThread",
  gitListPullRequests: "git.listPullRequests",

  // PR review methods
  prReviewGetConfig: "prReview.getConfig",
  prReviewGetDashboard: "prReview.getDashboard",
  prReviewGetPatch: "prReview.getPatch",
  prReviewAddThread: "prReview.addThread",
  prReviewReplyToThread: "prReview.replyToThread",
  prReviewResolveThread: "prReview.resolveThread",
  prReviewUnresolveThread: "prReview.unresolveThread",
  prReviewSearchUsers: "prReview.searchUsers",
  prReviewGetUserPreview: "prReview.getUserPreview",
  prReviewAnalyzeConflicts: "prReview.analyzeConflicts",
  prReviewApplyConflictResolution: "prReview.applyConflictResolution",
  prReviewRunWorkflowStep: "prReview.runWorkflowStep",
  prReviewSubmitReview: "prReview.submitReview",

  // Terminal methods
  terminalOpen: "terminal.open",
  terminalWrite: "terminal.write",
  terminalResize: "terminal.resize",
  terminalClear: "terminal.clear",
  terminalRestart: "terminal.restart",
  terminalClose: "terminal.close",

  // Skill methods
  skillList: "skill.list",
  skillRead: "skill.read",
  skillCreate: "skill.create",
  skillDelete: "skill.delete",
  skillSearch: "skill.search",

  // Server meta
  serverGetConfig: "server.getConfig",
  serverGetGlobalEnvironmentVariables: "server.getGlobalEnvironmentVariables",
  serverSaveGlobalEnvironmentVariables: "server.saveGlobalEnvironmentVariables",
  serverGetProjectEnvironmentVariables: "server.getProjectEnvironmentVariables",
  serverSaveProjectEnvironmentVariables: "server.saveProjectEnvironmentVariables",
  serverUpsertKeybinding: "server.upsertKeybinding",
  serverPickFolder: "server.pickFolder",
} as const;

// ── Push Event Channels ──────────────────────────────────────────────

export const WS_CHANNELS = {
  gitActionProgress: "git.actionProgress",
  prReviewSyncUpdated: "prReview.syncUpdated",
  prReviewRepoConfigUpdated: "prReview.repoConfigUpdated",
  terminalEvent: "terminal.event",
  serverWelcome: "server.welcome",
  serverConfigUpdated: "server.configUpdated",
} as const;

// -- Tagged Union of all request body schemas ─────────────────────────

const tagRequestBody = <const Tag extends string, const Fields extends Schema.Struct.Fields>(
  tag: Tag,
  schema: Schema.Struct<Fields>,
) =>
  schema.mapFields(
    Struct.assign({ _tag: Schema.tag(tag) }),
    // PreserveChecks is safe here. No existing schema should have checks depending on the tag
    { unsafePreserveChecks: true },
  );

const WebSocketRequestBody = Schema.Union([
  // Orchestration methods
  tagRequestBody(
    ORCHESTRATION_WS_METHODS.dispatchCommand,
    Schema.Struct({ command: ClientOrchestrationCommand }),
  ),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getSnapshot, OrchestrationGetSnapshotInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getTurnDiff, OrchestrationGetTurnDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.getFullThreadDiff, OrchestrationGetFullThreadDiffInput),
  tagRequestBody(ORCHESTRATION_WS_METHODS.replayEvents, OrchestrationReplayEventsInput),

  // Project Search
  tagRequestBody(WS_METHODS.projectsSearchEntries, ProjectSearchEntriesInput),
  tagRequestBody(WS_METHODS.projectsListDirectory, ProjectListDirectoryInput),
  tagRequestBody(WS_METHODS.projectsWriteFile, ProjectWriteFileInput),
  tagRequestBody(WS_METHODS.projectsReadFile, ProjectReadFileInput),

  // Shell methods
  tagRequestBody(WS_METHODS.shellOpenInEditor, OpenInEditorInput),

  // Git methods
  tagRequestBody(WS_METHODS.gitPull, GitPullInput),
  tagRequestBody(WS_METHODS.gitStatus, GitStatusInput),
  tagRequestBody(WS_METHODS.gitRunStackedAction, GitRunStackedActionInput),
  tagRequestBody(WS_METHODS.gitListBranches, GitListBranchesInput),
  tagRequestBody(WS_METHODS.gitCreateWorktree, GitCreateWorktreeInput),
  tagRequestBody(WS_METHODS.gitRemoveWorktree, GitRemoveWorktreeInput),
  tagRequestBody(WS_METHODS.gitCreateBranch, GitCreateBranchInput),
  tagRequestBody(WS_METHODS.gitCheckout, GitCheckoutInput),
  tagRequestBody(WS_METHODS.gitInit, GitInitInput),
  tagRequestBody(WS_METHODS.gitCloneRepository, GitCloneRepositoryInput),
  tagRequestBody(WS_METHODS.gitResolvePullRequest, GitPullRequestRefInput),
  tagRequestBody(WS_METHODS.gitPreparePullRequestThread, GitPreparePullRequestThreadInput),
  tagRequestBody(WS_METHODS.gitListPullRequests, GitListPullRequestsInput),

  // PR review methods
  tagRequestBody(WS_METHODS.prReviewGetConfig, PrReviewConfigInput),
  tagRequestBody(WS_METHODS.prReviewGetDashboard, PrReviewDashboardInput),
  tagRequestBody(WS_METHODS.prReviewGetPatch, PrReviewPatchInput),
  tagRequestBody(WS_METHODS.prReviewAddThread, PrReviewAddThreadInput),
  tagRequestBody(WS_METHODS.prReviewReplyToThread, PrReviewReplyToThreadInput),
  tagRequestBody(WS_METHODS.prReviewResolveThread, PrReviewResolveThreadInput),
  tagRequestBody(WS_METHODS.prReviewUnresolveThread, PrReviewResolveThreadInput),
  tagRequestBody(WS_METHODS.prReviewSearchUsers, PrReviewSearchUsersInput),
  tagRequestBody(WS_METHODS.prReviewGetUserPreview, PrReviewUserPreviewInput),
  tagRequestBody(WS_METHODS.prReviewAnalyzeConflicts, PrReviewDashboardInput),
  tagRequestBody(WS_METHODS.prReviewApplyConflictResolution, PrReviewApplyConflictResolutionInput),
  tagRequestBody(WS_METHODS.prReviewRunWorkflowStep, PrReviewRunWorkflowStepInput),
  tagRequestBody(WS_METHODS.prReviewSubmitReview, PrSubmitReviewInput),

  // Terminal methods
  tagRequestBody(WS_METHODS.terminalOpen, TerminalOpenInput),
  tagRequestBody(WS_METHODS.terminalWrite, TerminalWriteInput),
  tagRequestBody(WS_METHODS.terminalResize, TerminalResizeInput),
  tagRequestBody(WS_METHODS.terminalClear, TerminalClearInput),
  tagRequestBody(WS_METHODS.terminalRestart, TerminalRestartInput),
  tagRequestBody(WS_METHODS.terminalClose, TerminalCloseInput),

  // Skill methods
  tagRequestBody(WS_METHODS.skillList, SkillListInput),
  tagRequestBody(WS_METHODS.skillRead, SkillReadInput),
  tagRequestBody(WS_METHODS.skillCreate, SkillCreateInput),
  tagRequestBody(WS_METHODS.skillDelete, SkillDeleteInput),
  tagRequestBody(WS_METHODS.skillSearch, SkillSearchInput),

  // Server meta
  tagRequestBody(WS_METHODS.serverGetConfig, Schema.Struct({})),
  tagRequestBody(WS_METHODS.serverGetGlobalEnvironmentVariables, Schema.Struct({})),
  tagRequestBody(
    WS_METHODS.serverSaveGlobalEnvironmentVariables,
    SaveGlobalEnvironmentVariablesInput,
  ),
  tagRequestBody(WS_METHODS.serverGetProjectEnvironmentVariables, ProjectEnvironmentVariablesInput),
  tagRequestBody(
    WS_METHODS.serverSaveProjectEnvironmentVariables,
    SaveProjectEnvironmentVariablesInput,
  ),
  tagRequestBody(WS_METHODS.serverUpsertKeybinding, KeybindingRule),
  tagRequestBody(WS_METHODS.serverPickFolder, Schema.Struct({})),
]);

export const WebSocketRequest = Schema.Struct({
  id: TrimmedNonEmptyString,
  body: WebSocketRequestBody,
});
export type WebSocketRequest = typeof WebSocketRequest.Type;

export const WebSocketError = Schema.Struct({
  message: Schema.String,
  code: Schema.optional(TrimmedNonEmptyString),
  data: Schema.optional(Schema.Unknown),
});
export type WebSocketError = typeof WebSocketError.Type;

export const WebSocketResponse = Schema.Struct({
  id: TrimmedNonEmptyString,
  result: Schema.optional(Schema.Unknown),
  error: Schema.optional(WebSocketError),
});
export type WebSocketResponse = typeof WebSocketResponse.Type;

export const WsPushSequence = NonNegativeInt;
export type WsPushSequence = typeof WsPushSequence.Type;

export const WsWelcomePayload = Schema.Struct({
  cwd: TrimmedNonEmptyString,
  projectName: TrimmedNonEmptyString,
  bootstrapProjectId: Schema.optional(ProjectId),
  bootstrapThreadId: Schema.optional(ThreadId),
});
export type WsWelcomePayload = typeof WsWelcomePayload.Type;

export interface WsPushPayloadByChannel {
  readonly [WS_CHANNELS.serverWelcome]: WsWelcomePayload;
  readonly [WS_CHANNELS.serverConfigUpdated]: typeof ServerConfigUpdatedPayload.Type;
  readonly [WS_CHANNELS.gitActionProgress]: typeof GitActionProgressEvent.Type;
  readonly [WS_CHANNELS.prReviewSyncUpdated]: typeof PrReviewSyncUpdatedPayload.Type;
  readonly [WS_CHANNELS.prReviewRepoConfigUpdated]: typeof PrReviewRepoConfigUpdatedPayload.Type;
  readonly [WS_CHANNELS.terminalEvent]: typeof TerminalEvent.Type;
  readonly [ORCHESTRATION_WS_CHANNELS.domainEvent]: OrchestrationEvent;
}

export type WsPushChannel = keyof WsPushPayloadByChannel;
export type WsPushData<C extends WsPushChannel> = WsPushPayloadByChannel[C];

const makeWsPushSchema = <const Channel extends string, Payload extends Schema.Schema<any>>(
  channel: Channel,
  payload: Payload,
) =>
  Schema.Struct({
    type: Schema.Literal("push"),
    sequence: WsPushSequence,
    channel: Schema.Literal(channel),
    data: payload,
  });

export const WsPushServerWelcome = makeWsPushSchema(WS_CHANNELS.serverWelcome, WsWelcomePayload);
export const WsPushServerConfigUpdated = makeWsPushSchema(
  WS_CHANNELS.serverConfigUpdated,
  ServerConfigUpdatedPayload,
);
export const WsPushGitActionProgress = makeWsPushSchema(
  WS_CHANNELS.gitActionProgress,
  GitActionProgressEvent,
);
export const WsPushPrReviewSyncUpdated = makeWsPushSchema(
  WS_CHANNELS.prReviewSyncUpdated,
  PrReviewSyncUpdatedPayload,
);
export const WsPushPrReviewRepoConfigUpdated = makeWsPushSchema(
  WS_CHANNELS.prReviewRepoConfigUpdated,
  PrReviewRepoConfigUpdatedPayload,
);
export const WsPushTerminalEvent = makeWsPushSchema(WS_CHANNELS.terminalEvent, TerminalEvent);
export const WsPushOrchestrationDomainEvent = makeWsPushSchema(
  ORCHESTRATION_WS_CHANNELS.domainEvent,
  OrchestrationEvent,
);

export const WsPushChannelSchema = Schema.Literals([
  WS_CHANNELS.gitActionProgress,
  WS_CHANNELS.prReviewSyncUpdated,
  WS_CHANNELS.prReviewRepoConfigUpdated,
  WS_CHANNELS.serverWelcome,
  WS_CHANNELS.serverConfigUpdated,
  WS_CHANNELS.terminalEvent,
  ORCHESTRATION_WS_CHANNELS.domainEvent,
]);
export type WsPushChannelSchema = typeof WsPushChannelSchema.Type;

export const WsPush = Schema.Union([
  WsPushServerWelcome,
  WsPushServerConfigUpdated,
  WsPushGitActionProgress,
  WsPushPrReviewSyncUpdated,
  WsPushPrReviewRepoConfigUpdated,
  WsPushTerminalEvent,
  WsPushOrchestrationDomainEvent,
]);
export type WsPush = typeof WsPush.Type;

export type WsPushMessage<C extends WsPushChannel> = Extract<WsPush, { channel: C }>;

export const WsPushEnvelopeBase = Schema.Struct({
  type: Schema.Literal("push"),
  sequence: WsPushSequence,
  channel: WsPushChannelSchema,
  data: Schema.Unknown,
});
export type WsPushEnvelopeBase = typeof WsPushEnvelopeBase.Type;

// ── Union of all server → client messages ─────────────────────────────

export const WsResponse = Schema.Union([WebSocketResponse, WsPush]);
export type WsResponse = typeof WsResponse.Type;
