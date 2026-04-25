import {
  type GitActionProgressEvent,
  ORCHESTRATION_WS_CHANNELS,
  ORCHESTRATION_WS_METHODS,
  type ContextMenuItem,
  type NativeApi,
  type ProjectFileTreeChangedPayload,
  type PrReviewRepoConfigUpdatedPayload,
  type PrReviewSyncUpdatedPayload,
  ServerConfigUpdatedPayload,
  WS_CHANNELS,
  WS_METHODS,
  type WsWelcomePayload,
} from "@okcode/contracts";

import { showContextMenuFallback } from "./contextMenuFallback";
import { initMobileNotifications } from "./lib/mobileNotifications";
import { type ConnectionMetrics, type TransportState, WsTransport } from "./wsTransport";

let instance: { api: NativeApi; transport: WsTransport } | null = null;
const welcomeListeners = new Set<(payload: WsWelcomePayload) => void>();
const serverConfigUpdatedListeners = new Set<(payload: ServerConfigUpdatedPayload) => void>();
const gitActionProgressListeners = new Set<(payload: GitActionProgressEvent) => void>();
const prReviewSyncUpdatedListeners = new Set<(payload: PrReviewSyncUpdatedPayload) => void>();
const prReviewRepoConfigUpdatedListeners = new Set<
  (payload: PrReviewRepoConfigUpdatedPayload) => void
>();
const projectFileTreeChangedListeners = new Set<(payload: ProjectFileTreeChangedPayload) => void>();
const transportStateListeners = new Set<(state: TransportState) => void>();
const pendingReconnectedListeners = new Set<() => void>();
const activeReconnectedUnsubscribers = new Map<() => void, () => void>();

function registerDeferredReconnectedListeners(transport: WsTransport): void {
  for (const listener of pendingReconnectedListeners) {
    if (activeReconnectedUnsubscribers.has(listener)) {
      continue;
    }
    activeReconnectedUnsubscribers.set(listener, transport.onReconnected(listener));
  }
}

/**
 * Subscribe to the server welcome message. If a welcome was already received
 * before this call, the listener fires synchronously with the cached payload.
 * This avoids the race between WebSocket connect and React effect registration.
 */
export function onServerWelcome(listener: (payload: WsWelcomePayload) => void): () => void {
  welcomeListeners.add(listener);

  const latestWelcome = instance?.transport.getLatestPush(WS_CHANNELS.serverWelcome)?.data ?? null;
  if (latestWelcome) {
    try {
      listener(latestWelcome);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    welcomeListeners.delete(listener);
  };
}

/**
 * Subscribe to server config update events. Replays the latest update for
 * late subscribers to avoid missing config validation feedback.
 */
export function onServerConfigUpdated(
  listener: (payload: ServerConfigUpdatedPayload) => void,
): () => void {
  serverConfigUpdatedListeners.add(listener);

  const latestConfig =
    instance?.transport.getLatestPush(WS_CHANNELS.serverConfigUpdated)?.data ?? null;
  if (latestConfig) {
    try {
      listener(latestConfig);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    serverConfigUpdatedListeners.delete(listener);
  };
}

export function onTransportStateChange(listener: (state: TransportState) => void): () => void {
  transportStateListeners.add(listener);

  const latestState = instance?.transport.getState();
  if (latestState) {
    try {
      listener(latestState);
    } catch {
      // Swallow listener errors
    }
  }

  return () => {
    transportStateListeners.delete(listener);
  };
}

/**
 * Read-only snapshot of the current transport state.
 * Returns "connecting" until the transport is initialised.
 */
export function getTransportStateSnapshot(): TransportState {
  return instance?.transport.getState() ?? "connecting";
}

/**
 * Read-only snapshot of transport connection metrics.
 * Returns null if the transport is not initialised yet.
 */
export function getTransportMetrics(): ConnectionMetrics | null {
  return instance?.transport.getMetrics() ?? null;
}

/**
 * Subscribe to reconnection events. The listener fires each time the
 * WebSocket re-opens after a prior successful connection (not on the
 * initial connect). This is the primary hook for triggering data
 * re-synchronisation after a network interruption.
 */
export function onTransportReconnected(listener: () => void): () => void {
  if (instance) {
    return instance.transport.onReconnected(listener);
  }

  pendingReconnectedListeners.add(listener);
  return () => {
    pendingReconnectedListeners.delete(listener);
    const unsubscribe = activeReconnectedUnsubscribers.get(listener);
    if (unsubscribe) {
      activeReconnectedUnsubscribers.delete(listener);
      unsubscribe();
    }
  };
}

export function createWsNativeApi(): NativeApi {
  if (instance) return instance.api;

  const transport = new WsTransport();
  registerDeferredReconnectedListeners(transport);

  // Initialize mobile push notifications when running in the mobile shell.
  initMobileNotifications(transport);

  transport.subscribeState((state) => {
    for (const listener of transportStateListeners) {
      try {
        listener(state);
      } catch {
        // Swallow listener errors
      }
    }
  });

  transport.subscribe(WS_CHANNELS.serverWelcome, (message) => {
    const payload = message.data;
    for (const listener of welcomeListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.serverConfigUpdated, (message) => {
    const payload = message.data;
    for (const listener of serverConfigUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.gitActionProgress, (message) => {
    const payload = message.data;
    for (const listener of gitActionProgressListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.prReviewSyncUpdated, (message) => {
    const payload = message.data;
    for (const listener of prReviewSyncUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.prReviewRepoConfigUpdated, (message) => {
    const payload = message.data;
    for (const listener of prReviewRepoConfigUpdatedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  transport.subscribe(WS_CHANNELS.projectFileTreeChanged, (message) => {
    const payload = message.data;
    for (const listener of projectFileTreeChangedListeners) {
      try {
        listener(payload);
      } catch {
        // Swallow listener errors
      }
    }
  });
  const api: NativeApi = {
    dialogs: {
      pickFolder: async () => {
        if (window.desktopBridge) {
          return window.desktopBridge.pickFolder();
        }
        const result = await transport.request<{ path: string | null }>(
          WS_METHODS.serverPickFolder,
          undefined,
          { timeoutMs: null },
        );
        return result?.path ?? null;
      },
      confirm: async (message) => {
        if (window.desktopBridge) {
          return window.desktopBridge.confirm(message);
        }
        return window.confirm(message);
      },
    },
    terminal: {
      open: (input) => transport.request(WS_METHODS.terminalOpen, input),
      write: (input) => transport.request(WS_METHODS.terminalWrite, input),
      resize: (input) => transport.request(WS_METHODS.terminalResize, input),
      clear: (input) => transport.request(WS_METHODS.terminalClear, input),
      restart: (input) => transport.request(WS_METHODS.terminalRestart, input),
      close: (input) => transport.request(WS_METHODS.terminalClose, input),
      onEvent: (callback) =>
        transport.subscribe(WS_CHANNELS.terminalEvent, (message) => callback(message.data)),
    },
    projects: {
      searchEntries: (input) => transport.request(WS_METHODS.projectsSearchEntries, input),
      listDirectory: (input) => transport.request(WS_METHODS.projectsListDirectory, input),
      writeFile: (input) => transport.request(WS_METHODS.projectsWriteFile, input),
      readFile: (input) => transport.request(WS_METHODS.projectsReadFile, input),
      deleteEntry: (input) => transport.request(WS_METHODS.projectsDeleteEntry, input),
      pathExists: (input) => transport.request(WS_METHODS.projectsPathExists, input),
      onFileTreeChanged: (callback) => {
        projectFileTreeChangedListeners.add(callback);
        return () => {
          projectFileTreeChangedListeners.delete(callback);
        };
      },
    },
    shell: {
      openInEditor: (cwd, editor) =>
        transport.request(WS_METHODS.shellOpenInEditor, { cwd, editor }),
      openInFileManager: (path) => transport.request(WS_METHODS.shellOpenInFileManager, { path }),
      revealInFileManager: (path) =>
        transport.request(WS_METHODS.shellRevealInFileManager, { path }),
      openExternal: async (url) => {
        if (window.desktopBridge) {
          const opened = await window.desktopBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        if (window.mobileBridge) {
          const opened = await window.mobileBridge.openExternal(url);
          if (!opened) {
            throw new Error("Unable to open link.");
          }
          return;
        }

        // Some mobile browsers can return null here even when the tab opens.
        // Avoid false negatives and let the browser handle popup policy.
        window.open(url, "_blank", "noopener,noreferrer");
      },
    },
    git: {
      cloneRepository: (input) =>
        transport.request(WS_METHODS.gitCloneRepository, input, { timeoutMs: null }),
      pull: (input) => transport.request(WS_METHODS.gitPull, input),
      stopAction: (input) => transport.request(WS_METHODS.gitStopAction, input),
      status: (input) => transport.request(WS_METHODS.gitStatus, input),
      runStackedAction: (input) =>
        transport.request(WS_METHODS.gitRunStackedAction, input, { timeoutMs: null }),
      listBranches: (input) => transport.request(WS_METHODS.gitListBranches, input),
      createWorktree: (input) => transport.request(WS_METHODS.gitCreateWorktree, input),
      removeWorktree: (input) => transport.request(WS_METHODS.gitRemoveWorktree, input),
      pruneWorktrees: (input) => transport.request(WS_METHODS.gitPruneWorktrees, input),
      createBranch: (input) => transport.request(WS_METHODS.gitCreateBranch, input),
      checkout: (input) => transport.request(WS_METHODS.gitCheckout, input),
      init: (input) => transport.request(WS_METHODS.gitInit, input),
      resolvePullRequest: (input) => transport.request(WS_METHODS.gitResolvePullRequest, input),
      listPullRequests: (input) => transport.request(WS_METHODS.gitListPullRequests, input),
      listMergedWorktreeCleanupCandidates: (input) =>
        transport.request(WS_METHODS.gitListMergedWorktreeCleanupCandidates, input),
      preparePullRequestThread: (input) =>
        transport.request(WS_METHODS.gitPreparePullRequestThread, input),
      onActionProgress: (callback) => {
        gitActionProgressListeners.add(callback);
        return () => {
          gitActionProgressListeners.delete(callback);
        };
      },
    },
    github: {
      listIssues: (input) => transport.request(WS_METHODS.githubListIssues, input),
      getIssue: (input) => transport.request(WS_METHODS.githubGetIssue, input),
      postComment: (input) => transport.request(WS_METHODS.githubPostComment, input),
    },
    prReview: {
      getConfig: (input) => transport.request(WS_METHODS.prReviewGetConfig, input),
      getDashboard: (input) => transport.request(WS_METHODS.prReviewGetDashboard, input),
      getPatch: (input) => transport.request(WS_METHODS.prReviewGetPatch, input),
      addThread: (input) => transport.request(WS_METHODS.prReviewAddThread, input),
      replyToThread: (input) => transport.request(WS_METHODS.prReviewReplyToThread, input),
      resolveThread: (input) => transport.request(WS_METHODS.prReviewResolveThread, input),
      unresolveThread: (input) => transport.request(WS_METHODS.prReviewUnresolveThread, input),
      searchUsers: (input) => transport.request(WS_METHODS.prReviewSearchUsers, input),
      getUserPreview: (input) => transport.request(WS_METHODS.prReviewGetUserPreview, input),
      analyzeConflicts: (input) => transport.request(WS_METHODS.prReviewAnalyzeConflicts, input),
      applyConflictResolution: (input) =>
        transport.request(WS_METHODS.prReviewApplyConflictResolution, input),
      runWorkflowStep: (input) => transport.request(WS_METHODS.prReviewRunWorkflowStep, input),
      submitReview: (input) => transport.request(WS_METHODS.prReviewSubmitReview, input),
      onSyncUpdated: (callback) => {
        prReviewSyncUpdatedListeners.add(callback);
        return () => {
          prReviewSyncUpdatedListeners.delete(callback);
        };
      },
      onRepoConfigUpdated: (callback) => {
        prReviewRepoConfigUpdatedListeners.add(callback);
        return () => {
          prReviewRepoConfigUpdatedListeners.delete(callback);
        };
      },
    },
    skills: {
      list: (input) => transport.request(WS_METHODS.skillList, input ?? {}),
      catalog: (input) => transport.request(WS_METHODS.skillCatalog, input ?? {}),
      read: (input) => transport.request(WS_METHODS.skillRead, input),
      create: (input) => transport.request(WS_METHODS.skillCreate, input),
      delete: (input) => transport.request(WS_METHODS.skillDelete, input),
      install: (input) => transport.request(WS_METHODS.skillInstall, input),
      uninstall: (input) => transport.request(WS_METHODS.skillUninstall, input),
      import: (input) => transport.request(WS_METHODS.skillImport, input),
      search: (input) => transport.request(WS_METHODS.skillSearch, input),
    },
    contextMenu: {
      show: async <T extends string>(
        items: readonly ContextMenuItem<T>[],
        position?: { x: number; y: number },
      ): Promise<T | null> => {
        if (window.desktopBridge) {
          // Don't pass explicit coordinates to the native Electron menu.
          // Let Menu.popup() use the current mouse cursor position, which
          // Electron resolves correctly regardless of title-bar style or
          // display scaling. Passing CSS clientX/clientY can mis-position
          // the menu when the sidebar content is scrolled or when the
          // window uses titleBarStyle "hiddenInset".
          return window.desktopBridge.showContextMenu(items) as Promise<T | null>;
        }
        return showContextMenuFallback(items, position);
      },
    },
    server: {
      getConfig: () => transport.request(WS_METHODS.serverGetConfig),
      checkUpdate: () => transport.request(WS_METHODS.serverCheckUpdate),
      ping: () => transport.request(WS_METHODS.serverPing),
      getGlobalEnvironmentVariables: () =>
        transport.request(WS_METHODS.serverGetGlobalEnvironmentVariables),
      saveGlobalEnvironmentVariables: (input) =>
        transport.request(WS_METHODS.serverSaveGlobalEnvironmentVariables, input),
      getProjectEnvironmentVariables: (input) =>
        transport.request(WS_METHODS.serverGetProjectEnvironmentVariables, input),
      saveProjectEnvironmentVariables: (input) =>
        transport.request(WS_METHODS.serverSaveProjectEnvironmentVariables, input),
      upsertKeybinding: (input) => transport.request(WS_METHODS.serverUpsertKeybinding, input),
      getOpenclawGatewayConfig: () => transport.request(WS_METHODS.serverGetOpenclawGatewayConfig),
      saveOpenclawGatewayConfig: (input) =>
        transport.request(WS_METHODS.serverSaveOpenclawGatewayConfig, input),
      resetOpenclawGatewayDeviceState: (input) =>
        transport.request(WS_METHODS.serverResetOpenclawGatewayDeviceState, input),
      replaceKeybindingRules: (input) =>
        transport.request(WS_METHODS.serverReplaceKeybindingRules, input),
      testOpenclawGateway: (input) =>
        transport.request(WS_METHODS.serverTestOpenclawGateway, input),
    },
    orchestration: {
      getSnapshot: () => transport.request(ORCHESTRATION_WS_METHODS.getSnapshot),
      getThreadDetail: (input) =>
        transport.request(ORCHESTRATION_WS_METHODS.getThreadDetail, input),
      dispatchCommand: (command) =>
        transport.request(ORCHESTRATION_WS_METHODS.dispatchCommand, { command }),
      getTurnDiff: (input) => transport.request(ORCHESTRATION_WS_METHODS.getTurnDiff, input),
      getFullThreadDiff: (input) =>
        transport.request(ORCHESTRATION_WS_METHODS.getFullThreadDiff, input),
      replayEvents: (fromSequenceExclusive) =>
        transport.request(ORCHESTRATION_WS_METHODS.replayEvents, { fromSequenceExclusive }),
      onDomainEvent: (callback) =>
        transport.subscribe(ORCHESTRATION_WS_CHANNELS.domainEvent, (message) =>
          callback(message.data),
        ),
    },
  };

  instance = { api, transport };
  return api;
}
