import type {
  GitCheckoutInput,
  GitActionProgressEvent,
  GitCloneRepositoryInput,
  GitCloneRepositoryResult,
  GitCreateBranchInput,
  GitPreparePullRequestThreadInput,
  GitPreparePullRequestThreadResult,
  GitPullRequestRefInput,
  GitCreateWorktreeInput,
  GitCreateWorktreeResult,
  GitInitInput,
  GitListBranchesInput,
  GitListBranchesResult,
  GitListPullRequestsInput,
  GitListPullRequestsResult,
  GitPullInput,
  GitPullResult,
  GitRemoveWorktreeInput,
  GitResolvePullRequestResult,
  GitRunStackedActionInput,
  GitRunStackedActionResult,
  GitStatusInput,
  GitStatusResult,
} from "./git";
import type {
  ProjectListDirectoryInput,
  ProjectListDirectoryResult,
  ProjectReadFileInput,
  ProjectReadFileResult,
  ProjectSearchEntriesInput,
  ProjectSearchEntriesResult,
  ProjectWriteFileInput,
  ProjectWriteFileResult,
} from "./project";
import type {
  GitHubUserPreview,
  PrConflictAnalysis,
  PrConflictApplyResult,
  PrReviewApplyConflictResolutionInput,
  PrReviewAddThreadInput,
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
import type { ServerConfig } from "./server";
import type {
  GlobalEnvironmentVariablesResult,
  ProjectEnvironmentVariablesInput,
  ProjectEnvironmentVariablesResult,
  SaveGlobalEnvironmentVariablesInput,
  SaveProjectEnvironmentVariablesInput,
} from "./environment";
import type {
  TerminalClearInput,
  TerminalCloseInput,
  TerminalEvent,
  TerminalOpenInput,
  TerminalResizeInput,
  TerminalRestartInput,
  TerminalSessionSnapshot,
  TerminalWriteInput,
} from "./terminal";
import type {
  ServerUpsertKeybindingInput,
  ServerUpsertKeybindingResult,
  ServerUpdateInfo,
} from "./server";
import type {
  SkillListInput,
  SkillListResult,
  SkillReadInput,
  SkillReadResult,
  SkillCatalogInput,
  SkillCatalogResult,
  SkillCreateInput,
  SkillCreateResult,
  SkillDeleteInput,
  SkillInstallInput,
  SkillInstallResult,
  SkillImportInput,
  SkillImportResult,
  SkillSearchInput,
  SkillSearchResult,
  SkillUninstallInput,
} from "./skill";
import type {
  ClientOrchestrationCommand,
  OrchestrationGetFullThreadDiffInput,
  OrchestrationGetFullThreadDiffResult,
  OrchestrationGetTurnDiffInput,
  OrchestrationGetTurnDiffResult,
  OrchestrationEvent,
  OrchestrationReadModel,
} from "./orchestration";
import { EditorId } from "./editor";

export interface ContextMenuItem<T extends string = string> {
  id: T;
  label: string;
  destructive?: boolean;
}

export type DesktopUpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

export type DesktopRuntimeArch = "arm64" | "x64" | "other";
export type DesktopTheme = "light" | "dark" | "system";

export interface DesktopRuntimeInfo {
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
}

export interface DesktopUpdateState {
  enabled: boolean;
  status: DesktopUpdateStatus;
  currentVersion: string;
  hostArch: DesktopRuntimeArch;
  appArch: DesktopRuntimeArch;
  runningUnderArm64Translation: boolean;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

export interface DesktopUpdateActionResult {
  accepted: boolean;
  completed: boolean;
  state: DesktopUpdateState;
}

export type DesktopPreviewStatus = "closed" | "loading" | "ready" | "error";
export type DesktopPreviewErrorCode =
  | "invalid-url"
  | "non-local-url"
  | "load-failed"
  | "process-gone";

export interface DesktopPreviewError {
  code: DesktopPreviewErrorCode;
  message: string;
}

export interface DesktopPreviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  viewportWidth: number;
  viewportHeight: number;
}

export type PreviewTabId = string;

export interface PreviewTabState {
  tabId: PreviewTabId;
  status: DesktopPreviewStatus;
  url: string | null;
  title: string | null;
  error: DesktopPreviewError | null;
  canGoBack: boolean;
  canGoForward: boolean;
  devToolsOpen: boolean;
}

export interface PreviewTabsState {
  tabs: PreviewTabState[];
  activeTabId: PreviewTabId | null;
  visible: boolean;
}

/** @deprecated Use PreviewTabsState instead */
export interface DesktopPreviewState {
  status: DesktopPreviewStatus;
  url: string | null;
  title: string | null;
  visible: boolean;
  error: DesktopPreviewError | null;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface PreviewCreateTabResult {
  tabId: PreviewTabId;
  state: PreviewTabsState;
}

export interface PreviewNavigateResult {
  accepted: boolean;
  state: PreviewTabsState;
}

export interface DesktopBridge {
  getWsUrl: () => string | null;
  pickFolder: () => Promise<string | null>;
  confirm: (message: string) => Promise<boolean>;
  setTheme: (theme: DesktopTheme) => Promise<void>;
  setWindowOpacity: (opacity: number) => Promise<void>;
  setSidebarOpacity: (opacity: number) => Promise<void>;
  showContextMenu: <T extends string>(
    items: readonly ContextMenuItem<T>[],
    position?: { x: number; y: number },
  ) => Promise<T | null>;
  openExternal: (url: string) => Promise<boolean>;
  onMenuAction: (listener: (action: string) => void) => () => void;
  getUpdateState: () => Promise<DesktopUpdateState>;
  downloadUpdate: () => Promise<DesktopUpdateActionResult>;
  installUpdate: () => Promise<DesktopUpdateActionResult>;
  onUpdateState: (listener: (state: DesktopUpdateState) => void) => () => void;
  preview: {
    createTab: (input: { url: string; title?: string | null }) => Promise<PreviewCreateTabResult>;
    closeTab: (input: { tabId: PreviewTabId }) => Promise<PreviewTabsState>;
    activateTab: (input: { tabId: PreviewTabId }) => Promise<PreviewTabsState>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    reload: () => Promise<void>;
    navigate: (input: { url: string }) => Promise<PreviewNavigateResult>;
    toggleDevTools: () => Promise<void>;
    setBounds: (bounds: DesktopPreviewBounds) => Promise<void>;
    closeAll: () => Promise<void>;
    getState: () => Promise<PreviewTabsState>;
    onState: (listener: (state: PreviewTabsState) => void) => () => void;
  };
}

export interface MobilePairingState {
  paired: boolean;
  serverUrl: string | null;
  tokenPresent: boolean;
  lastError: string | null;
}

export interface MobileBridge {
  getWsUrl: () => string | null;
  getPairingState: () => Promise<MobilePairingState>;
  applyPairingUrl: (input: string) => Promise<MobilePairingState>;
  clearPairing: () => Promise<MobilePairingState>;
  openExternal: (url: string) => Promise<boolean>;
  onPairingState: (listener: (state: MobilePairingState) => void) => () => void;
}

export interface NativeApi {
  dialogs: {
    pickFolder: () => Promise<string | null>;
    confirm: (message: string) => Promise<boolean>;
  };
  terminal: {
    open: (input: TerminalOpenInput) => Promise<TerminalSessionSnapshot>;
    write: (input: TerminalWriteInput) => Promise<void>;
    resize: (input: TerminalResizeInput) => Promise<void>;
    clear: (input: TerminalClearInput) => Promise<void>;
    restart: (input: TerminalRestartInput) => Promise<TerminalSessionSnapshot>;
    close: (input: TerminalCloseInput) => Promise<void>;
    onEvent: (callback: (event: TerminalEvent) => void) => () => void;
  };
  projects: {
    searchEntries: (input: ProjectSearchEntriesInput) => Promise<ProjectSearchEntriesResult>;
    listDirectory: (input: ProjectListDirectoryInput) => Promise<ProjectListDirectoryResult>;
    writeFile: (input: ProjectWriteFileInput) => Promise<ProjectWriteFileResult>;
    readFile: (input: ProjectReadFileInput) => Promise<ProjectReadFileResult>;
  };
  shell: {
    openInEditor: (cwd: string, editor: EditorId) => Promise<void>;
    openExternal: (url: string) => Promise<void>;
  };
  git: {
    // Clone
    cloneRepository: (input: GitCloneRepositoryInput) => Promise<GitCloneRepositoryResult>;
    // Existing branch/worktree API
    listBranches: (input: GitListBranchesInput) => Promise<GitListBranchesResult>;
    createWorktree: (input: GitCreateWorktreeInput) => Promise<GitCreateWorktreeResult>;
    removeWorktree: (input: GitRemoveWorktreeInput) => Promise<void>;
    createBranch: (input: GitCreateBranchInput) => Promise<void>;
    checkout: (input: GitCheckoutInput) => Promise<void>;
    init: (input: GitInitInput) => Promise<void>;
    resolvePullRequest: (input: GitPullRequestRefInput) => Promise<GitResolvePullRequestResult>;
    listPullRequests: (input: GitListPullRequestsInput) => Promise<GitListPullRequestsResult>;
    preparePullRequestThread: (
      input: GitPreparePullRequestThreadInput,
    ) => Promise<GitPreparePullRequestThreadResult>;
    // Stacked action API
    pull: (input: GitPullInput) => Promise<GitPullResult>;
    status: (input: GitStatusInput) => Promise<GitStatusResult>;
    runStackedAction: (input: GitRunStackedActionInput) => Promise<GitRunStackedActionResult>;
    onActionProgress: (callback: (event: GitActionProgressEvent) => void) => () => void;
  };
  prReview: {
    getConfig: (input: PrReviewConfigInput) => Promise<PrReviewConfig>;
    getDashboard: (input: PrReviewDashboardInput) => Promise<PrReviewDashboardResult>;
    getPatch: (input: PrReviewPatchInput) => Promise<PrReviewPatchResult>;
    addThread: (input: PrReviewAddThreadInput) => Promise<PrReviewDashboardResult>;
    replyToThread: (input: PrReviewReplyToThreadInput) => Promise<PrReviewDashboardResult>;
    resolveThread: (input: PrReviewResolveThreadInput) => Promise<PrReviewDashboardResult>;
    unresolveThread: (input: PrReviewResolveThreadInput) => Promise<PrReviewDashboardResult>;
    searchUsers: (input: PrReviewSearchUsersInput) => Promise<PrReviewSearchUsersResult>;
    getUserPreview: (input: PrReviewUserPreviewInput) => Promise<GitHubUserPreview>;
    analyzeConflicts: (input: PrReviewDashboardInput) => Promise<PrConflictAnalysis>;
    applyConflictResolution: (
      input: PrReviewApplyConflictResolutionInput,
    ) => Promise<PrConflictApplyResult>;
    runWorkflowStep: (input: PrReviewRunWorkflowStepInput) => Promise<PrWorkflowStepRunResult>;
    submitReview: (input: PrSubmitReviewInput) => Promise<PrSubmitReviewResult>;
    onSyncUpdated: (callback: (payload: PrReviewSyncUpdatedPayload) => void) => () => void;
    onRepoConfigUpdated: (
      callback: (payload: PrReviewRepoConfigUpdatedPayload) => void,
    ) => () => void;
  };
  skills: {
    list: (input?: SkillListInput) => Promise<SkillListResult>;
    catalog: (input?: SkillCatalogInput) => Promise<SkillCatalogResult>;
    read: (input: SkillReadInput) => Promise<SkillReadResult>;
    create: (input: SkillCreateInput) => Promise<SkillCreateResult>;
    delete: (input: SkillDeleteInput) => Promise<void>;
    install: (input: SkillInstallInput) => Promise<SkillInstallResult>;
    uninstall: (input: SkillUninstallInput) => Promise<void>;
    import: (input: SkillImportInput) => Promise<SkillImportResult>;
    search: (input: SkillSearchInput) => Promise<SkillSearchResult>;
  };
  contextMenu: {
    show: <T extends string>(
      items: readonly ContextMenuItem<T>[],
      position?: { x: number; y: number },
    ) => Promise<T | null>;
  };
  server: {
    getConfig: () => Promise<ServerConfig>;
    checkUpdate: () => Promise<ServerUpdateInfo>;
    getGlobalEnvironmentVariables: () => Promise<GlobalEnvironmentVariablesResult>;
    saveGlobalEnvironmentVariables: (
      input: SaveGlobalEnvironmentVariablesInput,
    ) => Promise<GlobalEnvironmentVariablesResult>;
    getProjectEnvironmentVariables: (
      input: ProjectEnvironmentVariablesInput,
    ) => Promise<ProjectEnvironmentVariablesResult>;
    saveProjectEnvironmentVariables: (
      input: SaveProjectEnvironmentVariablesInput,
    ) => Promise<ProjectEnvironmentVariablesResult>;
    upsertKeybinding: (input: ServerUpsertKeybindingInput) => Promise<ServerUpsertKeybindingResult>;
  };
  orchestration: {
    getSnapshot: () => Promise<OrchestrationReadModel>;
    dispatchCommand: (command: ClientOrchestrationCommand) => Promise<{ sequence: number }>;
    getTurnDiff: (input: OrchestrationGetTurnDiffInput) => Promise<OrchestrationGetTurnDiffResult>;
    getFullThreadDiff: (
      input: OrchestrationGetFullThreadDiffInput,
    ) => Promise<OrchestrationGetFullThreadDiffResult>;
    replayEvents: (fromSequenceExclusive: number) => Promise<OrchestrationEvent[]>;
    onDomainEvent: (callback: (event: OrchestrationEvent) => void) => () => void;
  };
}
