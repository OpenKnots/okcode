import {
  type ApprovalRequestId,
  DEFAULT_CHAT_FILE_MIME_TYPE,
  DEFAULT_MODEL_BY_PROVIDER,
  type ClaudeCodeEffort,
  type GitHubIssueDetail,
  type GitHubRef,
  type MessageId,
  type ProjectScript,
  type ModelSlug,
  type ProviderKind,
  type ProjectEntry,
  type ProjectId,
  type ProviderApprovalDecision,
  PROVIDER_SEND_TURN_MAX_ATTACHMENTS,
  PROVIDER_SEND_TURN_MAX_FILE_BYTES,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  type ResolvedKeybindingsConfig,
  type ServerProviderStatus,
  type ThreadId,
  type TurnId,
  type KeybindingCommand,
  OrchestrationThreadActivity,
  ProviderInteractionMode,
  RuntimeMode,
} from "@okcode/contracts";
import {
  applyClaudePromptEffortPrefix,
  getDefaultModel,
  normalizeModelSlug,
  resolveModelSlugForProvider,
} from "@okcode/shared/model";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useNavigate } from "@tanstack/react-router";
import { gitBranchesQueryOptions, gitCreateWorktreeMutationOptions } from "~/lib/gitReactQuery";
import { projectSearchEntriesQueryOptions } from "~/lib/projectReactQuery";
import {
  skillCatalogQueryOptions,
  skillListQueryOptions,
  skillQueryKeys,
} from "~/lib/skillReactQuery";
import { serverConfigQueryOptions, serverQueryKeys } from "~/lib/serverReactQuery";
import { isElectron } from "../env";
import { openFileReference } from "../fileOpen";
import {
  clampCollapsedComposerCursor,
  type ComposerTrigger,
  collapseExpandedComposerCursor,
  detectComposerTrigger,
  expandCollapsedComposerCursor,
  parseSkillManagementCommand,
  parseStandaloneComposerSlashCommand,
  replaceTextRange,
} from "../composer-logic";
import {
  derivePendingApprovals,
  derivePendingUserInputs,
  derivePhase,
  deriveTimelineEntries,
  deriveActiveWorkStartedAt,
  deriveActivePlanState,
  findSidebarProposedPlan,
  findLatestProposedPlan,
  deriveWorkLogEntries,
  hasActionableProposedPlan,
  hasToolActivityForTurn,
  isLatestTurnSettled,
  formatElapsed,
} from "../session-logic";
import { isScrollContainerNearBottom } from "../chat-scroll";
import {
  buildPendingUserInputAnswers,
  derivePendingUserInputProgress,
  setPendingUserInputCustomAnswer,
  type PendingUserInputDraftAnswer,
} from "../pendingUserInput";
import { useStore } from "../store";
import {
  buildPlanImplementationThreadTitle,
  buildPlanImplementationPrompt,
  proposedPlanTitle,
  resolvePlanFollowUpSubmission,
} from "../proposedPlan";
import { truncateTitle } from "../truncateTitle";
import {
  DEFAULT_INTERACTION_MODE,
  DEFAULT_RUNTIME_MODE,
  DEFAULT_THREAD_TERMINAL_ID,
  MAX_TERMINALS_PER_GROUP,
  type ChatMessage,
  type TurnDiffSummary,
} from "../types";
import { basenameOfPath } from "../vscode-icons";
import { useTheme } from "../hooks/useTheme";
import { useTurnDiffSummaries } from "../hooks/useTurnDiffSummaries";
import BranchToolbar from "./BranchToolbar";
import { resolveShortcutCommand, shortcutLabelForCommand } from "../keybindings";
import { buildChatShortcutGuides } from "~/lib/chatShortcutGuidance";
import { dispatchGitPullRequestAction } from "~/lib/gitPullRequestAction";
import PlanSidebar from "./PlanSidebar";
import ThreadTerminalDrawer from "./ThreadTerminalDrawer";
import {
  AtSignIcon,
  BotIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ListTodoIcon,
  LockIcon,
  LockOpenIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import PromptEnhancer from "./PromptEnhancer";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ensureNativeApi } from "../nativeApi";
import { Separator } from "./ui/separator";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "./ui/menu";
import { cn, randomUUID } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";
import { toastManager } from "./ui/toast";
import { decodeProjectScriptKeybindingRule } from "~/lib/projectScriptKeybindings";
import { type NewProjectScriptInput } from "./ProjectScriptsControl";
import {
  commandForProjectScript,
  interpolateProjectScriptCommand,
  nextProjectScriptId,
  projectScriptCwd,
  projectScriptTemplateInputLabel,
  projectScriptTemplateInputs,
  projectScriptRuntimeEnv,
  projectScriptIdFromCommand,
  setupProjectScript,
} from "~/projectScripts";
import { type ProjectScriptDraft, materializeProjectScripts } from "~/projectScriptDefaults";
import { newCommandId, newMessageId, newThreadId } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import {
  getCustomModelOptionsByProvider,
  getCustomModelsByProvider,
  getProviderStartOptions,
  resolveAppModelSelection,
  useAppSettings,
} from "../appSettings";
import { isTerminalFocused } from "../lib/terminalFocus";
import {
  type ComposerAttachment,
  type DraftThreadEnvMode,
  type PersistedComposerAttachment,
  useComposerDraftStore,
  useComposerThreadDraft,
} from "../composerDraftStore";
import {
  appendTerminalContextsToPrompt,
  formatTerminalContextLabel,
  insertInlineTerminalContextPlaceholder,
  removeInlineTerminalContextPlaceholder,
  type TerminalContextDraft,
  type TerminalContextSelection,
} from "../lib/terminalContext";
import { deriveLatestContextWindowSnapshot } from "../lib/contextWindow";
import { shouldUseCompactComposerFooter } from "./composerFooterLayout";
import { selectThreadTerminalState, useTerminalStateStore } from "../terminalStateStore";
import { ComposerPromptEditor, type ComposerPromptEditorHandle } from "./ComposerPromptEditor";
import { IssueThreadDialog } from "./IssueThreadDialog";
import { PullRequestThreadDialog } from "./PullRequestThreadDialog";
import { MessagesTimeline } from "./chat/MessagesTimeline";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatHomeEmptyState } from "./home/ChatHomeEmptyState";
import { useCodeViewerStore } from "~/codeViewerStore";
import { useDiffViewerStore } from "~/diffViewerStore";
import { PreviewPanel } from "./PreviewPanel";
import { ContextWindowMeter } from "./chat/ContextWindowMeter";
import { buildExpandedImagePreview, ExpandedImagePreview } from "./chat/ExpandedImagePreview";
import { AVAILABLE_PROVIDER_OPTIONS, ProviderModelPicker } from "./chat/ProviderModelPicker";
import { ComposerCommandItem, ComposerCommandMenu } from "./chat/ComposerCommandMenu";
import { ComposerPendingApprovalActions } from "./chat/ComposerPendingApprovalActions";
import { CompactComposerControlsMenu } from "./chat/CompactComposerControlsMenu";
import { ComposerPendingApprovalPanel } from "./chat/ComposerPendingApprovalPanel";
import { ComposerPendingUserInputPanel } from "./chat/ComposerPendingUserInputPanel";
import { ComposerPlanFollowUpBanner } from "./chat/ComposerPlanFollowUpBanner";
import {
  getComposerProviderState,
  renderProviderTraitsMenuContent,
  renderProviderTraitsPicker,
} from "./chat/composerProviderRegistry";
import { ProviderHealthBanner } from "./chat/ProviderHealthBanner";
import { CompanionConnectionBanner } from "./chat/CompanionConnectionBanner";
import { MobileThreadAttentionBar } from "./chat/MobileThreadAttentionBar";
import { ThreadErrorBanner } from "./chat/ThreadErrorBanner";
import {
  buildAutoSelectedWorktreeBaseBranchToastCopy,
  buildHiddenProviderInput,
  buildExpiredTerminalContextToastCopy,
  buildLocalDraftThread,
  buildTemporaryWorktreeBranchName,
  cloneComposerAttachmentForRetry,
  collectUserMessageBlobPreviewUrls,
  deriveComposerSendState,
  LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
  LastInvokedScriptByProjectSchema,
  IssueDialogState,
  PullRequestDialogState,
  QueuedMessage,
  readFileAsDataUrl,
  revokeBlobPreviewUrl,
  revokeUserMessagePreviewUrls,
  SendPhase,
} from "./ChatView.logic";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { readDesktopPreviewBridge } from "~/desktopPreview";
import { usePreviewStateStore } from "~/previewStateStore";
import { useClientMode } from "~/hooks/useClientMode";
import { useTransportState } from "~/hooks/useTransportState";
import { hasCustomThreadTitle, normalizeThreadTitle } from "~/threadTitle";
import { enhancePrompt, type PromptEnhancementId } from "../promptEnhancement";

const ATTACHMENT_PREVIEW_HANDOFF_TTL_MS = 5000;
const IMAGE_SIZE_LIMIT_LABEL = `${Math.round(PROVIDER_SEND_TURN_MAX_IMAGE_BYTES / (1024 * 1024))}MB`;
const FILE_SIZE_LIMIT_LABEL = `${Math.round(PROVIDER_SEND_TURN_MAX_FILE_BYTES / (1024 * 1024))}MB`;
const IMAGE_ONLY_BOOTSTRAP_PROMPT =
  "[User attached one or more images without additional text. Respond using the conversation context and the attached image(s).]";
const EMPTY_ACTIVITIES: OrchestrationThreadActivity[] = [];
const isAcceptedDragType = (dataTransfer: DataTransfer) =>
  dataTransfer.types.includes("Files") ||
  dataTransfer.types.includes("application/x-okcode-tree-path");

const isDragTreePath = (dataTransfer: DataTransfer) =>
  dataTransfer.types.includes("application/x-okcode-tree-path");
const SKILL_SUBCOMMAND_ITEMS: Extract<ComposerCommandItem, { type: "skill-subcommand" }>[] = [
  {
    id: "skill-sub:browse",
    type: "skill-subcommand" as const,
    subcommand: "browse",
    label: "/skill browse",
    description: "Open the skills library",
    usage: "/skill browse",
  },
  {
    id: "skill-sub:create",
    type: "skill-subcommand" as const,
    subcommand: "create",
    label: "/skill create",
    description: "Create a new skill with a guided scaffold",
    usage: "/skill create <name>",
  },
  {
    id: "skill-sub:list",
    type: "skill-subcommand" as const,
    subcommand: "list",
    label: "/skill list",
    description: "List all installed skills",
    usage: "/skill list",
  },
  {
    id: "skill-sub:search",
    type: "skill-subcommand" as const,
    subcommand: "search",
    label: "/skill search",
    description: "Search installed skills by keyword",
    usage: "/skill search <query>",
  },
  {
    id: "skill-sub:read",
    type: "skill-subcommand" as const,
    subcommand: "read",
    label: "/skill read",
    description: "View the full content of a skill",
    usage: "/skill read <name>",
  },
  {
    id: "skill-sub:install",
    type: "skill-subcommand" as const,
    subcommand: "install",
    label: "/skill install",
    description: "Install a recommended skill",
    usage: "/skill install <name>",
  },
  {
    id: "skill-sub:uninstall",
    type: "skill-subcommand" as const,
    subcommand: "uninstall",
    label: "/skill uninstall",
    description: "Remove an installed skill",
    usage: "/skill uninstall <name>",
  },
  {
    id: "skill-sub:import",
    type: "skill-subcommand" as const,
    subcommand: "import",
    label: "/skill import",
    description: "Import a skill from a local path",
    usage: "/skill import <path>",
  },
];
const EMPTY_KEYBINDINGS: ResolvedKeybindingsConfig = [];
const EMPTY_PROJECT_ENTRIES: ProjectEntry[] = [];
const EMPTY_PROVIDER_STATUSES: ServerProviderStatus[] = [];
const EMPTY_PENDING_USER_INPUT_ANSWERS: Record<string, PendingUserInputDraftAnswer> = {};

function formatOutgoingPrompt(params: {
  provider: ProviderKind;
  effort: string | null;
  text: string;
}): string {
  if (params.provider === "claudeAgent" && params.effort === "ultrathink") {
    return applyClaudePromptEffortPrefix(params.text, params.effort as ClaudeCodeEffort | null);
  }
  return params.text;
}
const COMPOSER_PATH_QUERY_DEBOUNCE_MS = 120;
const SCRIPT_TERMINAL_COLS = 120;
const SCRIPT_TERMINAL_ROWS = 30;
const PREVIEW_SPLIT_MIN_SIZE_PX = 220;
const PREVIEW_SPLIT_DEFAULT_SIZE_PX = 384;
const PREVIEW_CHAT_MIN_SIZE_PX = 360;

function composerAttachmentMimeType(file: File): string {
  return file.type.trim() || DEFAULT_CHAT_FILE_MIME_TYPE;
}

const extendReplacementRangeForTrailingSpace = (
  text: string,
  rangeEnd: number,
  replacement: string,
): number => {
  if (!replacement.endsWith(" ")) {
    return rangeEnd;
  }
  return text[rangeEnd] === " " ? rangeEnd + 1 : rangeEnd;
};

const syncTerminalContextsByIds = (
  contexts: ReadonlyArray<TerminalContextDraft>,
  ids: ReadonlyArray<string>,
): TerminalContextDraft[] => {
  const contextsById = new Map(contexts.map((context) => [context.id, context]));
  return ids.flatMap((id) => {
    const context = contextsById.get(id);
    return context ? [context] : [];
  });
};

const terminalContextIdListsEqual = (
  contexts: ReadonlyArray<TerminalContextDraft>,
  ids: ReadonlyArray<string>,
): boolean =>
  contexts.length === ids.length && contexts.every((context, index) => context.id === ids[index]);

const INTERACTION_MODE_CYCLE: readonly ProviderInteractionMode[] = ["chat", "code", "plan"];

interface ChatViewProps {
  threadId: ThreadId;
}

interface RunProjectScriptOptions {
  cwd?: string;
  env?: Record<string, string>;
  worktreePath?: string | null;
  preferNewTerminal?: boolean;
  rememberAsLastInvoked?: boolean;
}

export default function ChatView({ threadId }: ChatViewProps) {
  const clientMode = useClientMode();
  const transportState = useTransportState();
  const threads = useStore((store) => store.threads);
  const projects = useStore((store) => store.projects);
  const markThreadVisited = useStore((store) => store.markThreadVisited);
  const syncServerReadModel = useStore((store) => store.syncServerReadModel);
  const setStoreThreadError = useStore((store) => store.setError);
  const setStoreThreadBranch = useStore((store) => store.setThreadBranch);
  const setStoreThreadWorktreeBaseBranch = useStore((store) => store.setThreadWorktreeBaseBranch);
  const { settings } = useAppSettings();
  const setStickyComposerModel = useComposerDraftStore((store) => store.setStickyModel);
  const timestampFormat = settings.timestampFormat;
  const showReasoningContent = settings.showReasoningContent;
  const navigate = useNavigate();
  const activeProjectId = threads.find((t) => t.id === threadId)?.projectId ?? null;
  const previewOpen = usePreviewStateStore((state) =>
    activeProjectId ? (state.openByProjectId[activeProjectId] ?? false) : false,
  );
  const togglePreviewOpen = usePreviewStateStore((state) => state.toggleProjectOpen);
  const setPreviewOpen = usePreviewStateStore((state) => state.setProjectOpen);
  const previewDock = usePreviewStateStore((state) =>
    activeProjectId ? (state.dockByProjectId[activeProjectId] ?? "right") : "right",
  );
  const previewSize = usePreviewStateStore((state) =>
    activeProjectId
      ? (state.sizeByProjectId[activeProjectId] ?? PREVIEW_SPLIT_DEFAULT_SIZE_PX)
      : PREVIEW_SPLIT_DEFAULT_SIZE_PX,
  );
  const previewStacked = previewDock === "top" || previewDock === "bottom";
  const setPreviewDock = usePreviewStateStore((state) => state.setProjectDock);
  const togglePreviewLayout = usePreviewStateStore((state) => state.toggleProjectLayout);
  const setPreviewSize = usePreviewStateStore((state) => state.setProjectSize);
  const previewSplitRef = useRef<HTMLDivElement | null>(null);
  const previewResizeStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startSize: number;
  } | null>(null);
  const { resolvedTheme } = useTheme();
  const queryClient = useQueryClient();
  const createWorktreeMutation = useMutation(gitCreateWorktreeMutationOptions({ queryClient }));
  const composerDraft = useComposerThreadDraft(threadId);
  const prompt = composerDraft.prompt;
  const composerPromptEnhancement = composerDraft.promptEnhancement;
  const composerPromptEnhancementOriginalPrompt = composerDraft.promptEnhancementOriginalPrompt;
  const composerAttachments = composerDraft.attachments;
  const composerImageAttachments = useMemo(
    () =>
      composerAttachments.filter(
        (attachment): attachment is Extract<ComposerAttachment, { type: "image" }> =>
          attachment.type === "image",
      ),
    [composerAttachments],
  );
  const composerFileAttachments = useMemo(
    () =>
      composerAttachments.filter(
        (attachment): attachment is Extract<ComposerAttachment, { type: "file" }> =>
          attachment.type === "file",
      ),
    [composerAttachments],
  );
  const composerTerminalContexts = composerDraft.terminalContexts;
  const composerSendState = useMemo(
    () =>
      deriveComposerSendState({
        prompt,
        attachmentCount: composerAttachments.length,
        terminalContexts: composerTerminalContexts,
      }),
    [composerAttachments.length, composerTerminalContexts, prompt],
  );
  const nonPersistedComposerAttachmentIds = composerDraft.nonPersistedAttachmentIds;
  const setComposerDraftPrompt = useComposerDraftStore((store) => store.setPrompt);
  const setComposerDraftPromptEnhancementState = useComposerDraftStore(
    (store) => store.setPromptEnhancementState,
  );
  const setComposerDraftProvider = useComposerDraftStore((store) => store.setProvider);
  const setComposerDraftModel = useComposerDraftStore((store) => store.setModel);
  const setComposerDraftRuntimeMode = useComposerDraftStore((store) => store.setRuntimeMode);
  const setComposerDraftInteractionMode = useComposerDraftStore(
    (store) => store.setInteractionMode,
  );
  const addComposerDraftAttachment = useComposerDraftStore((store) => store.addAttachment);
  const addComposerDraftAttachments = useComposerDraftStore((store) => store.addAttachments);
  const removeComposerDraftAttachment = useComposerDraftStore((store) => store.removeAttachment);
  const insertComposerDraftTerminalContext = useComposerDraftStore(
    (store) => store.insertTerminalContext,
  );
  const addComposerDraftTerminalContexts = useComposerDraftStore(
    (store) => store.addTerminalContexts,
  );
  const removeComposerDraftTerminalContext = useComposerDraftStore(
    (store) => store.removeTerminalContext,
  );
  const setComposerDraftTerminalContexts = useComposerDraftStore(
    (store) => store.setTerminalContexts,
  );
  const clearComposerDraftPersistedAttachments = useComposerDraftStore(
    (store) => store.clearPersistedAttachments,
  );
  const syncComposerDraftPersistedAttachments = useComposerDraftStore(
    (store) => store.syncPersistedAttachments,
  );
  const clearComposerDraftContent = useComposerDraftStore((store) => store.clearComposerContent);
  const setDraftThreadContext = useComposerDraftStore((store) => store.setDraftThreadContext);
  const setDraftThreadTitle = useComposerDraftStore((store) => store.setDraftThreadTitle);
  const getDraftThreadByProjectId = useComposerDraftStore(
    (store) => store.getDraftThreadByProjectId,
  );
  const getDraftThread = useComposerDraftStore((store) => store.getDraftThread);
  const setProjectDraftThreadId = useComposerDraftStore((store) => store.setProjectDraftThreadId);
  const clearProjectDraftThreadId = useComposerDraftStore(
    (store) => store.clearProjectDraftThreadId,
  );
  const draftThread = useComposerDraftStore(
    (store) => store.draftThreadsByThreadId[threadId] ?? null,
  );
  const promptRef = useRef(prompt);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isDragOverComposer, setIsDragOverComposer] = useState(false);
  const [dragOverType, setDragOverType] = useState<"files" | "tree-path">("files");
  const [expandedImage, setExpandedImage] = useState<ExpandedImagePreview | null>(null);
  const [optimisticUserMessages, setOptimisticUserMessages] = useState<ChatMessage[]>([]);
  const optimisticUserMessagesRef = useRef(optimisticUserMessages);
  optimisticUserMessagesRef.current = optimisticUserMessages;
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const queuedMessagesRef = useRef(queuedMessages);
  queuedMessagesRef.current = queuedMessages;
  const composerTerminalContextsRef = useRef<TerminalContextDraft[]>(composerTerminalContexts);
  const [localDraftErrorsByThreadId, setLocalDraftErrorsByThreadId] = useState<
    Record<ThreadId, string | null>
  >({});
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [sendStartedAt, setSendStartedAt] = useState<string | null>(null);
  const [isConnecting, _setIsConnecting] = useState(false);
  const [isRevertingCheckpoint, setIsRevertingCheckpoint] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [respondingRequestIds, setRespondingRequestIds] = useState<ApprovalRequestId[]>([]);
  const [respondingUserInputRequestIds, setRespondingUserInputRequestIds] = useState<
    ApprovalRequestId[]
  >([]);
  const [pendingUserInputAnswersByRequestId, setPendingUserInputAnswersByRequestId] = useState<
    Record<string, Record<string, PendingUserInputDraftAnswer>>
  >({});
  const [pendingUserInputQuestionIndexByRequestId, setPendingUserInputQuestionIndexByRequestId] =
    useState<Record<string, number>>({});
  const [expandedWorkGroups, setExpandedWorkGroups] = useState<Record<string, boolean>>({});
  const [planSidebarOpen, setPlanSidebarOpen] = useState(false);
  const [isComposerFooterCompact, setIsComposerFooterCompact] = useState(false);
  // Tracks whether the user explicitly dismissed the sidebar for the active turn.
  const planSidebarDismissedForTurnRef = useRef<string | null>(null);
  // When set, the thread-change reset effect will open the sidebar instead of closing it.
  // Used by "Implement in a new thread" to carry the sidebar-open intent across navigation.
  const planSidebarOpenOnNextThreadRef = useRef(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [terminalFocusRequestId, setTerminalFocusRequestId] = useState(0);
  const [composerHighlightedItemId, setComposerHighlightedItemId] = useState<string | null>(null);
  const [pullRequestDialogState, setPullRequestDialogState] =
    useState<PullRequestDialogState | null>(null);
  const [issueDialogState, setIssueDialogState] = useState<IssueDialogState | null>(null);
  const [pendingProjectScriptRun, setPendingProjectScriptRun] = useState<{
    script: ProjectScript;
    inputIds: string[];
    values: Record<string, string>;
    error: string | null;
    options?: RunProjectScriptOptions;
  } | null>(null);
  const [attachmentPreviewHandoffByMessageId, setAttachmentPreviewHandoffByMessageId] = useState<
    Record<string, string[]>
  >({});
  const [composerCursor, setComposerCursor] = useState(() =>
    collapseExpandedComposerCursor(prompt, prompt.length),
  );
  const [composerTrigger, setComposerTrigger] = useState<ComposerTrigger | null>(() =>
    detectComposerTrigger(prompt, prompt.length),
  );
  const [lastInvokedScriptByProjectId, setLastInvokedScriptByProjectId] = useLocalStorage(
    LAST_INVOKED_SCRIPT_BY_PROJECT_KEY,
    {},
    LastInvokedScriptByProjectSchema,
  );
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const [messagesScrollElement, setMessagesScrollElement] = useState<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const lastKnownScrollTopRef = useRef(0);
  const isPointerScrollActiveRef = useRef(false);
  const lastTouchClientYRef = useRef<number | null>(null);
  const pendingUserScrollUpIntentRef = useRef(false);
  const pendingAutoScrollFrameRef = useRef<number | null>(null);
  const pendingInteractionAnchorRef = useRef<{
    element: HTMLElement;
    top: number;
  } | null>(null);
  const pendingInteractionAnchorFrameRef = useRef<number | null>(null);
  const composerEditorRef = useRef<ComposerPromptEditorHandle>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const composerFormHeightRef = useRef(0);
  const composerFooterRef = useRef<HTMLDivElement>(null);
  const composerFooterLeadingRef = useRef<HTMLDivElement>(null);
  const composerFooterActionsRef = useRef<HTMLDivElement>(null);
  const composerAttachmentsRef = useRef<ComposerAttachment[]>([]);
  const composerSelectLockRef = useRef(false);
  const composerMenuOpenRef = useRef(false);
  const composerMenuItemsRef = useRef<ComposerCommandItem[]>([]);
  const activeComposerMenuItemRef = useRef<ComposerCommandItem | null>(null);
  const attachmentPreviewHandoffByMessageIdRef = useRef<Record<string, string[]>>({});
  const attachmentPreviewHandoffTimeoutByMessageIdRef = useRef<Record<string, number>>({});
  const sendInFlightRef = useRef(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalOpenByThreadRef = useRef<Record<string, boolean>>({});
  const setMessagesScrollContainerRef = useCallback((element: HTMLDivElement | null) => {
    messagesScrollRef.current = element;
    setMessagesScrollElement(element);
  }, []);

  const terminalState = useTerminalStateStore((state) =>
    selectThreadTerminalState(state.terminalStateByThreadId, threadId),
  );
  const storeSetTerminalOpen = useTerminalStateStore((s) => s.setTerminalOpen);
  const storeSetTerminalHeight = useTerminalStateStore((s) => s.setTerminalHeight);
  const storeSplitTerminal = useTerminalStateStore((s) => s.splitTerminal);
  const storeNewTerminal = useTerminalStateStore((s) => s.newTerminal);
  const storeSetActiveTerminal = useTerminalStateStore((s) => s.setActiveTerminal);
  const storeCloseTerminal = useTerminalStateStore((s) => s.closeTerminal);

  const setPrompt = useCallback(
    (nextPrompt: string) => {
      setComposerDraftPrompt(threadId, nextPrompt);
    },
    [setComposerDraftPrompt, threadId],
  );
  const setPromptEnhancementState = useCallback(
    (
      nextPromptEnhancement: PromptEnhancementId | null,
      originalPrompt: string | null | undefined,
    ) => {
      setComposerDraftPromptEnhancementState(threadId, {
        promptEnhancement: nextPromptEnhancement,
        originalPrompt,
      });
    },
    [setComposerDraftPromptEnhancementState, threadId],
  );
  const addComposerAttachment = useCallback(
    (attachment: ComposerAttachment) => {
      addComposerDraftAttachment(threadId, attachment);
    },
    [addComposerDraftAttachment, threadId],
  );
  const addComposerAttachmentsToDraft = useCallback(
    (attachments: ComposerAttachment[]) => {
      addComposerDraftAttachments(threadId, attachments);
    },
    [addComposerDraftAttachments, threadId],
  );
  const addComposerTerminalContextsToDraft = useCallback(
    (contexts: TerminalContextDraft[]) => {
      addComposerDraftTerminalContexts(threadId, contexts);
    },
    [addComposerDraftTerminalContexts, threadId],
  );
  const removeComposerAttachmentFromDraft = useCallback(
    (attachmentId: string) => {
      removeComposerDraftAttachment(threadId, attachmentId);
    },
    [removeComposerDraftAttachment, threadId],
  );
  const removeComposerTerminalContextFromDraft = useCallback(
    (contextId: string) => {
      const contextIndex = composerTerminalContexts.findIndex(
        (context) => context.id === contextId,
      );
      if (contextIndex < 0) {
        return;
      }
      const nextPrompt = removeInlineTerminalContextPlaceholder(promptRef.current, contextIndex);
      promptRef.current = nextPrompt.prompt;
      setPrompt(nextPrompt.prompt);
      removeComposerDraftTerminalContext(threadId, contextId);
      setComposerCursor(nextPrompt.cursor);
      setComposerTrigger(
        detectComposerTrigger(
          nextPrompt.prompt,
          expandCollapsedComposerCursor(nextPrompt.prompt, nextPrompt.cursor),
        ),
      );
    },
    [composerTerminalContexts, removeComposerDraftTerminalContext, setPrompt, threadId],
  );

  const serverThread = threads.find((t) => t.id === threadId);
  const fallbackDraftProject = projects.find((project) => project.id === draftThread?.projectId);
  const localDraftError = serverThread ? null : (localDraftErrorsByThreadId[threadId] ?? null);
  const localDraftThread = useMemo(
    () =>
      draftThread
        ? buildLocalDraftThread(
            threadId,
            draftThread,
            fallbackDraftProject?.model ?? DEFAULT_MODEL_BY_PROVIDER.codex,
            localDraftError,
          )
        : undefined,
    [draftThread, fallbackDraftProject?.model, localDraftError, threadId],
  );
  const activeThread = serverThread ?? localDraftThread;
  const runtimeMode =
    composerDraft.runtimeMode ?? activeThread?.runtimeMode ?? DEFAULT_RUNTIME_MODE;
  const interactionMode =
    composerDraft.interactionMode ?? activeThread?.interactionMode ?? DEFAULT_INTERACTION_MODE;
  const isServerThread = serverThread !== undefined;
  const isLocalDraftThread = !isServerThread && localDraftThread !== undefined;
  const canCheckoutPullRequestIntoThread = isLocalDraftThread;
  const activeThreadId = activeThread?.id ?? null;
  const activeLatestTurn = activeThread?.latestTurn ?? null;
  const activeContextWindow = useMemo(
    () => deriveLatestContextWindowSnapshot(activeThread?.activities ?? []),
    [activeThread?.activities],
  );
  const latestTurnSettled = isLatestTurnSettled(activeLatestTurn, activeThread?.session ?? null);
  const activeProject = projects.find((p) => p.id === activeThread?.projectId);
  const previewPanelKey = activeProject ? `${activeProject.id}:${previewDock}` : null;

  const openPullRequestDialog = useCallback(
    (reference?: string) => {
      if (!canCheckoutPullRequestIntoThread) {
        return;
      }
      setPullRequestDialogState({
        initialReference: reference ?? null,
        key: Date.now(),
      });
      setComposerHighlightedItemId(null);
    },
    [canCheckoutPullRequestIntoThread],
  );

  const closePullRequestDialog = useCallback(() => {
    setPullRequestDialogState(null);
  }, []);

  const openIssueDialog = useCallback(
    (reference?: string) => {
      if (!isLocalDraftThread) {
        return;
      }
      setIssueDialogState({
        initialReference: reference ?? null,
        key: Date.now(),
      });
      setComposerHighlightedItemId(null);
    },
    [isLocalDraftThread],
  );

  const closeIssueDialog = useCallback(() => {
    setIssueDialogState(null);
  }, []);

  const openOrReuseProjectDraftThread = useCallback(
    async (input: { branch: string; worktreePath: string | null; envMode: DraftThreadEnvMode }) => {
      if (!activeProject) {
        throw new Error("No active project is available for this pull request.");
      }
      const storedDraftThread = getDraftThreadByProjectId(activeProject.id);
      if (storedDraftThread) {
        setDraftThreadContext(storedDraftThread.threadId, input);
        setProjectDraftThreadId(activeProject.id, storedDraftThread.threadId, input);
        if (storedDraftThread.threadId !== threadId) {
          await navigate({
            to: "/$threadId",
            params: { threadId: storedDraftThread.threadId },
          });
        }
        return;
      }

      const activeDraftThread = getDraftThread(threadId);
      if (!isServerThread && activeDraftThread?.projectId === activeProject.id) {
        setDraftThreadContext(threadId, input);
        setProjectDraftThreadId(activeProject.id, threadId, input);
        return;
      }

      clearProjectDraftThreadId(activeProject.id);
      const nextThreadId = newThreadId();
      setProjectDraftThreadId(activeProject.id, nextThreadId, {
        createdAt: new Date().toISOString(),
        runtimeMode: DEFAULT_RUNTIME_MODE,
        interactionMode: DEFAULT_INTERACTION_MODE,
        ...input,
      });
      await navigate({
        to: "/$threadId",
        params: { threadId: nextThreadId },
      });
    },
    [
      activeProject,
      clearProjectDraftThreadId,
      getDraftThread,
      getDraftThreadByProjectId,
      isServerThread,
      navigate,
      setDraftThreadContext,
      setProjectDraftThreadId,
      threadId,
    ],
  );

  const handlePreparedPullRequestThread = useCallback(
    async (input: { branch: string; worktreePath: string | null }) => {
      await openOrReuseProjectDraftThread({
        branch: input.branch,
        worktreePath: input.worktreePath,
        envMode: input.worktreePath ? "worktree" : "local",
      });
    },
    [openOrReuseProjectDraftThread],
  );

  const handleStartIssueThread = useCallback(
    async (input: { issue: GitHubIssueDetail; mode: "local" | "worktree" }) => {
      if (!activeProject) {
        return;
      }
      // Extract owner/repo from the issue URL
      let owner = "";
      let repo = "";
      try {
        const url = new URL(input.issue.url);
        const parts = url.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          owner = parts[0]!;
          repo = parts[1]!;
        }
      } catch {
        // Fallback: cannot parse URL
      }

      if (!owner || !repo) {
        return;
      }

      const githubRef = {
        kind: "issue" as const,
        owner,
        repo,
        number: input.issue.number,
      } satisfies GitHubRef;

      // Always create a fresh thread for an issue
      clearProjectDraftThreadId(activeProject.id);
      const nextId = newThreadId();
      setProjectDraftThreadId(activeProject.id, nextId, {
        createdAt: new Date().toISOString(),
        runtimeMode: DEFAULT_RUNTIME_MODE,
        envMode: input.mode,
        githubRef,
      });

      // Pre-populate the composer with an issue context prompt
      const { setPrompt: storeSetPrompt } = useComposerDraftStore.getState();
      const labelsText =
        input.issue.labels.length > 0
          ? `Labels: ${input.issue.labels.map((l) => l.name).join(", ")}\n`
          : "";
      const bodyPreview = input.issue.body
        ? input.issue.body.slice(0, 2000) + (input.issue.body.length > 2000 ? "\n..." : "")
        : "";
      storeSetPrompt(
        nextId,
        `Resolve GitHub issue #${input.issue.number}: ${input.issue.title}\n\n${labelsText}${bodyPreview ? `${bodyPreview}\n\n` : ""}Please analyze this issue and implement a fix.`,
      );

      await navigate({
        to: "/$threadId",
        params: { threadId: nextId },
      });
    },
    [activeProject, clearProjectDraftThreadId, navigate, setProjectDraftThreadId],
  );

  useEffect(() => {
    if (!activeThread?.id) return;
    if (!latestTurnSettled) return;
    if (!activeLatestTurn?.completedAt) return;
    const turnCompletedAt = Date.parse(activeLatestTurn.completedAt);
    if (Number.isNaN(turnCompletedAt)) return;
    const lastVisitedAt = activeThread.lastVisitedAt ? Date.parse(activeThread.lastVisitedAt) : NaN;
    if (!Number.isNaN(lastVisitedAt) && lastVisitedAt >= turnCompletedAt) return;

    markThreadVisited(activeThread.id);
  }, [
    activeThread?.id,
    activeThread?.lastVisitedAt,
    activeLatestTurn?.completedAt,
    latestTurnSettled,
    markThreadVisited,
  ]);

  const sessionProvider = activeThread?.session?.provider ?? null;
  const selectedProviderByThreadId = composerDraft.provider;
  const hasThreadStarted = Boolean(
    activeThread &&
    (activeThread.latestTurn !== null ||
      activeThread.messages.length > 0 ||
      activeThread.session !== null),
  );
  const lockedProvider: ProviderKind | null = hasThreadStarted
    ? (sessionProvider ?? selectedProviderByThreadId ?? null)
    : null;
  const selectedProvider: ProviderKind = lockedProvider ?? selectedProviderByThreadId ?? "codex";
  const baseThreadModel = resolveModelSlugForProvider(
    selectedProvider,
    activeThread?.model ?? activeProject?.model ?? getDefaultModel(selectedProvider),
  );
  const customModelsByProvider = useMemo(() => getCustomModelsByProvider(settings), [settings]);
  const selectedModel = useMemo(() => {
    const draftModel = composerDraft.model;
    if (!draftModel) {
      return baseThreadModel;
    }
    return resolveAppModelSelection(selectedProvider, customModelsByProvider, draftModel);
  }, [baseThreadModel, composerDraft.model, customModelsByProvider, selectedProvider]);
  const draftModelOptions = composerDraft.modelOptions;
  const composerProviderState = useMemo(
    () =>
      getComposerProviderState({
        provider: selectedProvider,
        model: selectedModel,
        prompt,
        modelOptions: draftModelOptions,
      }),
    [draftModelOptions, prompt, selectedModel, selectedProvider],
  );
  const selectedPromptEffort = composerProviderState.promptEffort;
  const selectedModelOptionsForDispatch = composerProviderState.modelOptionsForDispatch;
  const providerOptionsForDispatch = useMemo(() => getProviderStartOptions(settings), [settings]);
  const selectedModelForPicker = selectedModel;
  const modelOptionsByProvider = useMemo(
    () => getCustomModelOptionsByProvider(settings),
    [settings],
  );
  const selectedModelForPickerWithCustomFallback = useMemo(() => {
    const currentOptions = modelOptionsByProvider[selectedProvider];
    return currentOptions.some((option) => option.slug === selectedModelForPicker)
      ? selectedModelForPicker
      : (normalizeModelSlug(selectedModelForPicker, selectedProvider) ?? selectedModelForPicker);
  }, [modelOptionsByProvider, selectedModelForPicker, selectedProvider]);
  const searchableModelOptions = useMemo(
    () =>
      AVAILABLE_PROVIDER_OPTIONS.filter(
        (option) => lockedProvider === null || option.value === lockedProvider,
      ).flatMap((option) =>
        modelOptionsByProvider[option.value].map(({ slug, name }) => ({
          provider: option.value,
          providerLabel: option.label,
          slug,
          name,
          searchSlug: slug.toLowerCase(),
          searchName: name.toLowerCase(),
          searchProvider: option.label.toLowerCase(),
        })),
      ),
    [lockedProvider, modelOptionsByProvider],
  );
  const phase = derivePhase(activeThread?.session ?? null);
  const isSendBusy = sendPhase !== "idle";
  const isPreparingWorktree = sendPhase === "preparing-worktree";
  const isTransportReady = transportState === "open";
  const isRemoteActionBlocked = !isTransportReady;
  const isWorking = phase === "running" || isSendBusy || isConnecting || isRevertingCheckpoint;
  const nowIso = new Date(nowTick).toISOString();
  const activeWorkStartedAt = deriveActiveWorkStartedAt(
    activeLatestTurn,
    activeThread?.session ?? null,
    sendStartedAt,
  );
  const threadActivities = activeThread?.activities ?? EMPTY_ACTIVITIES;
  const workLogEntries = useMemo(
    () => deriveWorkLogEntries(threadActivities, activeLatestTurn?.turnId ?? undefined),
    [activeLatestTurn?.turnId, threadActivities],
  );
  const latestTurnHasToolActivity = useMemo(
    () => hasToolActivityForTurn(threadActivities, activeLatestTurn?.turnId),
    [activeLatestTurn?.turnId, threadActivities],
  );
  const pendingApprovals = useMemo(
    () => derivePendingApprovals(threadActivities),
    [threadActivities],
  );
  const pendingUserInputs = useMemo(
    () => derivePendingUserInputs(threadActivities),
    [threadActivities],
  );
  const activePendingUserInput = pendingUserInputs[0] ?? null;
  const activePendingDraftAnswers = useMemo(
    () =>
      activePendingUserInput
        ? (pendingUserInputAnswersByRequestId[activePendingUserInput.requestId] ??
          EMPTY_PENDING_USER_INPUT_ANSWERS)
        : EMPTY_PENDING_USER_INPUT_ANSWERS,
    [activePendingUserInput, pendingUserInputAnswersByRequestId],
  );
  const activePendingQuestionIndex = activePendingUserInput
    ? (pendingUserInputQuestionIndexByRequestId[activePendingUserInput.requestId] ?? 0)
    : 0;
  const activePendingProgress = useMemo(
    () =>
      activePendingUserInput
        ? derivePendingUserInputProgress(
            activePendingUserInput.questions,
            activePendingDraftAnswers,
            activePendingQuestionIndex,
          )
        : null,
    [activePendingDraftAnswers, activePendingQuestionIndex, activePendingUserInput],
  );
  const activePendingResolvedAnswers = useMemo(
    () =>
      activePendingUserInput
        ? buildPendingUserInputAnswers(activePendingUserInput.questions, activePendingDraftAnswers)
        : null,
    [activePendingDraftAnswers, activePendingUserInput],
  );
  const activePendingIsResponding = activePendingUserInput
    ? respondingUserInputRequestIds.includes(activePendingUserInput.requestId)
    : false;
  const activeProposedPlan = useMemo(() => {
    if (!latestTurnSettled) {
      return null;
    }
    return findLatestProposedPlan(
      activeThread?.proposedPlans ?? [],
      activeLatestTurn?.turnId ?? null,
    );
  }, [activeLatestTurn?.turnId, activeThread?.proposedPlans, latestTurnSettled]);
  const sidebarProposedPlan = useMemo(
    () =>
      findSidebarProposedPlan({
        threads,
        latestTurn: activeLatestTurn,
        latestTurnSettled,
        threadId: activeThread?.id ?? null,
      }),
    [activeLatestTurn, activeThread?.id, latestTurnSettled, threads],
  );
  const activePlan = useMemo(
    () => deriveActivePlanState(threadActivities, activeLatestTurn?.turnId ?? undefined),
    [activeLatestTurn?.turnId, threadActivities],
  );
  const activePlanTurnId = activePlan?.turnId ?? null;
  const activePendingUserInputRequestId = activePendingUserInput?.requestId ?? null;
  const hasPendingPlanFeedback =
    activePendingUserInputRequestId !== null &&
    (activePlanTurnId !== null || interactionMode === "plan");
  const showPlanFollowUpPrompt =
    pendingUserInputs.length === 0 &&
    interactionMode === "plan" &&
    latestTurnSettled &&
    hasActionableProposedPlan(activeProposedPlan);
  const activePendingApproval = pendingApprovals[0] ?? null;
  const isMobileCompanion = clientMode === "mobile";
  const isComposerApprovalState = activePendingApproval !== null;
  const hasComposerHeader =
    isComposerApprovalState ||
    pendingUserInputs.length > 0 ||
    (showPlanFollowUpPrompt && activeProposedPlan !== null);
  const composerFooterHasWideActions = showPlanFollowUpPrompt || activePendingProgress !== null;
  const lastSyncedPendingInputRef = useRef<{
    requestId: string | null;
    questionId: string | null;
  } | null>(null);
  useEffect(() => {
    const nextCustomAnswer = activePendingProgress?.customAnswer;
    if (typeof nextCustomAnswer !== "string") {
      lastSyncedPendingInputRef.current = null;
      return;
    }
    const nextRequestId = activePendingUserInput?.requestId ?? null;
    const nextQuestionId = activePendingProgress?.activeQuestion?.id ?? null;
    const questionChanged =
      lastSyncedPendingInputRef.current?.requestId !== nextRequestId ||
      lastSyncedPendingInputRef.current?.questionId !== nextQuestionId;
    const textChangedExternally = promptRef.current !== nextCustomAnswer;

    lastSyncedPendingInputRef.current = {
      requestId: nextRequestId,
      questionId: nextQuestionId,
    };

    if (!questionChanged && !textChangedExternally) {
      return;
    }

    promptRef.current = nextCustomAnswer;
    const nextCursor = collapseExpandedComposerCursor(nextCustomAnswer, nextCustomAnswer.length);
    setComposerCursor(nextCursor);
    setComposerTrigger(
      detectComposerTrigger(
        nextCustomAnswer,
        expandCollapsedComposerCursor(nextCustomAnswer, nextCursor),
      ),
    );
    setComposerHighlightedItemId(null);
  }, [
    activePendingProgress?.customAnswer,
    activePendingUserInput?.requestId,
    activePendingProgress?.activeQuestion?.id,
  ]);
  useEffect(() => {
    if (!hasPendingPlanFeedback) {
      return;
    }
    const turnKey =
      activePlanTurnId ?? sidebarProposedPlan?.turnId ?? activeLatestTurn?.turnId ?? null;
    if (!turnKey || planSidebarDismissedForTurnRef.current === turnKey) {
      return;
    }
    setPlanSidebarOpen(true);
  }, [
    activeLatestTurn?.turnId,
    activePlanTurnId,
    hasPendingPlanFeedback,
    sidebarProposedPlan?.turnId,
  ]);

  useEffect(() => {
    attachmentPreviewHandoffByMessageIdRef.current = attachmentPreviewHandoffByMessageId;
  }, [attachmentPreviewHandoffByMessageId]);
  const clearAttachmentPreviewHandoffs = useCallback(() => {
    for (const timeoutId of Object.values(attachmentPreviewHandoffTimeoutByMessageIdRef.current)) {
      window.clearTimeout(timeoutId);
    }
    attachmentPreviewHandoffTimeoutByMessageIdRef.current = {};
    for (const previewUrls of Object.values(attachmentPreviewHandoffByMessageIdRef.current)) {
      for (const previewUrl of previewUrls) {
        revokeBlobPreviewUrl(previewUrl);
      }
    }
    attachmentPreviewHandoffByMessageIdRef.current = {};
    setAttachmentPreviewHandoffByMessageId({});
  }, []);
  useEffect(() => {
    return () => {
      clearAttachmentPreviewHandoffs();
      for (const message of optimisticUserMessagesRef.current) {
        revokeUserMessagePreviewUrls(message);
      }
    };
  }, [clearAttachmentPreviewHandoffs]);
  const handoffAttachmentPreviews = useCallback((messageId: MessageId, previewUrls: string[]) => {
    if (previewUrls.length === 0) return;

    const previousPreviewUrls = attachmentPreviewHandoffByMessageIdRef.current[messageId] ?? [];
    for (const previewUrl of previousPreviewUrls) {
      if (!previewUrls.includes(previewUrl)) {
        revokeBlobPreviewUrl(previewUrl);
      }
    }
    setAttachmentPreviewHandoffByMessageId((existing) => {
      const next = {
        ...existing,
        [messageId]: previewUrls,
      };
      attachmentPreviewHandoffByMessageIdRef.current = next;
      return next;
    });

    const existingTimeout = attachmentPreviewHandoffTimeoutByMessageIdRef.current[messageId];
    if (typeof existingTimeout === "number") {
      window.clearTimeout(existingTimeout);
    }
    attachmentPreviewHandoffTimeoutByMessageIdRef.current[messageId] = window.setTimeout(() => {
      const currentPreviewUrls = attachmentPreviewHandoffByMessageIdRef.current[messageId];
      if (currentPreviewUrls) {
        for (const previewUrl of currentPreviewUrls) {
          revokeBlobPreviewUrl(previewUrl);
        }
      }
      setAttachmentPreviewHandoffByMessageId((existing) => {
        if (!(messageId in existing)) return existing;
        const next = { ...existing };
        delete next[messageId];
        attachmentPreviewHandoffByMessageIdRef.current = next;
        return next;
      });
      delete attachmentPreviewHandoffTimeoutByMessageIdRef.current[messageId];
    }, ATTACHMENT_PREVIEW_HANDOFF_TTL_MS);
  }, []);
  const serverMessages = activeThread?.messages;
  const timelineMessages = useMemo(() => {
    const messages = serverMessages ?? [];
    const serverMessagesWithPreviewHandoff =
      Object.keys(attachmentPreviewHandoffByMessageId).length === 0
        ? messages
        : // Spread only fires for the few messages that actually changed;
          // unchanged ones early-return their original reference.
          // In-place mutation would break React's immutable state contract.
          // oxlint-disable-next-line no-map-spread
          messages.map((message) => {
            if (
              message.role !== "user" ||
              !message.attachments ||
              message.attachments.length === 0
            ) {
              return message;
            }
            const handoffPreviewUrls = attachmentPreviewHandoffByMessageId[message.id];
            if (!handoffPreviewUrls || handoffPreviewUrls.length === 0) {
              return message;
            }

            let changed = false;
            let imageIndex = 0;
            const attachments = message.attachments.map((attachment) => {
              if (attachment.type !== "image") {
                return attachment;
              }
              const handoffPreviewUrl = handoffPreviewUrls[imageIndex];
              imageIndex += 1;
              if (!handoffPreviewUrl || attachment.previewUrl === handoffPreviewUrl) {
                return attachment;
              }
              changed = true;
              return {
                ...attachment,
                previewUrl: handoffPreviewUrl,
              };
            });

            return changed ? { ...message, attachments } : message;
          });

    if (optimisticUserMessages.length === 0) {
      return serverMessagesWithPreviewHandoff;
    }
    const serverIds = new Set(serverMessagesWithPreviewHandoff.map((message) => message.id));
    const pendingMessages = optimisticUserMessages.filter((message) => !serverIds.has(message.id));
    if (pendingMessages.length === 0) {
      return serverMessagesWithPreviewHandoff;
    }
    return [...serverMessagesWithPreviewHandoff, ...pendingMessages];
  }, [serverMessages, attachmentPreviewHandoffByMessageId, optimisticUserMessages]);
  const timelineEntries = useMemo(
    () =>
      deriveTimelineEntries(timelineMessages, activeThread?.proposedPlans ?? [], workLogEntries),
    [activeThread?.proposedPlans, timelineMessages, workLogEntries],
  );
  const { turnDiffSummaries, inferredCheckpointTurnCountByTurnId } =
    useTurnDiffSummaries(activeThread);
  const turnDiffSummaryByAssistantMessageId = useMemo(() => {
    const byMessageId = new Map<MessageId, TurnDiffSummary>();
    for (const summary of turnDiffSummaries) {
      if (!summary.assistantMessageId) continue;
      byMessageId.set(summary.assistantMessageId, summary);
    }
    return byMessageId;
  }, [turnDiffSummaries]);
  const revertTurnCountByUserMessageId = useMemo(() => {
    const byUserMessageId = new Map<MessageId, number>();
    for (let index = 0; index < timelineEntries.length; index += 1) {
      const entry = timelineEntries[index];
      if (!entry || entry.kind !== "message" || entry.message.role !== "user") {
        continue;
      }

      for (let nextIndex = index + 1; nextIndex < timelineEntries.length; nextIndex += 1) {
        const nextEntry = timelineEntries[nextIndex];
        if (!nextEntry || nextEntry.kind !== "message") {
          continue;
        }
        if (nextEntry.message.role === "user") {
          break;
        }
        const summary = turnDiffSummaryByAssistantMessageId.get(nextEntry.message.id);
        if (!summary) {
          continue;
        }
        const turnCount =
          summary.checkpointTurnCount ?? inferredCheckpointTurnCountByTurnId[summary.turnId];
        if (typeof turnCount !== "number") {
          break;
        }
        byUserMessageId.set(entry.message.id, Math.max(0, turnCount - 1));
        break;
      }
    }

    return byUserMessageId;
  }, [inferredCheckpointTurnCountByTurnId, timelineEntries, turnDiffSummaryByAssistantMessageId]);

  const completionSummary = useMemo(() => {
    if (!latestTurnSettled) return null;
    if (!activeLatestTurn?.startedAt) return null;
    if (!activeLatestTurn.completedAt) return null;
    if (!latestTurnHasToolActivity) return null;

    const elapsed = formatElapsed(activeLatestTurn.startedAt, activeLatestTurn.completedAt);
    return elapsed ? `Worked for ${elapsed}` : null;
  }, [
    activeLatestTurn?.completedAt,
    activeLatestTurn?.startedAt,
    latestTurnHasToolActivity,
    latestTurnSettled,
  ]);
  const completionDividerBeforeEntryId = useMemo(() => {
    if (!latestTurnSettled) return null;
    if (!activeLatestTurn?.startedAt) return null;
    if (!activeLatestTurn.completedAt) return null;
    if (!completionSummary) return null;

    const turnStartedAt = Date.parse(activeLatestTurn.startedAt);
    const turnCompletedAt = Date.parse(activeLatestTurn.completedAt);
    if (Number.isNaN(turnStartedAt)) return null;
    if (Number.isNaN(turnCompletedAt)) return null;

    let inRangeMatch: string | null = null;
    let fallbackMatch: string | null = null;
    for (const timelineEntry of timelineEntries) {
      if (timelineEntry.kind !== "message") continue;
      if (timelineEntry.message.role !== "assistant") continue;
      const messageAt = Date.parse(timelineEntry.message.createdAt);
      if (Number.isNaN(messageAt) || messageAt < turnStartedAt) continue;
      fallbackMatch = timelineEntry.id;
      if (messageAt <= turnCompletedAt) {
        inRangeMatch = timelineEntry.id;
      }
    }
    return inRangeMatch ?? fallbackMatch;
  }, [
    activeLatestTurn?.completedAt,
    activeLatestTurn?.startedAt,
    completionSummary,
    latestTurnSettled,
    timelineEntries,
  ]);
  const gitCwd = activeProject
    ? projectScriptCwd({
        project: { cwd: activeProject.cwd },
        worktreePath: activeThread?.worktreePath ?? null,
      })
    : null;
  const composerTriggerKind = composerTrigger?.kind ?? null;
  const pathTriggerQuery = composerTrigger?.kind === "path" ? composerTrigger.query : "";
  const isPathTrigger = composerTriggerKind === "path";
  const [debouncedPathQuery, composerPathQueryDebouncer] = useDebouncedValue(
    pathTriggerQuery,
    { wait: COMPOSER_PATH_QUERY_DEBOUNCE_MS },
    (debouncerState) => ({ isPending: debouncerState.isPending }),
  );
  const effectivePathQuery = pathTriggerQuery.length > 0 ? debouncedPathQuery : "";
  const branchesQuery = useQuery(gitBranchesQueryOptions(gitCwd));
  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const workspaceEntriesQuery = useQuery(
    projectSearchEntriesQueryOptions({
      cwd: gitCwd,
      query: effectivePathQuery,
      enabled: isPathTrigger,
      limit: 80,
    }),
  );
  const workspaceEntries = workspaceEntriesQuery.data?.entries ?? EMPTY_PROJECT_ENTRIES;
  const skillsQuery = useQuery(
    skillListQueryOptions({
      cwd: gitCwd,
      enabled: composerTriggerKind === "slash-skill" || composerTriggerKind === "slash-command",
    }),
  );
  const skillCatalogQuery = useQuery(
    skillCatalogQueryOptions({
      cwd: gitCwd,
      enabled: composerTriggerKind === "slash-skill",
    }),
  );
  const installedSkills = useMemo(() => skillsQuery.data?.skills ?? [], [skillsQuery.data?.skills]);
  const catalogSkills = useMemo(
    () => skillCatalogQuery.data?.skills ?? [],
    [skillCatalogQuery.data?.skills],
  );
  const composerMenuItems = useMemo<ComposerCommandItem[]>(() => {
    if (!composerTrigger) return [];
    if (composerTrigger.kind === "path") {
      return workspaceEntries.map((entry) => ({
        id: `path:${entry.kind}:${entry.path}`,
        type: "path",
        path: entry.path,
        pathKind: entry.kind,
        label: basenameOfPath(entry.path),
        description: entry.parentPath ?? "",
      }));
    }

    if (composerTrigger.kind === "slash-skill") {
      const query = composerTrigger.query.trim().toLowerCase();

      // If query is empty, show skill management subcommands + installed skills
      if (!query) {
        const subcommandItems: ComposerCommandItem[] = SKILL_SUBCOMMAND_ITEMS;
        const skillItems: ComposerCommandItem[] = installedSkills.map((skill) => ({
          id: `skill:${skill.scope}:${skill.name}`,
          type: "skill-installed" as const,
          skillName: skill.name,
          scope: skill.scope as "global" | "project",
          label: `/${skill.name}`,
          description: skill.description,
          tags: skill.tags,
        }));
        const catalogItems: ComposerCommandItem[] = catalogSkills
          .filter((skill) => !skill.installed && !skill.system)
          .map((skill) => ({
            id: `skill-catalog:${skill.id}`,
            type: "skill-catalog" as const,
            skillId: skill.id,
            label: `/skill install ${skill.name.toLowerCase()}`,
            description: skill.description,
            tags: skill.tags,
          }));
        return [...subcommandItems, ...skillItems, ...catalogItems];
      }

      // Filter subcommands and skills by query
      const subcommandItems: ComposerCommandItem[] = SKILL_SUBCOMMAND_ITEMS.filter(
        (item) => item.subcommand.includes(query) || item.label.includes(query),
      );

      const skillItems: ComposerCommandItem[] = installedSkills
        .filter(
          (skill) =>
            skill.name.includes(query) ||
            skill.description.toLowerCase().includes(query) ||
            skill.tags.some((tag) => tag.toLowerCase().includes(query)),
        )
        .map((skill) => ({
          id: `skill:${skill.scope}:${skill.name}`,
          type: "skill-installed" as const,
          skillName: skill.name,
          scope: skill.scope as "global" | "project",
          label: `/${skill.name}`,
          description: skill.description,
          tags: skill.tags,
        }));
      const catalogItems: ComposerCommandItem[] = catalogSkills
        .filter(
          (skill) =>
            !skill.installed &&
            !skill.system &&
            (skill.name.toLowerCase().includes(query) ||
              skill.description.toLowerCase().includes(query) ||
              skill.tags.some((tag) => tag.toLowerCase().includes(query))),
        )
        .map((skill) => ({
          id: `skill-catalog:${skill.id}`,
          type: "skill-catalog" as const,
          skillId: skill.id,
          label: `/skill install ${skill.name.toLowerCase()}`,
          description: skill.description,
          tags: skill.tags,
        }));

      return [...subcommandItems, ...skillItems, ...catalogItems];
    }

    if (composerTrigger.kind === "slash-command") {
      const slashCommandItems = [
        {
          id: "slash:model",
          type: "slash-command",
          command: "model",
          label: "/model",
          description: "Switch response model for this thread",
        },
        {
          id: "slash:plan",
          type: "slash-command",
          command: "plan",
          label: "/plan",
          description: "Switch this thread into plan mode",
        },
        {
          id: "slash:chat",
          type: "slash-command",
          command: "chat",
          label: "/chat",
          description: "Switch this thread into chat mode",
        },
        {
          id: "slash:code",
          type: "slash-command",
          command: "code",
          label: "/code",
          description: "Switch this thread into code mode",
        },
        {
          id: "slash:skill",
          type: "slash-command",
          command: "skill",
          label: "/skill",
          description: "Manage skills and plugins",
        },
      ] satisfies ReadonlyArray<Extract<ComposerCommandItem, { type: "slash-command" }>>;

      const skillItems: ComposerCommandItem[] = installedSkills.map((skill) => ({
        id: `skill:${skill.scope}:${skill.name}`,
        type: "skill-installed" as const,
        skillName: skill.name,
        scope: skill.scope as "global" | "project",
        label: `/${skill.name}`,
        description: skill.description,
        tags: skill.tags,
      }));

      const query = composerTrigger.query.trim().toLowerCase();
      const allItems: ComposerCommandItem[] = [...slashCommandItems, ...skillItems];
      if (!query) {
        return allItems;
      }
      return allItems.filter((item) => {
        if (item.type === "slash-command") {
          return item.command.includes(query) || item.label.slice(1).includes(query);
        }
        if (item.type === "skill-installed") {
          return item.skillName.includes(query) || item.description.toLowerCase().includes(query);
        }
        return false;
      });
    }

    return searchableModelOptions
      .filter(({ searchSlug, searchName, searchProvider }) => {
        const query = composerTrigger.query.trim().toLowerCase();
        if (!query) return true;
        return (
          searchSlug.includes(query) || searchName.includes(query) || searchProvider.includes(query)
        );
      })
      .map(({ provider, providerLabel, slug, name }) => ({
        id: `model:${provider}:${slug}`,
        type: "model",
        provider,
        model: slug,
        label: name,
        description: `${providerLabel} · ${slug}`,
      }));
  }, [catalogSkills, composerTrigger, searchableModelOptions, workspaceEntries, installedSkills]);
  const composerMenuOpen = Boolean(composerTrigger);
  const activeComposerMenuItem = useMemo(
    () =>
      composerMenuItems.find((item) => item.id === composerHighlightedItemId) ??
      composerMenuItems[0] ??
      null,
    [composerHighlightedItemId, composerMenuItems],
  );
  composerMenuOpenRef.current = composerMenuOpen;
  composerMenuItemsRef.current = composerMenuItems;
  activeComposerMenuItemRef.current = activeComposerMenuItem;
  const nonPersistedComposerAttachmentIdSet = useMemo(
    () => new Set(nonPersistedComposerAttachmentIds),
    [nonPersistedComposerAttachmentIds],
  );
  const keybindings = serverConfigQuery.data?.keybindings ?? EMPTY_KEYBINDINGS;
  const providerStatuses = serverConfigQuery.data?.providers ?? EMPTY_PROVIDER_STATUSES;
  const activeProviderStatus = useMemo(
    () => providerStatuses.find((status) => status.provider === selectedProvider) ?? null,
    [selectedProvider, providerStatuses],
  );
  const activeProjectCwd = activeProject?.cwd ?? null;
  const activeThreadWorktreePath = activeThread?.worktreePath ?? null;
  const threadTerminalRuntimeEnv = useMemo(() => {
    if (!activeProjectCwd) return {};
    return projectScriptRuntimeEnv({
      project: {
        cwd: activeProjectCwd,
      },
      worktreePath: activeThreadWorktreePath,
    });
  }, [activeProjectCwd, activeThreadWorktreePath]);
  // Default true while loading to avoid toolbar flicker.
  const isGitRepo = branchesQuery.data?.isRepo ?? true;
  const terminalToggleShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.toggle"),
    [keybindings],
  );
  const splitTerminalShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.split"),
    [keybindings],
  );
  const newTerminalShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.new"),
    [keybindings],
  );
  const closeTerminalShortcutLabel = useMemo(
    () => shortcutLabelForCommand(keybindings, "terminal.close"),
    [keybindings],
  );
  const platform = typeof navigator !== "undefined" ? navigator.platform : "";
  const chatShortcutGuides = useMemo(
    () => buildChatShortcutGuides(keybindings, platform),
    [keybindings, platform],
  );

  const pendingContext = useCodeViewerStore((state) => state.pendingContext);
  const clearPendingContext = useCodeViewerStore((state) => state.clearPendingContext);
  const codeViewerOpen = useCodeViewerStore((state) => state.isOpen);
  const toggleCodeViewer = useCodeViewerStore((state) => state.toggle);
  const diffViewerOpen = useDiffViewerStore((state) => state.isOpen);
  const openDiffViewerConversation = useDiffViewerStore((state) => state.openConversation);
  const closeDiffViewer = useDiffViewerStore((state) => state.close);
  const openTurnDiffViewer = useDiffViewerStore((state) => state.openTurnDiff);
  const handleOpenTurnDiff = useCallback(
    (turnId: TurnId, filePath?: string) => {
      if (!activeThread) return;
      openTurnDiffViewer(activeThread.id, turnId, filePath);
    },
    [activeThread, openTurnDiffViewer],
  );

  const handleToggleDiffViewer = useCallback(() => {
    if (diffViewerOpen) {
      closeDiffViewer();
    } else if (activeThread) {
      openDiffViewerConversation(activeThread.id);
    }
  }, [diffViewerOpen, closeDiffViewer, activeThread, openDiffViewerConversation]);

  // When Cmd+L is pressed in the code viewer, insert the @file:lines mention into the composer
  useEffect(() => {
    if (!pendingContext) return;
    const { filePath, fromLine, toLine } = pendingContext;
    const mention =
      fromLine === toLine ? `@${filePath}:L${fromLine}` : `@${filePath}:L${fromLine}-L${toLine}`;
    const currentPrompt = prompt;
    const separator = currentPrompt.length > 0 && !currentPrompt.endsWith(" ") ? " " : "";
    setPrompt(`${currentPrompt}${separator}${mention} `);
    clearPendingContext();
  }, [pendingContext, clearPendingContext, prompt, setPrompt]);

  const envLocked = Boolean(
    activeThread &&
    (activeThread.messages.length > 0 ||
      (activeThread.session !== null && activeThread.session.status !== "closed")),
  );
  const activeTerminalGroup =
    terminalState.terminalGroups.find(
      (group) => group.id === terminalState.activeTerminalGroupId,
    ) ??
    terminalState.terminalGroups.find((group) =>
      group.terminalIds.includes(terminalState.activeTerminalId),
    ) ??
    null;
  const hasReachedSplitLimit =
    (activeTerminalGroup?.terminalIds.length ?? 0) >= MAX_TERMINALS_PER_GROUP;
  const setThreadError = useCallback(
    (targetThreadId: ThreadId | null, error: string | null) => {
      if (!targetThreadId) return;
      if (threads.some((thread) => thread.id === targetThreadId)) {
        setStoreThreadError(targetThreadId, error);
        return;
      }
      setLocalDraftErrorsByThreadId((existing) => {
        if ((existing[targetThreadId] ?? null) === error) {
          return existing;
        }
        return {
          ...existing,
          [targetThreadId]: error,
        };
      });
    },
    [setStoreThreadError, threads],
  );

  const focusComposer = useCallback(() => {
    composerEditorRef.current?.focusAtEnd();
  }, []);
  const scheduleComposerFocus = useCallback(() => {
    window.requestAnimationFrame(() => {
      focusComposer();
    });
  }, [focusComposer]);
  const addTerminalContextToDraft = useCallback(
    (selection: TerminalContextSelection) => {
      if (!activeThread) {
        return;
      }
      const snapshot = composerEditorRef.current?.readSnapshot() ?? {
        value: promptRef.current,
        cursor: composerCursor,
        expandedCursor: expandCollapsedComposerCursor(promptRef.current, composerCursor),
        terminalContextIds: composerTerminalContexts.map((context) => context.id),
      };
      const insertion = insertInlineTerminalContextPlaceholder(
        snapshot.value,
        snapshot.expandedCursor,
      );
      const nextCollapsedCursor = collapseExpandedComposerCursor(
        insertion.prompt,
        insertion.cursor,
      );
      const inserted = insertComposerDraftTerminalContext(
        activeThread.id,
        insertion.prompt,
        {
          id: randomUUID(),
          threadId: activeThread.id,
          createdAt: new Date().toISOString(),
          ...selection,
        },
        insertion.contextIndex,
      );
      if (!inserted) {
        return;
      }
      promptRef.current = insertion.prompt;
      setComposerCursor(nextCollapsedCursor);
      setComposerTrigger(detectComposerTrigger(insertion.prompt, insertion.cursor));
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCollapsedCursor);
      });
    },
    [activeThread, composerCursor, composerTerminalContexts, insertComposerDraftTerminalContext],
  );
  const previewBridgeRef = readDesktopPreviewBridge();
  const handlePreviewUrl = useCallback(
    (url: string) => {
      if (!activeProject || !activeThread) return;
      setPreviewOpen(activeProject.id, true);
      void previewBridgeRef?.createTab({ url });
    },
    [activeProject, activeThread, setPreviewOpen, previewBridgeRef],
  );
  const openLinksExternally = settings.openLinksExternally;
  const onPreviewUrl =
    isElectron && activeProject && !openLinksExternally ? handlePreviewUrl : undefined;
  const setTerminalOpen = useCallback(
    (open: boolean) => {
      if (!activeThreadId) return;
      storeSetTerminalOpen(activeThreadId, open);
    },
    [activeThreadId, storeSetTerminalOpen],
  );
  const setTerminalHeight = useCallback(
    (height: number) => {
      if (!activeThreadId) return;
      storeSetTerminalHeight(activeThreadId, height);
    },
    [activeThreadId, storeSetTerminalHeight],
  );
  const toggleTerminalVisibility = useCallback(() => {
    if (!activeThreadId) return;
    setTerminalOpen(!terminalState.terminalOpen);
  }, [activeThreadId, setTerminalOpen, terminalState.terminalOpen]);
  const splitTerminal = useCallback(() => {
    if (!activeThreadId || hasReachedSplitLimit) return;
    const terminalId = `terminal-${randomUUID()}`;
    storeSplitTerminal(activeThreadId, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  }, [activeThreadId, hasReachedSplitLimit, storeSplitTerminal]);
  const createNewTerminal = useCallback(() => {
    if (!activeThreadId) return;
    const terminalId = `terminal-${randomUUID()}`;
    storeNewTerminal(activeThreadId, terminalId);
    setTerminalFocusRequestId((value) => value + 1);
  }, [activeThreadId, storeNewTerminal]);
  const activateTerminal = useCallback(
    (terminalId: string) => {
      if (!activeThreadId) return;
      storeSetActiveTerminal(activeThreadId, terminalId);
      setTerminalFocusRequestId((value) => value + 1);
    },
    [activeThreadId, storeSetActiveTerminal],
  );
  const closeTerminal = useCallback(
    (terminalId: string) => {
      const api = readNativeApi();
      if (!activeThreadId || !api) return;
      const isFinalTerminal = terminalState.terminalIds.length <= 1;
      const fallbackExitWrite = () =>
        api.terminal
          .write({ threadId: activeThreadId, terminalId, data: "exit\n" })
          .catch(() => undefined);
      if ("close" in api.terminal && typeof api.terminal.close === "function") {
        void (async () => {
          if (isFinalTerminal) {
            await api.terminal
              .clear({ threadId: activeThreadId, terminalId })
              .catch(() => undefined);
          }
          await api.terminal.close({
            threadId: activeThreadId,
            terminalId,
            deleteHistory: true,
          });
        })().catch(() => fallbackExitWrite());
      } else {
        void fallbackExitWrite();
      }
      storeCloseTerminal(activeThreadId, terminalId);
      setTerminalFocusRequestId((value) => value + 1);
    },
    [activeThreadId, storeCloseTerminal, terminalState.terminalIds.length],
  );
  const executeProjectScript = useCallback(
    async (script: ProjectScript, options?: RunProjectScriptOptions) => {
      const api = readNativeApi();
      if (!api || !activeThreadId || !activeProject || !activeThread) return;
      if (options?.rememberAsLastInvoked !== false) {
        setLastInvokedScriptByProjectId((current) => {
          if (current[activeProject.id] === script.id) return current;
          return { ...current, [activeProject.id]: script.id };
        });
      }
      const targetCwd = options?.cwd ?? gitCwd ?? activeProject.cwd;
      const baseTerminalId =
        terminalState.activeTerminalId ||
        terminalState.terminalIds[0] ||
        DEFAULT_THREAD_TERMINAL_ID;
      const isBaseTerminalBusy = terminalState.runningTerminalIds.includes(baseTerminalId);
      const wantsNewTerminal = Boolean(options?.preferNewTerminal) || isBaseTerminalBusy;
      const shouldCreateNewTerminal = wantsNewTerminal;
      const targetTerminalId = shouldCreateNewTerminal
        ? `terminal-${randomUUID()}`
        : baseTerminalId;

      setTerminalOpen(true);
      if (shouldCreateNewTerminal) {
        storeNewTerminal(activeThreadId, targetTerminalId);
      } else {
        storeSetActiveTerminal(activeThreadId, targetTerminalId);
      }
      setTerminalFocusRequestId((value) => value + 1);

      const runtimeEnv = projectScriptRuntimeEnv({
        project: {
          cwd: activeProject.cwd,
        },
        worktreePath: options?.worktreePath ?? activeThread.worktreePath ?? null,
        ...(options?.env ? { extraEnv: options.env } : {}),
      });
      const openTerminalInput: Parameters<typeof api.terminal.open>[0] = shouldCreateNewTerminal
        ? {
            threadId: activeThreadId,
            terminalId: targetTerminalId,
            cwd: targetCwd,
            env: runtimeEnv,
            cols: SCRIPT_TERMINAL_COLS,
            rows: SCRIPT_TERMINAL_ROWS,
          }
        : {
            threadId: activeThreadId,
            terminalId: targetTerminalId,
            cwd: targetCwd,
            env: runtimeEnv,
          };

      try {
        await api.terminal.open(openTerminalInput);
        await api.terminal.write({
          threadId: activeThreadId,
          terminalId: targetTerminalId,
          data: `${script.command}\r`,
        });
      } catch (error) {
        setThreadError(
          activeThreadId,
          error instanceof Error ? error.message : `Failed to run script "${script.name}".`,
        );
      }
    },
    [
      activeProject,
      activeThread,
      activeThreadId,
      gitCwd,
      setTerminalOpen,
      setThreadError,
      storeNewTerminal,
      storeSetActiveTerminal,
      setLastInvokedScriptByProjectId,
      terminalState.activeTerminalId,
      terminalState.runningTerminalIds,
      terminalState.terminalIds,
    ],
  );
  const runProjectScript = useCallback(
    async (script: ProjectScript, options?: RunProjectScriptOptions) => {
      const inputIds = projectScriptTemplateInputs(script.command);
      if (inputIds.length === 0) {
        await executeProjectScript(script, options);
        return;
      }

      setPendingProjectScriptRun({
        script,
        inputIds,
        values: Object.fromEntries(inputIds.map((inputId) => [inputId, ""])),
        error: null,
        ...(options ? { options } : {}),
      });
    },
    [executeProjectScript],
  );
  const submitPendingProjectScriptRun = useCallback(async () => {
    if (!pendingProjectScriptRun) return;
    try {
      const resolvedCommand = interpolateProjectScriptCommand(
        pendingProjectScriptRun.script.command,
        pendingProjectScriptRun.values,
      );
      await executeProjectScript(
        {
          ...pendingProjectScriptRun.script,
          command: resolvedCommand,
        },
        pendingProjectScriptRun.options,
      );
      setPendingProjectScriptRun(null);
    } catch (error) {
      setPendingProjectScriptRun((current) =>
        current
          ? {
              ...current,
              error: error instanceof Error ? error.message : "Failed to resolve action inputs.",
            }
          : current,
      );
    }
  }, [executeProjectScript, pendingProjectScriptRun]);
  const persistProjectScripts = useCallback(
    async (input: {
      projectId: ProjectId;
      projectCwd: string;
      previousScripts: ProjectScript[];
      nextScripts: ProjectScript[];
      keybinding?: string | null;
      keybindingCommand?: KeybindingCommand;
    }) => {
      const api = readNativeApi();
      if (!api) return;

      await api.orchestration.dispatchCommand({
        type: "project.meta.update",
        commandId: newCommandId(),
        projectId: input.projectId,
        scripts: input.nextScripts,
      });

      const keybindingRule = input.keybindingCommand
        ? decodeProjectScriptKeybindingRule({
            keybinding: input.keybinding,
            command: input.keybindingCommand,
          })
        : null;

      if (isElectron && keybindingRule) {
        await api.server.upsertKeybinding(keybindingRule);
        await queryClient.invalidateQueries({ queryKey: serverQueryKeys.all });
      }
    },
    [queryClient],
  );
  const importProjectScripts = useCallback(
    async (drafts: ProjectScriptDraft[]) => {
      if (!activeProject) return;

      const nextScripts = materializeProjectScripts(drafts, activeProject.scripts);
      const unchanged = JSON.stringify(nextScripts) === JSON.stringify(activeProject.scripts);
      if (unchanged) {
        toastManager.add({
          type: "info",
          title: "Project actions are already up to date",
        });
        return;
      }

      const previousByName = new Map(
        activeProject.scripts.map((script) => [script.name.trim().toLowerCase(), script]),
      );
      let addedCount = 0;
      let updatedCount = 0;
      for (const draft of drafts) {
        const existingScript = previousByName.get(draft.name.trim().toLowerCase());
        if (!existingScript) {
          addedCount += 1;
          continue;
        }
        if (
          existingScript.command !== draft.command ||
          existingScript.icon !== draft.icon ||
          existingScript.runOnWorktreeCreate !== draft.runOnWorktreeCreate
        ) {
          updatedCount += 1;
        }
      }

      await persistProjectScripts({
        projectId: activeProject.id,
        projectCwd: activeProject.cwd,
        previousScripts: activeProject.scripts,
        nextScripts,
      });
      toastManager.add({
        type: "success",
        title:
          addedCount > 0 && updatedCount > 0
            ? `Imported ${addedCount} action${addedCount === 1 ? "" : "s"} and refreshed ${updatedCount}`
            : addedCount > 0
              ? `Imported ${addedCount} action${addedCount === 1 ? "" : "s"}`
              : `Refreshed ${updatedCount} imported action${updatedCount === 1 ? "" : "s"}`,
      });
    },
    [activeProject, persistProjectScripts],
  );
  const saveProjectScript = useCallback(
    async (input: NewProjectScriptInput) => {
      if (!activeProject) return;
      const nextId = nextProjectScriptId(
        input.name,
        activeProject.scripts.map((script) => script.id),
      );
      const nextScript: ProjectScript = {
        id: nextId,
        name: input.name,
        command: input.command,
        icon: input.icon,
        runOnWorktreeCreate: input.runOnWorktreeCreate,
      };
      const nextScripts = input.runOnWorktreeCreate
        ? [
            ...activeProject.scripts.map((script) =>
              script.runOnWorktreeCreate ? { ...script, runOnWorktreeCreate: false } : script,
            ),
            nextScript,
          ]
        : [...activeProject.scripts, nextScript];

      await persistProjectScripts({
        projectId: activeProject.id,
        projectCwd: activeProject.cwd,
        previousScripts: activeProject.scripts,
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(nextId),
      });
    },
    [activeProject, persistProjectScripts],
  );
  const updateProjectScript = useCallback(
    async (scriptId: string, input: NewProjectScriptInput) => {
      if (!activeProject) return;
      const existingScript = activeProject.scripts.find((script) => script.id === scriptId);
      if (!existingScript) {
        throw new Error("Script not found.");
      }

      const updatedScript: ProjectScript = {
        ...existingScript,
        name: input.name,
        command: input.command,
        icon: input.icon,
        runOnWorktreeCreate: input.runOnWorktreeCreate,
      };
      const nextScripts = activeProject.scripts.map((script) =>
        script.id === scriptId
          ? updatedScript
          : input.runOnWorktreeCreate
            ? { ...script, runOnWorktreeCreate: false }
            : script,
      );

      await persistProjectScripts({
        projectId: activeProject.id,
        projectCwd: activeProject.cwd,
        previousScripts: activeProject.scripts,
        nextScripts,
        keybinding: input.keybinding,
        keybindingCommand: commandForProjectScript(scriptId),
      });
    },
    [activeProject, persistProjectScripts],
  );
  const deleteProjectScript = useCallback(
    async (scriptId: string) => {
      if (!activeProject) return;
      const nextScripts = activeProject.scripts.filter((script) => script.id !== scriptId);

      const deletedName = activeProject.scripts.find((s) => s.id === scriptId)?.name;

      try {
        await persistProjectScripts({
          projectId: activeProject.id,
          projectCwd: activeProject.cwd,
          previousScripts: activeProject.scripts,
          nextScripts,
          keybinding: null,
          keybindingCommand: commandForProjectScript(scriptId),
        });
        toastManager.add({
          type: "success",
          title: `Deleted action "${deletedName ?? "Unknown"}"`,
        });
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Could not delete action",
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    },
    [activeProject, persistProjectScripts],
  );

  const handleRuntimeModeChange = useCallback(
    (mode: RuntimeMode) => {
      if (mode === runtimeMode) return;
      setComposerDraftRuntimeMode(threadId, mode);
      if (isLocalDraftThread) {
        setDraftThreadContext(threadId, { runtimeMode: mode });
      }
      scheduleComposerFocus();
    },
    [
      isLocalDraftThread,
      runtimeMode,
      scheduleComposerFocus,
      setComposerDraftRuntimeMode,
      setDraftThreadContext,
      threadId,
    ],
  );

  const handleInteractionModeChange = useCallback(
    (mode: ProviderInteractionMode) => {
      if (mode === interactionMode) return;
      setComposerDraftInteractionMode(threadId, mode);
      if (isLocalDraftThread) {
        setDraftThreadContext(threadId, { interactionMode: mode });
      }
      scheduleComposerFocus();
    },
    [
      interactionMode,
      isLocalDraftThread,
      scheduleComposerFocus,
      setComposerDraftInteractionMode,
      setDraftThreadContext,
      threadId,
    ],
  );
  const toggleInteractionMode = useCallback(() => {
    const idx = Math.max(0, INTERACTION_MODE_CYCLE.indexOf(interactionMode));
    const next = INTERACTION_MODE_CYCLE[(idx + 1) % INTERACTION_MODE_CYCLE.length]!;
    handleInteractionModeChange(next);
  }, [handleInteractionModeChange, interactionMode]);
  const toggleRuntimeMode = useCallback(() => {
    void handleRuntimeModeChange(
      runtimeMode === "full-access" ? "approval-required" : "full-access",
    );
  }, [handleRuntimeModeChange, runtimeMode]);
  const togglePlanSidebar = useCallback(() => {
    setPlanSidebarOpen((open) => {
      if (open) {
        const turnKey =
          activePlan?.turnId ?? sidebarProposedPlan?.turnId ?? activeLatestTurn?.turnId ?? null;
        if (turnKey) {
          planSidebarDismissedForTurnRef.current = turnKey;
        }
      } else {
        planSidebarDismissedForTurnRef.current = null;
      }
      return !open;
    });
  }, [activeLatestTurn?.turnId, activePlan?.turnId, sidebarProposedPlan?.turnId]);

  const persistThreadSettingsForNextTurn = useCallback(
    async (input: {
      threadId: ThreadId;
      createdAt: string;
      model?: string;
      runtimeMode: RuntimeMode;
      interactionMode: ProviderInteractionMode;
    }) => {
      if (!serverThread) {
        return;
      }
      const api = readNativeApi();
      if (!api) {
        return;
      }

      if (input.model !== undefined && input.model !== serverThread.model) {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: input.threadId,
          model: input.model,
        });
      }

      if (input.runtimeMode !== serverThread.runtimeMode) {
        await api.orchestration.dispatchCommand({
          type: "thread.runtime-mode.set",
          commandId: newCommandId(),
          threadId: input.threadId,
          runtimeMode: input.runtimeMode,
          createdAt: input.createdAt,
        });
      }

      if (input.interactionMode !== serverThread.interactionMode) {
        await api.orchestration.dispatchCommand({
          type: "thread.interaction-mode.set",
          commandId: newCommandId(),
          threadId: input.threadId,
          interactionMode: input.interactionMode,
          createdAt: input.createdAt,
        });
      }
    },
    [serverThread],
  );

  // Auto-scroll on new messages
  const messageCount = timelineMessages.length;
  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior });
    lastKnownScrollTopRef.current = scrollContainer.scrollTop;
    shouldAutoScrollRef.current = true;
  }, []);
  const cancelPendingStickToBottom = useCallback(() => {
    const pendingFrame = pendingAutoScrollFrameRef.current;
    if (pendingFrame === null) return;
    pendingAutoScrollFrameRef.current = null;
    window.cancelAnimationFrame(pendingFrame);
  }, []);
  const cancelPendingInteractionAnchorAdjustment = useCallback(() => {
    const pendingFrame = pendingInteractionAnchorFrameRef.current;
    if (pendingFrame === null) return;
    pendingInteractionAnchorFrameRef.current = null;
    window.cancelAnimationFrame(pendingFrame);
  }, []);
  const scheduleStickToBottom = useCallback(() => {
    if (pendingAutoScrollFrameRef.current !== null) return;
    pendingAutoScrollFrameRef.current = window.requestAnimationFrame(() => {
      pendingAutoScrollFrameRef.current = null;
      scrollMessagesToBottom();
    });
  }, [scrollMessagesToBottom]);
  const onMessagesClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const scrollContainer = messagesScrollRef.current;
      if (!scrollContainer || !(event.target instanceof Element)) return;

      const trigger = event.target.closest<HTMLElement>(
        "button, summary, [role='button'], [data-scroll-anchor-target]",
      );
      if (!trigger || !scrollContainer.contains(trigger)) return;
      if (trigger.closest("[data-scroll-anchor-ignore]")) return;

      pendingInteractionAnchorRef.current = {
        element: trigger,
        top: trigger.getBoundingClientRect().top,
      };

      cancelPendingInteractionAnchorAdjustment();
      pendingInteractionAnchorFrameRef.current = window.requestAnimationFrame(() => {
        pendingInteractionAnchorFrameRef.current = null;
        const anchor = pendingInteractionAnchorRef.current;
        pendingInteractionAnchorRef.current = null;
        const activeScrollContainer = messagesScrollRef.current;
        if (!anchor || !activeScrollContainer) return;
        if (!anchor.element.isConnected || !activeScrollContainer.contains(anchor.element)) return;

        const nextTop = anchor.element.getBoundingClientRect().top;
        const delta = nextTop - anchor.top;
        if (Math.abs(delta) < 0.5) return;

        activeScrollContainer.scrollTop += delta;
        lastKnownScrollTopRef.current = activeScrollContainer.scrollTop;
      });
    },
    [cancelPendingInteractionAnchorAdjustment],
  );
  const forceStickToBottom = useCallback(() => {
    cancelPendingStickToBottom();
    scrollMessagesToBottom();
    scheduleStickToBottom();
  }, [cancelPendingStickToBottom, scheduleStickToBottom, scrollMessagesToBottom]);
  const onMessagesScroll = useCallback(() => {
    const scrollContainer = messagesScrollRef.current;
    if (!scrollContainer) return;
    const currentScrollTop = scrollContainer.scrollTop;
    const isNearBottom = isScrollContainerNearBottom(scrollContainer);

    if (!shouldAutoScrollRef.current && isNearBottom) {
      shouldAutoScrollRef.current = true;
      pendingUserScrollUpIntentRef.current = false;
    } else if (shouldAutoScrollRef.current && pendingUserScrollUpIntentRef.current) {
      const scrolledUp = currentScrollTop < lastKnownScrollTopRef.current - 1;
      if (scrolledUp) {
        shouldAutoScrollRef.current = false;
      }
      pendingUserScrollUpIntentRef.current = false;
    } else if (shouldAutoScrollRef.current && isPointerScrollActiveRef.current) {
      const scrolledUp = currentScrollTop < lastKnownScrollTopRef.current - 1;
      if (scrolledUp) {
        shouldAutoScrollRef.current = false;
      }
    } else if (shouldAutoScrollRef.current && !isNearBottom) {
      // Catch-all for keyboard/assistive scroll interactions.
      const scrolledUp = currentScrollTop < lastKnownScrollTopRef.current - 1;
      if (scrolledUp) {
        shouldAutoScrollRef.current = false;
      }
    }

    setShowScrollToBottom(!shouldAutoScrollRef.current);
    lastKnownScrollTopRef.current = currentScrollTop;
  }, []);
  const onMessagesWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      pendingUserScrollUpIntentRef.current = true;
    }
  }, []);
  const onMessagesPointerDown = useCallback((_event: React.PointerEvent<HTMLDivElement>) => {
    isPointerScrollActiveRef.current = true;
  }, []);
  const onMessagesPointerUp = useCallback((_event: React.PointerEvent<HTMLDivElement>) => {
    isPointerScrollActiveRef.current = false;
  }, []);
  const onMessagesPointerCancel = useCallback((_event: React.PointerEvent<HTMLDivElement>) => {
    isPointerScrollActiveRef.current = false;
  }, []);
  const onMessagesTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    lastTouchClientYRef.current = touch.clientY;
  }, []);
  const onMessagesTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    const previousTouchY = lastTouchClientYRef.current;
    if (previousTouchY !== null && touch.clientY > previousTouchY + 1) {
      pendingUserScrollUpIntentRef.current = true;
    }
    lastTouchClientYRef.current = touch.clientY;
  }, []);
  const onMessagesTouchEnd = useCallback((_event: React.TouchEvent<HTMLDivElement>) => {
    lastTouchClientYRef.current = null;
  }, []);
  useEffect(() => {
    return () => {
      cancelPendingStickToBottom();
      cancelPendingInteractionAnchorAdjustment();
    };
  }, [cancelPendingInteractionAnchorAdjustment, cancelPendingStickToBottom]);
  useLayoutEffect(() => {
    if (!activeThread?.id) return;
    shouldAutoScrollRef.current = true;
    scheduleStickToBottom();
    const timeout = window.setTimeout(() => {
      const scrollContainer = messagesScrollRef.current;
      if (!scrollContainer) return;
      if (isScrollContainerNearBottom(scrollContainer)) return;
      scheduleStickToBottom();
    }, 96);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeThread?.id, scheduleStickToBottom]);
  useLayoutEffect(() => {
    const composerForm = composerFormRef.current;
    if (!composerForm) return;
    const measureComposerFooterWidth = () => {
      const footer = composerFooterRef.current;
      if (!footer) return composerForm.clientWidth;
      const footerStyle = window.getComputedStyle(footer);
      const horizontalPadding =
        Number.parseFloat(footerStyle.paddingLeft || "0") +
        Number.parseFloat(footerStyle.paddingRight || "0");
      return Math.max(0, footer.clientWidth - horizontalPadding);
    };
    const measureComposerFooterGap = () => {
      const footer = composerFooterRef.current;
      if (!footer) return 0;
      const footerStyle = window.getComputedStyle(footer);
      return Number.parseFloat(footerStyle.columnGap || footerStyle.gap || "0") || 0;
    };
    const measureIsComposerFooterCompact = () =>
      shouldUseCompactComposerFooter(measureComposerFooterWidth(), {
        hasWideActions: composerFooterHasWideActions,
        leadingWidth: composerFooterLeadingRef.current?.scrollWidth ?? null,
        trailingWidth: composerFooterActionsRef.current?.scrollWidth ?? null,
        gap: measureComposerFooterGap(),
      });

    composerFormHeightRef.current = composerForm.getBoundingClientRect().height;
    setIsComposerFooterCompact(measureIsComposerFooterCompact());
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;

      const nextCompact = measureIsComposerFooterCompact();
      setIsComposerFooterCompact((previous) => (previous === nextCompact ? previous : nextCompact));

      const nextHeight = entry.contentRect.height;
      const previousHeight = composerFormHeightRef.current;
      composerFormHeightRef.current = nextHeight;

      if (previousHeight > 0 && Math.abs(nextHeight - previousHeight) < 0.5) return;
      if (!shouldAutoScrollRef.current) return;
      scheduleStickToBottom();
    });

    observer.observe(composerForm);
    const composerFooter = composerFooterRef.current;
    if (composerFooter) observer.observe(composerFooter);
    const composerFooterLeading = composerFooterLeadingRef.current;
    if (composerFooterLeading) observer.observe(composerFooterLeading);
    const composerFooterActions = composerFooterActionsRef.current;
    if (composerFooterActions) observer.observe(composerFooterActions);
    return () => {
      observer.disconnect();
    };
  }, [
    activeContextWindow,
    activePlan,
    activeThread?.id,
    composerFooterHasWideActions,
    interactionMode,
    lockedProvider,
    phase,
    planSidebarOpen,
    queuedMessages.length,
    runtimeMode,
    scheduleStickToBottom,
    selectedModelForPickerWithCustomFallback,
    selectedProvider,
    sidebarProposedPlan,
  ]);
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    scheduleStickToBottom();
  }, [messageCount, scheduleStickToBottom]);
  useEffect(() => {
    if (phase !== "running") return;
    if (!shouldAutoScrollRef.current) return;
    scheduleStickToBottom();
  }, [phase, scheduleStickToBottom, timelineEntries]);

  // Aggressively scroll to bottom after the user submits a new message.
  // The virtualizer may not have settled by the time the first scroll fires,
  // so we schedule multiple backup attempts similar to the thread-change handler.
  const optimisticUserMessageCount = optimisticUserMessages.length;
  useEffect(() => {
    if (optimisticUserMessageCount === 0) return;
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
    forceStickToBottom();
    const t1 = window.setTimeout(() => {
      forceStickToBottom();
    }, 50);
    const t2 = window.setTimeout(() => {
      forceStickToBottom();
    }, 150);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [optimisticUserMessageCount, forceStickToBottom]);

  useEffect(() => {
    setExpandedWorkGroups({});
    setPullRequestDialogState(null);
    if (planSidebarOpenOnNextThreadRef.current) {
      planSidebarOpenOnNextThreadRef.current = false;
      setPlanSidebarOpen(true);
    } else {
      setPlanSidebarOpen(false);
    }
    planSidebarDismissedForTurnRef.current = null;
  }, [activeThread?.id]);

  useEffect(() => {
    if (!composerMenuOpen) {
      setComposerHighlightedItemId(null);
      return;
    }
    setComposerHighlightedItemId((existing) =>
      existing && composerMenuItems.some((item) => item.id === existing)
        ? existing
        : (composerMenuItems[0]?.id ?? null),
    );
  }, [composerMenuItems, composerMenuOpen]);

  useEffect(() => {
    setIsRevertingCheckpoint(false);
  }, [activeThread?.id]);

  useEffect(() => {
    if (!activeThread?.id || terminalState.terminalOpen) return;
    const frame = window.requestAnimationFrame(() => {
      focusComposer();
    });
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeThread?.id, focusComposer, terminalState.terminalOpen]);

  useEffect(() => {
    composerAttachmentsRef.current = composerAttachments;
  }, [composerAttachments]);

  useEffect(() => {
    composerTerminalContextsRef.current = composerTerminalContexts;
  }, [composerTerminalContexts]);

  useEffect(() => {
    if (!activeThread?.id) return;
    if (activeThread.messages.length === 0) {
      return;
    }
    const serverIds = new Set(activeThread.messages.map((message) => message.id));
    const removedMessages = optimisticUserMessages.filter((message) => serverIds.has(message.id));
    if (removedMessages.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setOptimisticUserMessages((existing) =>
        existing.filter((message) => !serverIds.has(message.id)),
      );
    }, 0);
    for (const removedMessage of removedMessages) {
      const previewUrls = collectUserMessageBlobPreviewUrls(removedMessage);
      if (previewUrls.length > 0) {
        handoffAttachmentPreviews(removedMessage.id, previewUrls);
        continue;
      }
      revokeUserMessagePreviewUrls(removedMessage);
    }
    return () => {
      window.clearTimeout(timer);
    };
  }, [activeThread?.id, activeThread?.messages, handoffAttachmentPreviews, optimisticUserMessages]);

  useEffect(() => {
    promptRef.current = prompt;
    setComposerCursor((existing) => clampCollapsedComposerCursor(prompt, existing));
  }, [prompt]);

  useEffect(() => {
    setOptimisticUserMessages((existing) => {
      for (const message of existing) {
        revokeUserMessagePreviewUrls(message);
      }
      return [];
    });
    setQueuedMessages([]);
    setSendPhase("idle");
    setSendStartedAt(null);
    setComposerHighlightedItemId(null);
    setComposerCursor(collapseExpandedComposerCursor(promptRef.current, promptRef.current.length));
    setComposerTrigger(detectComposerTrigger(promptRef.current, promptRef.current.length));
    dragDepthRef.current = 0;
    setIsDragOverComposer(false);
    setExpandedImage(null);
  }, [threadId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (composerAttachments.length === 0) {
        clearComposerDraftPersistedAttachments(threadId);
        return;
      }
      const getPersistedAttachmentsForThread = () =>
        useComposerDraftStore.getState().draftsByThreadId[threadId]?.persistedAttachments ?? [];
      try {
        const currentPersistedAttachments = getPersistedAttachmentsForThread();
        const existingPersistedById = new Map(
          currentPersistedAttachments.map((attachment) => [attachment.id, attachment]),
        );
        const stagedAttachmentById = new Map<string, PersistedComposerAttachment>();
        await Promise.all(
          composerAttachments.map(async (attachment) => {
            try {
              const dataUrl = await readFileAsDataUrl(attachment.file);
              stagedAttachmentById.set(attachment.id, {
                type: attachment.type,
                id: attachment.id,
                name: attachment.name,
                mimeType: attachment.mimeType,
                sizeBytes: attachment.sizeBytes,
                dataUrl,
              });
            } catch {
              const existingPersisted = existingPersistedById.get(attachment.id);
              if (existingPersisted) {
                stagedAttachmentById.set(attachment.id, existingPersisted);
              }
            }
          }),
        );
        const serialized = Array.from(stagedAttachmentById.values());
        if (cancelled) {
          return;
        }
        // Stage attachments in persisted draft state first so persist middleware can write them.
        syncComposerDraftPersistedAttachments(threadId, serialized);
      } catch {
        const currentAttachmentIds = new Set(
          composerAttachments.map((attachment) => attachment.id),
        );
        const fallbackPersistedAttachments = getPersistedAttachmentsForThread();
        const fallbackPersistedIds = fallbackPersistedAttachments
          .map((attachment) => attachment.id)
          .filter((id) => currentAttachmentIds.has(id));
        const fallbackPersistedIdSet = new Set(fallbackPersistedIds);
        const fallbackAttachments = fallbackPersistedAttachments.filter((attachment) =>
          fallbackPersistedIdSet.has(attachment.id),
        );
        if (cancelled) {
          return;
        }
        syncComposerDraftPersistedAttachments(threadId, fallbackAttachments);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    clearComposerDraftPersistedAttachments,
    composerAttachments,
    syncComposerDraftPersistedAttachments,
    threadId,
  ]);

  const closeExpandedImage = useCallback(() => {
    setExpandedImage(null);
  }, []);
  const navigateExpandedImage = useCallback((direction: -1 | 1) => {
    setExpandedImage((existing) => {
      if (!existing || existing.images.length <= 1) {
        return existing;
      }
      const nextIndex =
        (existing.index + direction + existing.images.length) % existing.images.length;
      if (nextIndex === existing.index) {
        return existing;
      }
      return { ...existing, index: nextIndex };
    });
  }, []);

  useEffect(() => {
    if (!expandedImage) {
      return;
    }

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeExpandedImage();
        return;
      }
      if (expandedImage.images.length <= 1) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        event.stopPropagation();
        navigateExpandedImage(-1);
        return;
      }
      if (event.key !== "ArrowRight") return;
      event.preventDefault();
      event.stopPropagation();
      navigateExpandedImage(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeExpandedImage, expandedImage, navigateExpandedImage]);

  const activeWorktreePath = activeThread?.worktreePath;
  const envMode: DraftThreadEnvMode = activeWorktreePath
    ? "worktree"
    : isLocalDraftThread
      ? (draftThread?.envMode ?? "local")
      : "local";

  useEffect(() => {
    if (phase !== "running") return;
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [phase]);

  const beginSendPhase = useCallback((nextPhase: Exclude<SendPhase, "idle">) => {
    setSendStartedAt((current) => current ?? new Date().toISOString());
    setSendPhase(nextPhase);
  }, []);

  const resetSendPhase = useCallback(() => {
    setSendPhase("idle");
    setSendStartedAt(null);
  }, []);

  useEffect(() => {
    if (sendPhase === "idle") {
      return;
    }
    if (
      phase === "running" ||
      activePendingApproval !== null ||
      activePendingUserInput !== null ||
      activeThread?.error
    ) {
      resetSendPhase();
    }
  }, [
    activePendingApproval,
    activePendingUserInput,
    activeThread?.error,
    phase,
    resetSendPhase,
    sendPhase,
  ]);

  // ── Queue drain: dispatch next queued message when the current turn settles ──
  const isDrainingQueueRef = useRef(false);
  useEffect(() => {
    if (!latestTurnSettled || queuedMessages.length === 0) return;
    if (isSendBusy || isConnecting || sendInFlightRef.current || isDrainingQueueRef.current) return;
    if (!activeThread || !activeProject) return;
    const api = readNativeApi();
    if (!api) return;

    const [nextQueued, ...rest] = queuedMessages;
    if (!nextQueued) return;

    isDrainingQueueRef.current = true;
    setQueuedMessages(rest);

    // Mark the optimistic message as no longer queued
    setOptimisticUserMessages((existing) =>
      existing.map((msg) => (msg.id === nextQueued.id ? { ...msg, queued: false } : msg)),
    );

    const threadIdForSend = activeThread.id;
    const messageIdForSend = nextQueued.id;
    const messageCreatedAt = new Date().toISOString();
    const composerTerminalContextsSnapshot = nextQueued.terminalContexts;
    const messageTextForSend = appendTerminalContextsToPrompt(
      nextQueued.text,
      composerTerminalContextsSnapshot,
    );
    const fallbackOutgoingText = nextQueued.attachments.some(
      (attachment) => attachment.type === "image",
    )
      ? IMAGE_ONLY_BOOTSTRAP_PROMPT
      : "";
    const outgoingMessageText = formatOutgoingPrompt({
      provider: selectedProvider,
      effort: selectedPromptEffort,
      text: messageTextForSend || fallbackOutgoingText,
    });

    sendInFlightRef.current = true;
    beginSendPhase("sending-turn");

    (async () => {
      await persistThreadSettingsForNextTurn({
        threadId: threadIdForSend,
        createdAt: messageCreatedAt,
        ...(selectedModel ? { model: selectedModel } : {}),
        runtimeMode,
        interactionMode,
      });
      const turnAttachments = await Promise.all(
        nextQueued.attachments.map(async (attachment) => ({
          type: attachment.type,
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          dataUrl: await readFileAsDataUrl(attachment.file),
        })),
      );
      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: newCommandId(),
        threadId: threadIdForSend,
        message: {
          messageId: messageIdForSend,
          role: "user",
          text: outgoingMessageText,
          attachments: turnAttachments,
        },
        ...(nextQueued.providerInput ? { providerInput: nextQueued.providerInput } : {}),
        model: selectedModel || undefined,
        ...(selectedModelOptionsForDispatch
          ? { modelOptions: selectedModelOptionsForDispatch }
          : {}),
        ...(providerOptionsForDispatch ? { providerOptions: providerOptionsForDispatch } : {}),
        provider: selectedProvider,
        assistantDeliveryMode: settings.enableAssistantStreaming ? "streaming" : "buffered",
        runtimeMode,
        interactionMode,
        createdAt: messageCreatedAt,
      });
    })()
      .catch((err: unknown) => {
        setOptimisticUserMessages((existing) => existing.filter((msg) => msg.id !== nextQueued.id));
        setThreadError(
          threadIdForSend,
          err instanceof Error ? err.message : "Failed to send queued message.",
        );
        resetSendPhase();
      })
      .finally(() => {
        sendInFlightRef.current = false;
        isDrainingQueueRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestTurnSettled, queuedMessages.length, isSendBusy, isConnecting]);

  useEffect(() => {
    if (!activeThreadId) return;
    const previous = terminalOpenByThreadRef.current[activeThreadId] ?? false;
    const current = Boolean(terminalState.terminalOpen);

    if (!previous && current) {
      terminalOpenByThreadRef.current[activeThreadId] = current;
      setTerminalFocusRequestId((value) => value + 1);
      return;
    } else if (previous && !current) {
      terminalOpenByThreadRef.current[activeThreadId] = current;
      const frame = window.requestAnimationFrame(() => {
        focusComposer();
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    terminalOpenByThreadRef.current[activeThreadId] = current;
  }, [activeThreadId, focusComposer, terminalState.terminalOpen]);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (!activeThreadId || event.defaultPrevented) return;
      const shortcutContext = {
        terminalFocus: isTerminalFocused(),
        terminalOpen: Boolean(terminalState.terminalOpen),
      };

      const command = resolveShortcutCommand(event, keybindings, {
        context: shortcutContext,
      });
      if (!command) return;

      if (command === "terminal.toggle") {
        event.preventDefault();
        event.stopPropagation();
        toggleTerminalVisibility();
        return;
      }

      if (command === "terminal.split") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) {
          setTerminalOpen(true);
        }
        splitTerminal();
        return;
      }

      if (command === "terminal.close") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) return;
        closeTerminal(terminalState.activeTerminalId);
        return;
      }

      if (command === "terminal.new") {
        event.preventDefault();
        event.stopPropagation();
        if (!terminalState.terminalOpen) {
          setTerminalOpen(true);
        }
        createNewTerminal();
        return;
      }

      if (command === "git.pullRequest") {
        event.preventDefault();
        event.stopPropagation();
        dispatchGitPullRequestAction(activeThreadId);
        return;
      }

      const scriptId = projectScriptIdFromCommand(command);
      if (!scriptId || !activeProject) return;
      const script = activeProject.scripts.find((entry) => entry.id === scriptId);
      if (!script) return;
      event.preventDefault();
      event.stopPropagation();
      void runProjectScript(script);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    activeProject,
    terminalState.terminalOpen,
    terminalState.activeTerminalId,
    activeThreadId,
    closeTerminal,
    createNewTerminal,
    setTerminalOpen,
    runProjectScript,
    splitTerminal,
    keybindings,
    toggleTerminalVisibility,
  ]);

  const addComposerAttachments = (files: File[]) => {
    if (!activeThreadId || files.length === 0) return;

    if (pendingUserInputs.length > 0) {
      toastManager.add({
        type: "error",
        title: "Attach files after answering plan questions.",
      });
      return;
    }

    const nextAttachments: ComposerAttachment[] = [];
    let nextAttachmentCount = composerAttachmentsRef.current.length;
    let error: string | null = null;
    for (const file of files) {
      if (nextAttachmentCount >= PROVIDER_SEND_TURN_MAX_ATTACHMENTS) {
        error = `You can attach up to ${PROVIDER_SEND_TURN_MAX_ATTACHMENTS} files per message.`;
        break;
      }

      const mimeType = composerAttachmentMimeType(file);
      if (mimeType.startsWith("image/")) {
        if (file.size > PROVIDER_SEND_TURN_MAX_IMAGE_BYTES) {
          error = `'${file.name}' exceeds the ${IMAGE_SIZE_LIMIT_LABEL} attachment limit.`;
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        nextAttachments.push({
          type: "image",
          id: randomUUID(),
          name: file.name || "image",
          mimeType,
          sizeBytes: file.size,
          previewUrl,
          file,
        });
        nextAttachmentCount += 1;
        continue;
      }

      if (file.size > PROVIDER_SEND_TURN_MAX_FILE_BYTES) {
        error = `'${file.name}' exceeds the ${FILE_SIZE_LIMIT_LABEL} attachment limit.`;
        continue;
      }
      nextAttachments.push({
        type: "file",
        id: randomUUID(),
        name: file.name || "file",
        mimeType,
        sizeBytes: file.size,
        file,
      });
      nextAttachmentCount += 1;
    }

    if (nextAttachments.length === 1 && nextAttachments[0]) {
      addComposerAttachment(nextAttachments[0]);
    } else if (nextAttachments.length > 1) {
      addComposerAttachmentsToDraft(nextAttachments);
    }
    setThreadError(activeThreadId, error);
  };

  const removeComposerAttachment = (attachmentId: string) => {
    removeComposerAttachmentFromDraft(attachmentId);
  };

  const onComposerPaste = (event: React.ClipboardEvent<HTMLElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    addComposerAttachments(files);
  };

  const onComposerDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDragType(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current += 1;
    setDragOverType(isDragTreePath(event.dataTransfer) ? "tree-path" : "files");
    setIsDragOverComposer(true);
  };

  const onComposerDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDragType(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragOverComposer(true);
  };

  const onComposerDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDragType(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOverComposer(false);
    }
  };

  const onComposerDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isAcceptedDragType(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOverComposer(false);

    // Handle file tree path drops — insert as @mention context
    if (isDragTreePath(event.dataTransfer)) {
      const treePath = event.dataTransfer.getData("application/x-okcode-tree-path");
      if (treePath) {
        const snapshot = readComposerSnapshot();
        const mention = `@${treePath} `;
        // Insert at the current cursor position
        applyPromptReplacement(snapshot.cursor, snapshot.cursor, mention);
      }
      focusComposer();
      return;
    }

    // Handle file drops
    const files = Array.from(event.dataTransfer.files);
    addComposerAttachments(files);
    focusComposer();
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      addComposerAttachments(files);
    }
    // Reset so the same file can be selected again
    event.target.value = "";
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onRevertToTurnCount = useCallback(
    async (turnCount: number) => {
      const api = readNativeApi();
      if (!api || !activeThread || isRevertingCheckpoint) return;

      if (phase === "running" || isSendBusy || isConnecting) {
        setThreadError(activeThread.id, "Interrupt the current turn before reverting checkpoints.");
        return;
      }
      const confirmed = await api.dialogs.confirm(
        [
          `Revert this thread to checkpoint ${turnCount}?`,
          "This will discard newer messages and turn diffs in this thread.",
          "This action cannot be undone.",
        ].join("\n"),
      );
      if (!confirmed) {
        return;
      }

      setIsRevertingCheckpoint(true);
      setThreadError(activeThread.id, null);
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.checkpoint.revert",
          commandId: newCommandId(),
          threadId: activeThread.id,
          turnCount,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        setThreadError(
          activeThread.id,
          err instanceof Error ? err.message : "Failed to revert thread state.",
        );
      }
      setIsRevertingCheckpoint(false);
    },
    [activeThread, isConnecting, isRevertingCheckpoint, isSendBusy, phase, setThreadError],
  );

  const readLiveComposerDraftSnapshot = useCallback(() => {
    const latestDraft = activeThread
      ? useComposerDraftStore.getState().draftsByThreadId[activeThread.id]
      : null;
    const nextPrompt = latestDraft?.prompt ?? promptRef.current;
    const nextPromptEnhancement = latestDraft?.promptEnhancement ?? composerPromptEnhancement;
    const nextPromptEnhancementOriginalPrompt =
      latestDraft?.promptEnhancementOriginalPrompt ?? composerPromptEnhancementOriginalPrompt;
    const nextAttachments = latestDraft?.attachments ?? composerAttachmentsRef.current;
    const nextTerminalContexts =
      latestDraft?.terminalContexts ?? composerTerminalContextsRef.current;
    promptRef.current = nextPrompt;
    composerAttachmentsRef.current = nextAttachments;
    composerTerminalContextsRef.current = nextTerminalContexts;
    return {
      prompt: nextPrompt,
      promptEnhancement: nextPromptEnhancement,
      promptEnhancementOriginalPrompt: nextPromptEnhancementOriginalPrompt,
      attachments: nextAttachments,
      terminalContexts: nextTerminalContexts,
    };
  }, [activeThread, composerPromptEnhancement, composerPromptEnhancementOriginalPrompt]);

  const onSend = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const api = readNativeApi();
    if (!api || !activeThread || isSendBusy || isConnecting || sendInFlightRef.current) return;
    if (activePendingProgress) {
      onAdvanceActivePendingUserInput();
      return;
    }
    const liveComposerDraft = readLiveComposerDraftSnapshot();
    const promptForSend = liveComposerDraft.prompt;
    const promptEnhancementForSend = liveComposerDraft.promptEnhancement;
    const promptEnhancementOriginalPromptForSend =
      liveComposerDraft.promptEnhancementOriginalPrompt;
    const composerAttachmentsForSend = liveComposerDraft.attachments;
    const composerTerminalContextsForSend = liveComposerDraft.terminalContexts;
    const {
      trimmedPrompt: trimmed,
      sendableTerminalContexts: sendableComposerTerminalContexts,
      expiredTerminalContextCount,
      hasSendableContent,
    } = deriveComposerSendState({
      prompt: promptForSend,
      attachmentCount: composerAttachmentsForSend.length,
      terminalContexts: composerTerminalContextsForSend,
    });
    if (showPlanFollowUpPrompt && activeProposedPlan) {
      const followUp = resolvePlanFollowUpSubmission({
        draftText: trimmed,
        planMarkdown: activeProposedPlan.planMarkdown,
      });
      promptRef.current = "";
      clearComposerDraftContent(activeThread.id);
      setComposerHighlightedItemId(null);
      setComposerCursor(0);
      setComposerTrigger(null);
      await onSubmitPlanFollowUp({
        text: followUp.text,
        interactionMode: followUp.interactionMode,
      });
      return;
    }
    const standaloneSlashCommand =
      composerAttachmentsForSend.length === 0 && sendableComposerTerminalContexts.length === 0
        ? parseStandaloneComposerSlashCommand(trimmed)
        : null;
    if (standaloneSlashCommand) {
      if (standaloneSlashCommand !== "skill") {
        handleInteractionModeChange(standaloneSlashCommand);
      }
      promptRef.current = "";
      clearComposerDraftContent(activeThread.id);
      setComposerHighlightedItemId(null);
      setComposerCursor(0);
      setComposerTrigger(null);
      return;
    }
    const skillManagementCommand =
      composerAttachmentsForSend.length === 0 && sendableComposerTerminalContexts.length === 0
        ? parseSkillManagementCommand(trimmed)
        : null;
    if (skillManagementCommand) {
      const api = ensureNativeApi();
      try {
        if (skillManagementCommand.subcommand === "browse") {
          void navigate({ to: "/skills", search: { create: undefined, name: undefined } });
        } else if (skillManagementCommand.subcommand === "create") {
          void navigate({
            to: "/skills",
            search: {
              create: "1",
              name: skillManagementCommand.argument
                ? skillManagementCommand.argument.split(/\s+/)[0]
                : undefined,
            },
          });
        } else if (skillManagementCommand.subcommand === "list") {
          const result = await api.skills.list(gitCwd ? { cwd: gitCwd } : {});
          toastManager.add({
            type: "info",
            title: `Installed skills: ${result.skills.length}`,
            description:
              result.skills.length > 0
                ? result.skills
                    .slice(0, 8)
                    .map((skill) => `/${skill.name}`)
                    .join(", ")
                : "No skills are currently installed for this context.",
          });
        } else if (skillManagementCommand.subcommand === "search") {
          if (!skillManagementCommand.argument) {
            throw new Error("Usage: /skill search <query>");
          }
          const result = await api.skills.search({
            query: skillManagementCommand.argument,
            ...(gitCwd ? { cwd: gitCwd } : {}),
          });
          toastManager.add({
            type: "info",
            title: `Matching skills: ${result.skills.length}`,
            description:
              result.skills.length > 0
                ? result.skills
                    .slice(0, 8)
                    .map((skill) => `/${skill.name}`)
                    .join(", ")
                : "No skills matched that query.",
          });
        } else if (skillManagementCommand.subcommand === "read") {
          if (!skillManagementCommand.argument) {
            throw new Error("Usage: /skill read <name>");
          }
          const result = await api.skills.read({
            name: skillManagementCommand.argument,
            ...(gitCwd ? { cwd: gitCwd } : {}),
          });
          await openFileReference({
            api,
            cwd: gitCwd ?? undefined,
            targetPath: result.path,
            preferExternal: true,
            openInViewer: () => undefined,
          });
        } else if (skillManagementCommand.subcommand === "install") {
          if (!skillManagementCommand.argument) {
            throw new Error("Usage: /skill install <name>");
          }
          const [skillName, scopeFlag] = skillManagementCommand.argument.split(/\s+--scope\s+/);
          if (!skillName) {
            throw new Error("Usage: /skill install <name>");
          }
          const scope = scopeFlag?.trim() === "project" && gitCwd ? "project" : "global";
          const catalog = await api.skills.catalog(gitCwd ? { cwd: gitCwd } : {});
          const target = catalog.skills.find(
            (skill) =>
              skill.id === skillName || skill.name.toLowerCase() === skillName.toLowerCase(),
          );
          if (!target) {
            throw new Error(`Bundled skill "${skillName}" not found`);
          }
          await api.skills.install({
            id: target.id,
            scope,
            ...(scope === "project" && gitCwd ? { cwd: gitCwd } : {}),
          });
          void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });
          toastManager.add({
            type: "success",
            title: `Installed /${target.name.toLowerCase()}`,
          });
        } else if (skillManagementCommand.subcommand === "uninstall") {
          if (!skillManagementCommand.argument) {
            throw new Error("Usage: /skill uninstall <name>");
          }
          const [skillName, scopeFlag] = skillManagementCommand.argument.split(/\s+--scope\s+/);
          if (!skillName) {
            throw new Error("Usage: /skill uninstall <name>");
          }
          const scope = scopeFlag?.trim() === "project" && gitCwd ? "project" : "global";
          await api.skills.uninstall({
            name: skillName,
            scope,
            ...(scope === "project" && gitCwd ? { cwd: gitCwd } : {}),
          });
          void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });
          toastManager.add({
            type: "success",
            title: `Removed /${skillName}`,
          });
        } else if (skillManagementCommand.subcommand === "import") {
          if (!skillManagementCommand.argument) {
            throw new Error("Usage: /skill import <path>");
          }
          const [importPath, scopeFlag] = skillManagementCommand.argument.split(/\s+--scope\s+/);
          if (!importPath) {
            throw new Error("Usage: /skill import <path>");
          }
          const scope = scopeFlag?.trim() === "project" && gitCwd ? "project" : "global";
          const result = await api.skills.import({
            path: importPath,
            scope,
            ...(scope === "project" && gitCwd ? { cwd: gitCwd } : {}),
          });
          void queryClient.invalidateQueries({ queryKey: skillQueryKeys.all });
          toastManager.add({
            type: "success",
            title: `Imported /${result.name}`,
          });
        }
      } catch (error) {
        toastManager.add({
          type: "error",
          title: "Skill command failed",
          description: error instanceof Error ? error.message : String(error),
        });
      }
      promptRef.current = "";
      clearComposerDraftContent(activeThread.id);
      setComposerHighlightedItemId(null);
      setComposerCursor(0);
      setComposerTrigger(null);
      return;
    }
    if (!hasSendableContent) {
      if (expiredTerminalContextCount > 0) {
        const toastCopy = buildExpiredTerminalContextToastCopy(
          expiredTerminalContextCount,
          "empty",
        );
        toastManager.add({
          type: "warning",
          title: toastCopy.title,
          description: toastCopy.description,
        });
      }
      return;
    }

    // ── Queue message if a turn is already running ────────────────────
    if (phase === "running") {
      const composerAttachmentsSnapshot = [...composerAttachmentsForSend];
      const hiddenProviderInput = buildHiddenProviderInput({
        prompt: promptForSend,
        terminalContexts: sendableComposerTerminalContexts,
        promptEnhancement: trimmed.length > 0 ? promptEnhancementForSend : null,
      });
      const messageTextForSend = appendTerminalContextsToPrompt(
        promptForSend,
        sendableComposerTerminalContexts,
      );
      const messageCreatedAt = new Date().toISOString();
      const fallbackOutgoingText = composerAttachmentsSnapshot.some(
        (attachment) => attachment.type === "image",
      )
        ? IMAGE_ONLY_BOOTSTRAP_PROMPT
        : "";
      const outgoingMessageText = formatOutgoingPrompt({
        provider: selectedProvider,
        effort: selectedPromptEffort,
        text: messageTextForSend || fallbackOutgoingText,
      });
      const optimisticAttachments = composerAttachmentsSnapshot.map((attachment) =>
        attachment.type === "image"
          ? {
              type: "image" as const,
              id: attachment.id,
              name: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              previewUrl: attachment.previewUrl,
            }
          : {
              type: "file" as const,
              id: attachment.id,
              name: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
            },
      );
      const queuedId = newMessageId();
      setQueuedMessages((existing) => [
        ...existing,
        {
          id: queuedId,
          text: promptForSend,
          attachments: composerAttachmentsSnapshot,
          terminalContexts: [...sendableComposerTerminalContexts],
          ...(hiddenProviderInput ? { providerInput: hiddenProviderInput } : {}),
          createdAt: messageCreatedAt,
        },
      ]);
      setOptimisticUserMessages((existing) => [
        ...existing,
        {
          id: queuedId,
          role: "user",
          text: outgoingMessageText,
          ...(optimisticAttachments.length > 0 ? { attachments: optimisticAttachments } : {}),
          createdAt: messageCreatedAt,
          streaming: false,
          queued: true,
        },
      ]);
      shouldAutoScrollRef.current = true;
      forceStickToBottom();
      promptRef.current = "";
      clearComposerDraftContent(activeThread.id);
      setComposerHighlightedItemId(null);
      setComposerCursor(0);
      setComposerTrigger(null);
      if (expiredTerminalContextCount > 0) {
        const toastCopy = buildExpiredTerminalContextToastCopy(
          expiredTerminalContextCount,
          "omitted",
        );
        toastManager.add({
          type: "warning",
          title: toastCopy.title,
          description: toastCopy.description,
        });
      }
      return;
    }

    if (!activeProject) return;
    const threadIdForSend = activeThread.id;
    const isFirstMessage = !isServerThread || activeThread.messages.length === 0;
    const baseBranchForWorktree =
      isFirstMessage && envMode === "worktree" && !activeThread.worktreePath
        ? activeThread.branch
        : null;

    // In worktree mode, require an explicit base branch so we don't silently
    // fall back to local execution when branch selection is missing.
    const shouldCreateWorktree =
      isFirstMessage && envMode === "worktree" && !activeThread.worktreePath;
    if (shouldCreateWorktree && !activeThread.branch) {
      setStoreThreadError(
        threadIdForSend,
        "Select a base branch before sending in New worktree mode.",
      );
      return;
    }

    sendInFlightRef.current = true;
    beginSendPhase(baseBranchForWorktree ? "preparing-worktree" : "sending-turn");

    const composerAttachmentsSnapshot = [...composerAttachmentsForSend];
    const composerTerminalContextsSnapshot = [...sendableComposerTerminalContexts];
    const hiddenProviderInput = buildHiddenProviderInput({
      prompt: promptForSend,
      terminalContexts: composerTerminalContextsSnapshot,
      promptEnhancement: trimmed.length > 0 ? promptEnhancementForSend : null,
    });
    const messageTextForSend = appendTerminalContextsToPrompt(
      promptForSend,
      composerTerminalContextsSnapshot,
    );
    const messageIdForSend = newMessageId();
    const messageCreatedAt = new Date().toISOString();
    const fallbackOutgoingText = composerAttachmentsSnapshot.some(
      (attachment) => attachment.type === "image",
    )
      ? IMAGE_ONLY_BOOTSTRAP_PROMPT
      : "";
    const outgoingMessageText = formatOutgoingPrompt({
      provider: selectedProvider,
      effort: selectedPromptEffort,
      text: messageTextForSend || fallbackOutgoingText,
    });
    const turnAttachmentsPromise = Promise.all(
      composerAttachmentsSnapshot.map(async (attachment) => ({
        type: attachment.type,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        dataUrl: await readFileAsDataUrl(attachment.file),
      })),
    );
    const optimisticAttachments = composerAttachmentsSnapshot.map((attachment) =>
      attachment.type === "image"
        ? {
            type: "image" as const,
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            previewUrl: attachment.previewUrl,
          }
        : {
            type: "file" as const,
            id: attachment.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
          },
    );
    setOptimisticUserMessages((existing) => [
      ...existing,
      {
        id: messageIdForSend,
        role: "user",
        text: outgoingMessageText,
        ...(optimisticAttachments.length > 0 ? { attachments: optimisticAttachments } : {}),
        createdAt: messageCreatedAt,
        streaming: false,
      },
    ]);
    // Sending a message should always bring the latest user turn into view.
    shouldAutoScrollRef.current = true;
    forceStickToBottom();

    setThreadError(threadIdForSend, null);
    if (expiredTerminalContextCount > 0) {
      const toastCopy = buildExpiredTerminalContextToastCopy(
        expiredTerminalContextCount,
        "omitted",
      );
      toastManager.add({
        type: "warning",
        title: toastCopy.title,
        description: toastCopy.description,
      });
    }
    promptRef.current = "";
    clearComposerDraftContent(threadIdForSend);
    setComposerHighlightedItemId(null);
    setComposerCursor(0);
    setComposerTrigger(null);

    let createdServerThreadForLocalDraft = false;
    let turnStartSucceeded = false;
    let nextThreadBranch = activeThread.branch;
    let nextThreadWorktreePath = activeThread.worktreePath;
    await (async () => {
      // On first message: lock in branch + create worktree if needed.
      if (baseBranchForWorktree) {
        beginSendPhase("preparing-worktree");
        const newBranch = buildTemporaryWorktreeBranchName();
        const result = await createWorktreeMutation.mutateAsync({
          cwd: activeProject.cwd,
          branch: baseBranchForWorktree,
          newBranch,
          updateBaseBranchWithRemote: settings.autoUpdateWorktreeBaseBranch,
        });
        if (result.worktree.baseBranch !== baseBranchForWorktree) {
          const toastCopy = buildAutoSelectedWorktreeBaseBranchToastCopy({
            requestedBranch: baseBranchForWorktree,
            selectedBranch: result.worktree.baseBranch,
          });
          toastManager.add({
            type: "warning",
            title: toastCopy.title,
            description: toastCopy.description,
          });
        }
        setStoreThreadWorktreeBaseBranch(threadIdForSend, result.worktree.baseBranch);
        nextThreadBranch = result.worktree.branch;
        nextThreadWorktreePath = result.worktree.path;
        if (isServerThread) {
          await api.orchestration.dispatchCommand({
            type: "thread.meta.update",
            commandId: newCommandId(),
            threadId: threadIdForSend,
            branch: result.worktree.branch,
            worktreePath: result.worktree.path,
          });
          // Keep local thread state in sync immediately so terminal drawer opens
          // with the worktree cwd/env instead of briefly using the project root.
          setStoreThreadBranch(threadIdForSend, result.worktree.branch, result.worktree.path);
        }
      }

      const manualThreadTitle = hasCustomThreadTitle(activeThread.title)
        ? normalizeThreadTitle(activeThread.title)
        : null;
      let title = manualThreadTitle;
      if (!title) {
        const firstComposerAttachment = composerAttachmentsSnapshot[0] ?? null;
        let titleSeed = trimmed;
        if (!titleSeed) {
          if (firstComposerAttachment) {
            titleSeed = `${firstComposerAttachment.type === "image" ? "Image" : "File"}: ${firstComposerAttachment.name}`;
          } else if (composerTerminalContextsSnapshot.length > 0) {
            titleSeed = formatTerminalContextLabel(composerTerminalContextsSnapshot[0]!);
          } else {
            titleSeed = normalizeThreadTitle(null);
          }
        }
        title = truncateTitle(titleSeed);
      }
      let threadCreateModel: ModelSlug =
        selectedModel || (activeProject.model as ModelSlug) || DEFAULT_MODEL_BY_PROVIDER.codex;

      if (isLocalDraftThread) {
        await api.orchestration.dispatchCommand({
          type: "thread.create",
          commandId: newCommandId(),
          threadId: threadIdForSend,
          projectId: activeProject.id,
          title,
          model: threadCreateModel,
          runtimeMode,
          interactionMode,
          branch: nextThreadBranch,
          worktreePath: nextThreadWorktreePath,
          createdAt: activeThread.createdAt,
        });
        createdServerThreadForLocalDraft = true;
      }

      let setupScript: ProjectScript | null = null;
      if (baseBranchForWorktree) {
        setupScript = setupProjectScript(activeProject.scripts);
      }
      if (setupScript) {
        let shouldRunSetupScript = false;
        if (isServerThread) {
          shouldRunSetupScript = true;
        } else {
          if (createdServerThreadForLocalDraft) {
            shouldRunSetupScript = true;
          }
        }
        if (shouldRunSetupScript) {
          const setupScriptOptions: Parameters<typeof runProjectScript>[1] = {
            worktreePath: nextThreadWorktreePath,
            rememberAsLastInvoked: false,
          };
          if (nextThreadWorktreePath) {
            setupScriptOptions.cwd = nextThreadWorktreePath;
          }
          await runProjectScript(setupScript, setupScriptOptions);
        }
      }

      // Auto-title from first message
      if (isFirstMessage && isServerThread && !hasCustomThreadTitle(activeThread.title)) {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: threadIdForSend,
          title,
        });
      }

      if (isServerThread) {
        await persistThreadSettingsForNextTurn({
          threadId: threadIdForSend,
          createdAt: messageCreatedAt,
          ...(selectedModel ? { model: selectedModel } : {}),
          runtimeMode,
          interactionMode,
        });
      }

      beginSendPhase("sending-turn");
      const turnAttachments = await turnAttachmentsPromise;
      await api.orchestration.dispatchCommand({
        type: "thread.turn.start",
        commandId: newCommandId(),
        threadId: threadIdForSend,
        message: {
          messageId: messageIdForSend,
          role: "user",
          text: outgoingMessageText,
          attachments: turnAttachments,
        },
        ...(hiddenProviderInput ? { providerInput: hiddenProviderInput } : {}),
        model: selectedModel || undefined,
        ...(selectedModelOptionsForDispatch
          ? { modelOptions: selectedModelOptionsForDispatch }
          : {}),
        ...(providerOptionsForDispatch ? { providerOptions: providerOptionsForDispatch } : {}),
        provider: selectedProvider,
        assistantDeliveryMode: settings.enableAssistantStreaming ? "streaming" : "buffered",
        runtimeMode,
        interactionMode,
        createdAt: messageCreatedAt,
      });
      turnStartSucceeded = true;
    })().catch(async (err: unknown) => {
      if (createdServerThreadForLocalDraft && !turnStartSucceeded) {
        await api.orchestration
          .dispatchCommand({
            type: "thread.delete",
            commandId: newCommandId(),
            threadId: threadIdForSend,
          })
          .catch(() => undefined);
      }
      if (
        !turnStartSucceeded &&
        promptRef.current.length === 0 &&
        composerAttachmentsRef.current.length === 0 &&
        composerTerminalContextsRef.current.length === 0
      ) {
        setOptimisticUserMessages((existing) => {
          const removed = existing.filter((message) => message.id === messageIdForSend);
          for (const message of removed) {
            revokeUserMessagePreviewUrls(message);
          }
          const next = existing.filter((message) => message.id !== messageIdForSend);
          return next.length === existing.length ? existing : next;
        });
        promptRef.current = promptForSend;
        setPrompt(promptForSend);
        setPromptEnhancementState(
          promptEnhancementForSend ?? null,
          promptEnhancementOriginalPromptForSend,
        );
        setComposerCursor(collapseExpandedComposerCursor(promptForSend, promptForSend.length));
        addComposerAttachmentsToDraft(
          composerAttachmentsSnapshot.map(cloneComposerAttachmentForRetry),
        );
        addComposerTerminalContextsToDraft(composerTerminalContextsSnapshot);
        setComposerTrigger(detectComposerTrigger(promptForSend, promptForSend.length));
      }
      setThreadError(
        threadIdForSend,
        err instanceof Error ? err.message : "Failed to send message.",
      );
    });
    sendInFlightRef.current = false;
    if (!turnStartSucceeded) {
      resetSendPhase();
    }
  };

  const sendSelectedTerminalContext = (selection: TerminalContextSelection) => {
    if (!activeThread) {
      return;
    }
    addComposerDraftTerminalContexts(activeThread.id, [
      {
        id: randomUUID(),
        threadId: activeThread.id,
        createdAt: new Date().toISOString(),
        ...selection,
      },
    ]);
    void onSend();
  };

  const onInterrupt = async () => {
    const api = readNativeApi();
    if (!api || !activeThread || isRemoteActionBlocked) return;
    await api.orchestration.dispatchCommand({
      type: "thread.turn.interrupt",
      commandId: newCommandId(),
      threadId: activeThread.id,
      createdAt: new Date().toISOString(),
    });
  };

  const onClearQueue = useCallback(() => {
    setOptimisticUserMessages((existing) => {
      for (const msg of existing) {
        if (msg.queued) revokeUserMessagePreviewUrls(msg);
      }
      return existing.filter((msg) => !msg.queued);
    });
    setQueuedMessages([]);
  }, []);

  const onRemoveQueuedMessage = useCallback((messageId: MessageId) => {
    setOptimisticUserMessages((existing) => {
      const target = existing.find((msg) => msg.id === messageId && msg.queued);
      if (target) revokeUserMessagePreviewUrls(target);
      return existing.filter((msg) => msg.id !== messageId);
    });
    setQueuedMessages((existing) => existing.filter((msg) => msg.id !== messageId));
  }, []);

  const onRespondToApproval = useCallback(
    async (requestId: ApprovalRequestId, decision: ProviderApprovalDecision) => {
      const api = readNativeApi();
      if (!api || !activeThreadId || isRemoteActionBlocked) return;

      setRespondingRequestIds((existing) =>
        existing.includes(requestId) ? existing : [...existing, requestId],
      );
      await api.orchestration
        .dispatchCommand({
          type: "thread.approval.respond",
          commandId: newCommandId(),
          threadId: activeThreadId,
          requestId,
          decision,
          createdAt: new Date().toISOString(),
        })
        .catch((err: unknown) => {
          setStoreThreadError(
            activeThreadId,
            err instanceof Error ? err.message : "Failed to submit approval decision.",
          );
        });
      setRespondingRequestIds((existing) => existing.filter((id) => id !== requestId));
    },
    [activeThreadId, isRemoteActionBlocked, setStoreThreadError],
  );

  const onRespondToUserInput = useCallback(
    async (requestId: ApprovalRequestId, answers: Record<string, unknown>) => {
      const api = readNativeApi();
      if (!api || !activeThreadId || isRemoteActionBlocked) return;

      setRespondingUserInputRequestIds((existing) =>
        existing.includes(requestId) ? existing : [...existing, requestId],
      );
      await api.orchestration
        .dispatchCommand({
          type: "thread.user-input.respond",
          commandId: newCommandId(),
          threadId: activeThreadId,
          requestId,
          answers,
          createdAt: new Date().toISOString(),
        })
        .catch((err: unknown) => {
          setStoreThreadError(
            activeThreadId,
            err instanceof Error ? err.message : "Failed to submit user input.",
          );
        });
      setRespondingUserInputRequestIds((existing) => existing.filter((id) => id !== requestId));
    },
    [activeThreadId, isRemoteActionBlocked, setStoreThreadError],
  );

  const setActivePendingUserInputQuestionIndex = useCallback(
    (nextQuestionIndex: number) => {
      if (!activePendingUserInput) {
        return;
      }
      setPendingUserInputQuestionIndexByRequestId((existing) => ({
        ...existing,
        [activePendingUserInput.requestId]: nextQuestionIndex,
      }));
    },
    [activePendingUserInput],
  );

  const onSelectActivePendingUserInputOption = useCallback(
    (questionId: string, optionLabel: string) => {
      if (!activePendingUserInput) {
        return;
      }
      setPendingUserInputAnswersByRequestId((existing) => ({
        ...existing,
        [activePendingUserInput.requestId]: {
          ...existing[activePendingUserInput.requestId],
          [questionId]: {
            selectedOptionLabel: optionLabel,
            customAnswer: "",
          },
        },
      }));
      promptRef.current = "";
      setComposerCursor(0);
      setComposerTrigger(null);
    },
    [activePendingUserInput],
  );

  const onChangeActivePendingUserInputCustomAnswer = useCallback(
    (
      questionId: string,
      value: string,
      nextCursor: number,
      expandedCursor: number,
      cursorAdjacentToMention: boolean,
    ) => {
      if (!activePendingUserInput) {
        return;
      }
      promptRef.current = value;
      setPendingUserInputAnswersByRequestId((existing) => ({
        ...existing,
        [activePendingUserInput.requestId]: {
          ...existing[activePendingUserInput.requestId],
          [questionId]: setPendingUserInputCustomAnswer(
            existing[activePendingUserInput.requestId]?.[questionId],
            value,
          ),
        },
      }));
      setComposerCursor(nextCursor);
      setComposerTrigger(
        cursorAdjacentToMention ? null : detectComposerTrigger(value, expandedCursor),
      );
    },
    [activePendingUserInput],
  );

  const onAdvanceActivePendingUserInput = useCallback(() => {
    if (!activePendingUserInput || !activePendingProgress) {
      return;
    }
    if (activePendingProgress.isLastQuestion) {
      if (activePendingResolvedAnswers) {
        void onRespondToUserInput(activePendingUserInput.requestId, activePendingResolvedAnswers);
      }
      return;
    }
    setActivePendingUserInputQuestionIndex(activePendingProgress.questionIndex + 1);
  }, [
    activePendingProgress,
    activePendingResolvedAnswers,
    activePendingUserInput,
    onRespondToUserInput,
    setActivePendingUserInputQuestionIndex,
  ]);

  const onPreviousActivePendingUserInputQuestion = useCallback(() => {
    if (!activePendingProgress) {
      return;
    }
    setActivePendingUserInputQuestionIndex(Math.max(activePendingProgress.questionIndex - 1, 0));
  }, [activePendingProgress, setActivePendingUserInputQuestionIndex]);

  const onSubmitPlanFollowUp = useCallback(
    async ({
      text,
      interactionMode: nextInteractionMode,
    }: {
      text: string;
      interactionMode: ProviderInteractionMode;
    }) => {
      const api = readNativeApi();
      if (
        !api ||
        !activeThread ||
        !isServerThread ||
        isSendBusy ||
        isConnecting ||
        isRemoteActionBlocked ||
        sendInFlightRef.current
      ) {
        return;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const threadIdForSend = activeThread.id;
      const messageIdForSend = newMessageId();
      const messageCreatedAt = new Date().toISOString();
      const outgoingMessageText = formatOutgoingPrompt({
        provider: selectedProvider,
        effort: selectedPromptEffort,
        text: trimmed,
      });

      sendInFlightRef.current = true;
      beginSendPhase("sending-turn");
      setThreadError(threadIdForSend, null);
      setOptimisticUserMessages((existing) => [
        ...existing,
        {
          id: messageIdForSend,
          role: "user",
          text: outgoingMessageText,
          createdAt: messageCreatedAt,
          streaming: false,
        },
      ]);
      shouldAutoScrollRef.current = true;
      forceStickToBottom();

      try {
        await persistThreadSettingsForNextTurn({
          threadId: threadIdForSend,
          createdAt: messageCreatedAt,
          ...(selectedModel ? { model: selectedModel } : {}),
          runtimeMode,
          interactionMode: nextInteractionMode,
        });

        // Keep the mode toggle and plan-follow-up banner in sync immediately
        // while the same-thread implementation turn is starting.
        setComposerDraftInteractionMode(threadIdForSend, nextInteractionMode);

        await api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: threadIdForSend,
          message: {
            messageId: messageIdForSend,
            role: "user",
            text: outgoingMessageText,
            attachments: [],
          },
          provider: selectedProvider,
          model: selectedModel || undefined,
          ...(selectedModelOptionsForDispatch
            ? { modelOptions: selectedModelOptionsForDispatch }
            : {}),
          ...(providerOptionsForDispatch ? { providerOptions: providerOptionsForDispatch } : {}),
          assistantDeliveryMode: settings.enableAssistantStreaming ? "streaming" : "buffered",
          runtimeMode,
          interactionMode: nextInteractionMode,
          ...(nextInteractionMode === "code" && activeProposedPlan
            ? {
                sourceProposedPlan: {
                  threadId: activeThread.id,
                  planId: activeProposedPlan.id,
                },
              }
            : {}),
          createdAt: messageCreatedAt,
        });
        // Optimistically open the plan sidebar when implementing (not refining).
        // Chat/code mode here means the agent is executing the plan, which produces
        // step-tracking activities that the sidebar will display.
        if (nextInteractionMode === "chat" || nextInteractionMode === "code") {
          planSidebarDismissedForTurnRef.current = null;
          setPlanSidebarOpen(true);
        }
        sendInFlightRef.current = false;
      } catch (err) {
        setOptimisticUserMessages((existing) =>
          existing.filter((message) => message.id !== messageIdForSend),
        );
        setThreadError(
          threadIdForSend,
          err instanceof Error ? err.message : "Failed to send plan follow-up.",
        );
        sendInFlightRef.current = false;
        resetSendPhase();
      }
    },
    [
      activeThread,
      activeProposedPlan,
      beginSendPhase,
      forceStickToBottom,
      isConnecting,
      isRemoteActionBlocked,
      isSendBusy,
      isServerThread,
      persistThreadSettingsForNextTurn,
      resetSendPhase,
      runtimeMode,
      selectedPromptEffort,
      selectedModel,
      selectedModelOptionsForDispatch,
      providerOptionsForDispatch,
      selectedProvider,
      setComposerDraftInteractionMode,
      setThreadError,
      settings.enableAssistantStreaming,
    ],
  );

  const onImplementPlanInNewThread = useCallback(async () => {
    const api = readNativeApi();
    if (
      !api ||
      !activeThread ||
      !activeProject ||
      !activeProposedPlan ||
      !isServerThread ||
      isSendBusy ||
      isConnecting ||
      isRemoteActionBlocked ||
      sendInFlightRef.current
    ) {
      return;
    }

    const createdAt = new Date().toISOString();
    const nextThreadId = newThreadId();
    const planMarkdown = activeProposedPlan.planMarkdown;
    const implementationPrompt = buildPlanImplementationPrompt(planMarkdown);
    const outgoingImplementationPrompt = formatOutgoingPrompt({
      provider: selectedProvider,
      effort: selectedPromptEffort,
      text: implementationPrompt,
    });
    const nextThreadTitle = truncateTitle(buildPlanImplementationThreadTitle(planMarkdown));
    const nextThreadModel: ModelSlug =
      selectedModel ||
      (activeThread.model as ModelSlug) ||
      (activeProject.model as ModelSlug) ||
      DEFAULT_MODEL_BY_PROVIDER.codex;

    sendInFlightRef.current = true;
    beginSendPhase("sending-turn");
    const finish = () => {
      sendInFlightRef.current = false;
      resetSendPhase();
    };

    await api.orchestration
      .dispatchCommand({
        type: "thread.create",
        commandId: newCommandId(),
        threadId: nextThreadId,
        projectId: activeProject.id,
        title: nextThreadTitle,
        model: nextThreadModel,
        runtimeMode,
        interactionMode: "code",
        branch: activeThread.branch,
        worktreePath: activeThread.worktreePath,
        createdAt,
      })
      .then(() => {
        return api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: nextThreadId,
          message: {
            messageId: newMessageId(),
            role: "user",
            text: outgoingImplementationPrompt,
            attachments: [],
          },
          provider: selectedProvider,
          model: selectedModel || undefined,
          ...(selectedModelOptionsForDispatch
            ? { modelOptions: selectedModelOptionsForDispatch }
            : {}),
          ...(providerOptionsForDispatch ? { providerOptions: providerOptionsForDispatch } : {}),
          assistantDeliveryMode: settings.enableAssistantStreaming ? "streaming" : "buffered",
          runtimeMode,
          interactionMode: "code",
          createdAt,
        });
      })
      .then(() => api.orchestration.getSnapshot())
      .then((snapshot) => {
        syncServerReadModel(snapshot);
        // Signal that the plan sidebar should open on the new thread.
        planSidebarOpenOnNextThreadRef.current = true;
        return navigate({
          to: "/$threadId",
          params: { threadId: nextThreadId },
        });
      })
      .catch(async (err) => {
        await api.orchestration
          .dispatchCommand({
            type: "thread.delete",
            commandId: newCommandId(),
            threadId: nextThreadId,
          })
          .catch(() => undefined);
        await api.orchestration
          .getSnapshot()
          .then((snapshot) => {
            syncServerReadModel(snapshot);
          })
          .catch(() => undefined);
        toastManager.add({
          type: "error",
          title: "Could not start implementation thread",
          description:
            err instanceof Error ? err.message : "An error occurred while creating the new thread.",
        });
      })
      .then(finish, finish);
  }, [
    activeProject,
    activeProposedPlan,
    activeThread,
    beginSendPhase,
    isConnecting,
    isRemoteActionBlocked,
    isSendBusy,
    isServerThread,
    navigate,
    resetSendPhase,
    runtimeMode,
    selectedPromptEffort,
    selectedModel,
    selectedModelOptionsForDispatch,
    providerOptionsForDispatch,
    selectedProvider,
    settings.enableAssistantStreaming,
    syncServerReadModel,
  ]);

  const onProviderModelSelect = useCallback(
    (provider: ProviderKind, model: ModelSlug) => {
      if (!activeThread) return;
      if (lockedProvider !== null && provider !== lockedProvider) {
        scheduleComposerFocus();
        return;
      }
      const resolvedModel = resolveAppModelSelection(provider, customModelsByProvider, model);
      setComposerDraftProvider(activeThread.id, provider);
      setComposerDraftModel(activeThread.id, resolvedModel);
      setStickyComposerModel(resolvedModel);
      scheduleComposerFocus();
    },
    [
      activeThread,
      lockedProvider,
      scheduleComposerFocus,
      setComposerDraftModel,
      setComposerDraftProvider,
      setStickyComposerModel,
      customModelsByProvider,
    ],
  );
  const setPromptFromTraits = useCallback(
    (nextPrompt: string) => {
      const currentPrompt = promptRef.current;
      if (nextPrompt === currentPrompt) {
        scheduleComposerFocus();
        return;
      }
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      const nextCursor = collapseExpandedComposerCursor(nextPrompt, nextPrompt.length);
      setComposerCursor(nextCursor);
      setComposerTrigger(detectComposerTrigger(nextPrompt, nextPrompt.length));
      scheduleComposerFocus();
    },
    [scheduleComposerFocus, setPrompt],
  );
  const onPromptEnhancementChange = useCallback(
    async (nextPromptEnhancement: PromptEnhancementId | null) => {
      if (isEnhancingPrompt) {
        return;
      }

      const currentPrompt = promptRef.current;
      const currentEnhancement = composerPromptEnhancement;
      const revertPrompt = composerPromptEnhancementOriginalPrompt ?? currentPrompt;
      const basePrompt = currentEnhancement !== null ? revertPrompt : currentPrompt;

      if (nextPromptEnhancement === null) {
        promptRef.current = revertPrompt;
        setPrompt(revertPrompt);
        setPromptEnhancementState(null, null);
        const nextCursor = collapseExpandedComposerCursor(revertPrompt, revertPrompt.length);
        setComposerCursor(nextCursor);
        setComposerTrigger(detectComposerTrigger(revertPrompt, revertPrompt.length));
        scheduleComposerFocus();
        return;
      }

      if (basePrompt.trim().length === 0) {
        return;
      }

      setIsEnhancingPrompt(true);
      try {
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        const enhancedPrompt = enhancePrompt(basePrompt, nextPromptEnhancement);
        promptRef.current = enhancedPrompt;
        setPrompt(enhancedPrompt);
        setPromptEnhancementState(nextPromptEnhancement, basePrompt);
        const nextCursor = collapseExpandedComposerCursor(enhancedPrompt, enhancedPrompt.length);
        setComposerCursor(nextCursor);
        setComposerTrigger(detectComposerTrigger(enhancedPrompt, enhancedPrompt.length));
        scheduleComposerFocus();
      } finally {
        setIsEnhancingPrompt(false);
      }
    },
    [
      composerPromptEnhancement,
      composerPromptEnhancementOriginalPrompt,
      isEnhancingPrompt,
      scheduleComposerFocus,
      setPrompt,
      setPromptEnhancementState,
    ],
  );
  const providerTraitsMenuContent = renderProviderTraitsMenuContent({
    provider: selectedProvider,
    threadId,
    model: selectedModel,
    onPromptChange: setPromptFromTraits,
  });
  const providerTraitsPicker = renderProviderTraitsPicker({
    provider: selectedProvider,
    threadId,
    model: selectedModel,
    onPromptChange: setPromptFromTraits,
  });
  const onEnvModeChange = useCallback(
    (mode: DraftThreadEnvMode) => {
      if (isLocalDraftThread) {
        setDraftThreadContext(threadId, { envMode: mode });
      }
      scheduleComposerFocus();
    },
    [isLocalDraftThread, scheduleComposerFocus, setDraftThreadContext, threadId],
  );

  const applyPromptReplacement = useCallback(
    (
      rangeStart: number,
      rangeEnd: number,
      replacement: string,
      options?: { expectedText?: string },
    ): boolean => {
      const currentText = promptRef.current;
      const safeStart = Math.max(0, Math.min(currentText.length, rangeStart));
      const safeEnd = Math.max(safeStart, Math.min(currentText.length, rangeEnd));
      if (
        options?.expectedText !== undefined &&
        currentText.slice(safeStart, safeEnd) !== options.expectedText
      ) {
        return false;
      }
      const next = replaceTextRange(promptRef.current, rangeStart, rangeEnd, replacement);
      const nextCursor = collapseExpandedComposerCursor(next.text, next.cursor);
      promptRef.current = next.text;
      const activePendingQuestion = activePendingProgress?.activeQuestion;
      if (activePendingQuestion && activePendingUserInput) {
        setPendingUserInputAnswersByRequestId((existing) => ({
          ...existing,
          [activePendingUserInput.requestId]: {
            ...existing[activePendingUserInput.requestId],
            [activePendingQuestion.id]: setPendingUserInputCustomAnswer(
              existing[activePendingUserInput.requestId]?.[activePendingQuestion.id],
              next.text,
            ),
          },
        }));
      } else {
        setPrompt(next.text);
      }
      setComposerCursor(nextCursor);
      setComposerTrigger(
        detectComposerTrigger(next.text, expandCollapsedComposerCursor(next.text, nextCursor)),
      );
      window.requestAnimationFrame(() => {
        composerEditorRef.current?.focusAt(nextCursor);
      });
      return true;
    },
    [activePendingProgress?.activeQuestion, activePendingUserInput, setPrompt],
  );

  const readComposerSnapshot = useCallback((): {
    value: string;
    cursor: number;
    expandedCursor: number;
    terminalContextIds: string[];
  } => {
    const editorSnapshot = composerEditorRef.current?.readSnapshot();
    if (editorSnapshot) {
      return editorSnapshot;
    }
    return {
      value: promptRef.current,
      cursor: composerCursor,
      expandedCursor: expandCollapsedComposerCursor(promptRef.current, composerCursor),
      terminalContextIds: composerTerminalContexts.map((context) => context.id),
    };
  }, [composerCursor, composerTerminalContexts]);

  const resolveActiveComposerTrigger = useCallback((): {
    snapshot: { value: string; cursor: number; expandedCursor: number };
    trigger: ComposerTrigger | null;
  } => {
    const snapshot = readComposerSnapshot();
    return {
      snapshot,
      trigger: detectComposerTrigger(snapshot.value, snapshot.expandedCursor),
    };
  }, [readComposerSnapshot]);

  const onSelectComposerItem = useCallback(
    (item: ComposerCommandItem) => {
      if (composerSelectLockRef.current) return;
      composerSelectLockRef.current = true;
      window.requestAnimationFrame(() => {
        composerSelectLockRef.current = false;
      });
      const { snapshot, trigger } = resolveActiveComposerTrigger();
      if (!trigger) return;
      if (item.type === "path") {
        const replacement = `@${item.path} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "slash-command") {
        if (item.command === "model") {
          const replacement = "/model ";
          const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
            snapshot.value,
            trigger.rangeEnd,
            replacement,
          );
          const applied = applyPromptReplacement(
            trigger.rangeStart,
            replacementRangeEnd,
            replacement,
            { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
          );
          if (applied) {
            setComposerHighlightedItemId(null);
          }
          return;
        }
        if (item.command === "skill") {
          const replacement = "/skill ";
          const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
            snapshot.value,
            trigger.rangeEnd,
            replacement,
          );
          const applied = applyPromptReplacement(
            trigger.rangeStart,
            replacementRangeEnd,
            replacement,
            { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
          );
          if (applied) {
            setComposerHighlightedItemId(null);
          }
          return;
        }
        void handleInteractionModeChange(
          item.command === "plan" ? "plan" : item.command === "code" ? "code" : "chat",
        );
        const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, "", {
          expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
        });
        if (applied) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "skill-installed") {
        const replacement = `/${item.skillName} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "skill-catalog") {
        const replacement = `/skill install ${item.skillId} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      if (item.type === "skill-subcommand") {
        if (item.subcommand === "browse") {
          void navigate({ to: "/skills", search: { create: undefined, name: undefined } });
          const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, "", {
            expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
          });
          if (applied) {
            setComposerHighlightedItemId(null);
          }
          return;
        }
        if (item.subcommand === "create") {
          void navigate({ to: "/skills", search: { create: "1", name: undefined } });
          const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, "", {
            expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
          });
          if (applied) {
            setComposerHighlightedItemId(null);
          }
          return;
        }
        const replacement = `/skill ${item.subcommand} `;
        const replacementRangeEnd = extendReplacementRangeForTrailingSpace(
          snapshot.value,
          trigger.rangeEnd,
          replacement,
        );
        const applied = applyPromptReplacement(
          trigger.rangeStart,
          replacementRangeEnd,
          replacement,
          { expectedText: snapshot.value.slice(trigger.rangeStart, replacementRangeEnd) },
        );
        if (applied) {
          setComposerHighlightedItemId(null);
        }
        return;
      }
      onProviderModelSelect(item.provider, item.model);
      const applied = applyPromptReplacement(trigger.rangeStart, trigger.rangeEnd, "", {
        expectedText: snapshot.value.slice(trigger.rangeStart, trigger.rangeEnd),
      });
      if (applied) {
        setComposerHighlightedItemId(null);
      }
    },
    [
      applyPromptReplacement,
      handleInteractionModeChange,
      navigate,
      onProviderModelSelect,
      resolveActiveComposerTrigger,
    ],
  );
  const onComposerMenuItemHighlighted = useCallback((itemId: string | null) => {
    setComposerHighlightedItemId(itemId);
  }, []);
  const nudgeComposerMenuHighlight = useCallback(
    (key: "ArrowDown" | "ArrowUp") => {
      if (composerMenuItems.length === 0) {
        return;
      }
      const highlightedIndex = composerMenuItems.findIndex(
        (item) => item.id === composerHighlightedItemId,
      );
      const normalizedIndex =
        highlightedIndex >= 0 ? highlightedIndex : key === "ArrowDown" ? -1 : 0;
      const offset = key === "ArrowDown" ? 1 : -1;
      const nextIndex =
        (normalizedIndex + offset + composerMenuItems.length) % composerMenuItems.length;
      const nextItem = composerMenuItems[nextIndex];
      setComposerHighlightedItemId(nextItem?.id ?? null);
    },
    [composerHighlightedItemId, composerMenuItems],
  );
  const isComposerMenuLoading =
    (composerTriggerKind === "path" &&
      ((pathTriggerQuery.length > 0 && composerPathQueryDebouncer.state.isPending) ||
        workspaceEntriesQuery.isLoading ||
        workspaceEntriesQuery.isFetching)) ||
    ((composerTriggerKind === "slash-skill" || composerTriggerKind === "slash-command") &&
      (skillsQuery.isLoading ||
        (composerTriggerKind === "slash-skill" && skillCatalogQuery.isLoading)));

  const onPromptChange = useCallback(
    (
      nextPrompt: string,
      nextCursor: number,
      expandedCursor: number,
      cursorAdjacentToMention: boolean,
      terminalContextIds: string[],
    ) => {
      if (activePendingProgress?.activeQuestion && activePendingUserInput) {
        onChangeActivePendingUserInputCustomAnswer(
          activePendingProgress.activeQuestion.id,
          nextPrompt,
          nextCursor,
          expandedCursor,
          cursorAdjacentToMention,
        );
        return;
      }
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      if (!terminalContextIdListsEqual(composerTerminalContexts, terminalContextIds)) {
        setComposerDraftTerminalContexts(
          threadId,
          syncTerminalContextsByIds(composerTerminalContexts, terminalContextIds),
        );
      }
      setComposerCursor(nextCursor);
      setComposerTrigger(
        cursorAdjacentToMention ? null : detectComposerTrigger(nextPrompt, expandedCursor),
      );
    },
    [
      activePendingProgress?.activeQuestion,
      activePendingUserInput,
      composerTerminalContexts,
      onChangeActivePendingUserInputCustomAnswer,
      setPrompt,
      setComposerDraftTerminalContexts,
      threadId,
    ],
  );

  const onComposerCommandKey = (
    key: "ArrowDown" | "ArrowUp" | "Enter" | "Tab",
    event: KeyboardEvent,
  ) => {
    if (key === "Tab" && event.shiftKey) {
      toggleInteractionMode();
      return true;
    }

    const { trigger } = resolveActiveComposerTrigger();
    const menuIsActive = composerMenuOpenRef.current || trigger !== null;

    if (menuIsActive) {
      const currentItems = composerMenuItemsRef.current;
      if (key === "ArrowDown" && currentItems.length > 0) {
        nudgeComposerMenuHighlight("ArrowDown");
        return true;
      }
      if (key === "ArrowUp" && currentItems.length > 0) {
        nudgeComposerMenuHighlight("ArrowUp");
        return true;
      }
      if (key === "Tab" || key === "Enter") {
        const selectedItem = activeComposerMenuItemRef.current ?? currentItems[0];
        if (selectedItem) {
          onSelectComposerItem(selectedItem);
          return true;
        }
      }
    }

    if (key === "Enter" && !event.shiftKey) {
      void onSend();
      return true;
    }
    return false;
  };
  const onToggleWorkGroup = useCallback((groupId: string) => {
    setExpandedWorkGroups((existing) => ({
      ...existing,
      [groupId]: !existing[groupId],
    }));
  }, []);
  const onExpandTimelineImage = useCallback((preview: ExpandedImagePreview) => {
    setExpandedImage(preview);
  }, []);
  const expandedImageItem = expandedImage ? expandedImage.images[expandedImage.index] : null;
  const onRevertUserMessage = (messageId: MessageId) => {
    const targetTurnCount = revertTurnCountByUserMessageId.get(messageId);
    if (typeof targetTurnCount !== "number") {
      return;
    }
    void onRevertToTurnCount(targetTurnCount);
  };

  const handlePreviewResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!previewOpen || !activeProject || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      previewResizeStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startSize: previewSize,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.style.cursor = previewStacked ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [activeProject, previewOpen, previewSize, previewStacked],
  );

  const handlePreviewResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const resizeState = previewResizeStateRef.current;
      if (!resizeState || resizeState.pointerId !== event.pointerId) {
        return;
      }

      const container = previewSplitRef.current;
      if (!container) {
        return;
      }

      const nextSizeUnclamped = previewStacked
        ? previewDock === "top"
          ? resizeState.startSize + (event.clientY - resizeState.startY)
          : resizeState.startSize + (resizeState.startY - event.clientY)
        : previewDock === "left"
          ? resizeState.startSize + (event.clientX - resizeState.startX)
          : resizeState.startSize + (resizeState.startX - event.clientX);
      const containerRect = container.getBoundingClientRect();
      const containerMainAxisSize = previewStacked ? containerRect.height : containerRect.width;
      const maxSize = Math.max(
        PREVIEW_SPLIT_MIN_SIZE_PX,
        containerMainAxisSize - PREVIEW_CHAT_MIN_SIZE_PX,
      );
      const nextSize = Math.max(
        PREVIEW_SPLIT_MIN_SIZE_PX,
        Math.min(Math.round(nextSizeUnclamped), maxSize),
      );
      if (activeProjectId) setPreviewSize(activeProjectId, nextSize);
    },
    [activeProjectId, previewDock, previewStacked, setPreviewSize],
  );

  const handlePreviewResizePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const resizeState = previewResizeStateRef.current;
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return;
    }

    previewResizeStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  useEffect(() => {
    if (!activeProject) {
      return;
    }

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return;
      }
      if (event.altKey || event.shiftKey) {
        return;
      }

      let targetDock: "left" | "right" | "top" | "bottom" | null = null;
      switch (event.key) {
        case "ArrowLeft":
          targetDock = "left";
          break;
        case "ArrowRight":
          targetDock = "right";
          break;
        case "ArrowUp":
          targetDock = "top";
          break;
        case "ArrowDown":
          targetDock = "bottom";
          break;
        default:
          break;
      }

      if (!targetDock) {
        return;
      }

      event.preventDefault();
      if (!activeProjectId) return;

      if (previewOpen && previewDock === targetDock) {
        setPreviewOpen(activeProjectId, false);
        return;
      }

      setPreviewOpen(activeProjectId, true);
      setPreviewDock(activeProjectId, targetDock);
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, [activeProject, activeProjectId, previewDock, previewOpen, setPreviewDock, setPreviewOpen]);

  // Empty state: no active thread
  if (!activeThread) {
    return <ChatHomeEmptyState />;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
      {/* Top bar */}
      <header
        className={cn(
          "border-b border-border px-3 sm:px-5",
          isElectron
            ? "drag-region flex h-[52px] items-center pl-[90px] sm:pl-[90px]"
            : "py-2 sm:py-3",
        )}
      >
        <ChatHeader
          activeThreadId={activeThread.id}
          activeThreadTitle={activeThread.title}
          activeProjectId={activeProject?.id}
          activeProjectName={activeProject?.name}
          activeProjectCwd={activeProject?.cwd}
          isLocalDraftThread={isLocalDraftThread}
          threadBranch={activeThread.branch ?? null}
          openInCwd={gitCwd}
          activeProjectScripts={activeProject?.scripts}
          preferredScriptId={
            activeProject ? (lastInvokedScriptByProjectId[activeProject.id] ?? null) : null
          }
          keybindings={keybindings}
          terminalAvailable={activeProject !== undefined}
          terminalOpen={terminalState.terminalOpen}
          terminalToggleShortcutLabel={terminalToggleShortcutLabel}
          codeViewerOpen={codeViewerOpen}
          diffViewerOpen={diffViewerOpen}
          previewAvailable={isElectron && activeProject !== undefined}
          previewOpen={previewOpen}
          previewDock={previewDock}
          gitCwd={gitCwd}
          clientMode={clientMode}
          onRenameDraftThreadTitle={(title) => {
            setDraftThreadTitle(activeThread.id, title);
          }}
          onRunProjectScript={(script) => {
            void runProjectScript(script);
          }}
          onAddProjectScript={saveProjectScript}
          onUpdateProjectScript={updateProjectScript}
          onDeleteProjectScript={deleteProjectScript}
          onImportProjectScripts={importProjectScripts}
          onToggleTerminal={toggleTerminalVisibility}
          onToggleCodeViewer={toggleCodeViewer}
          onToggleDiffViewer={handleToggleDiffViewer}
          onTogglePreview={() => activeProjectId && togglePreviewOpen(activeProjectId)}
          onTogglePreviewLayout={() => activeProjectId && togglePreviewLayout(activeProjectId)}
        />
      </header>

      {/* Error banner */}
      {isMobileCompanion ? (
        <div className="mx-auto flex w-full max-w-7xl px-3 pt-3 sm:px-5">
          <CompanionConnectionBanner state={transportState} />
        </div>
      ) : null}
      <ProviderHealthBanner status={activeProviderStatus} />
      <ThreadErrorBanner
        error={activeThread.error}
        showAuthFailuresAsErrors={settings.showAuthFailuresAsErrors}
        onDismiss={() => setThreadError(activeThread.id, null)}
      />
      {/* Main content area with optional plan sidebar */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div
          ref={previewSplitRef}
          className={cn(
            "flex min-h-0 min-w-0 flex-1",
            previewOpen && activeProject && previewStacked ? "flex-col" : "flex-row",
          )}
        >
          {previewOpen && activeProject && (previewDock === "left" || previewDock === "top") ? (
            <>
              <div
                className="min-h-0 min-w-0 flex-none overflow-hidden bg-background"
                style={
                  previewStacked ? { height: `${previewSize}px` } : { width: `${previewSize}px` }
                }
              >
                <PreviewPanel
                  key={previewPanelKey ?? undefined}
                  projectId={activeProject!.id}
                  threadId={threadId}
                  onClose={() => setPreviewOpen(activeProject!.id, false)}
                />
              </div>
              <div
                className={cn(
                  "relative z-10 shrink-0 bg-transparent touch-none select-none after:absolute after:bg-border/35 after:transition-colors hover:after:bg-border/55",
                  previewStacked
                    ? "h-4 cursor-row-resize after:inset-x-0 after:top-1/2 after:h-px after:-translate-y-1/2"
                    : "w-4 cursor-col-resize after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2",
                )}
                onPointerDown={handlePreviewResizePointerDown}
                onPointerMove={handlePreviewResizePointerMove}
                onPointerUp={handlePreviewResizePointerEnd}
                onPointerCancel={handlePreviewResizePointerEnd}
                role="separator"
                aria-label="Resize preview panel"
                aria-orientation={previewStacked ? "horizontal" : "vertical"}
              />
            </>
          ) : null}

          {/* Chat column */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {isMobileCompanion ? (
              <div className="mx-auto w-full max-w-7xl px-3 pt-3 sm:px-5">
                <MobileThreadAttentionBar
                  activePendingApproval={activePendingApproval}
                  activePendingUserInput={activePendingUserInput}
                  hasPlanReady={showPlanFollowUpPrompt && activeProposedPlan !== null}
                  providerStatus={activeProviderStatus}
                  onReview={() => {
                    scrollMessagesToBottom("smooth");
                    focusComposer();
                  }}
                />
              </div>
            ) : null}
            {/* Messages Wrapper */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {/* Messages */}
              <div
                ref={setMessagesScrollContainerRef}
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-5 sm:py-4"
                onScroll={onMessagesScroll}
                onClickCapture={onMessagesClickCapture}
                onWheel={onMessagesWheel}
                onPointerDown={onMessagesPointerDown}
                onPointerUp={onMessagesPointerUp}
                onPointerCancel={onMessagesPointerCancel}
                onTouchStart={onMessagesTouchStart}
                onTouchMove={onMessagesTouchMove}
                onTouchEnd={onMessagesTouchEnd}
                onTouchCancel={onMessagesTouchEnd}
              >
                <MessagesTimeline
                  threadId={activeThread.id}
                  key={activeThread.id}
                  hasMessages={timelineEntries.length > 0}
                  isWorking={isWorking}
                  activeTurnInProgress={isWorking || !latestTurnSettled}
                  activeTurnStartedAt={activeWorkStartedAt}
                  scrollContainer={messagesScrollElement}
                  timelineEntries={timelineEntries}
                  completionDividerBeforeEntryId={completionDividerBeforeEntryId}
                  completionSummary={completionSummary}
                  turnDiffSummaryByAssistantMessageId={turnDiffSummaryByAssistantMessageId}
                  nowIso={nowIso}
                  expandedWorkGroups={expandedWorkGroups}
                  onToggleWorkGroup={onToggleWorkGroup}
                  revertTurnCountByUserMessageId={revertTurnCountByUserMessageId}
                  onRevertUserMessage={onRevertUserMessage}
                  isRevertingCheckpoint={isRevertingCheckpoint}
                  onImageExpand={onExpandTimelineImage}
                  markdownCwd={gitCwd ?? undefined}
                  resolvedTheme={resolvedTheme}
                  showReasoningContent={showReasoningContent}
                  timestampFormat={timestampFormat}
                  workspaceRoot={activeProject?.cwd ?? undefined}
                  shortcutGuides={chatShortcutGuides}
                  onRemoveQueuedMessage={onRemoveQueuedMessage}
                  onOpenSettings={() => void navigate({ to: "/settings" })}
                  onOpenTurnDiff={handleOpenTurnDiff}
                />
              </div>

              {/* scroll to bottom pill — shown when user has scrolled away from the bottom */}
              {showScrollToBottom && (
                <div className="pointer-events-none absolute bottom-1 left-1/2 z-30 flex -translate-x-1/2 justify-center py-1.5">
                  <button
                    type="button"
                    onClick={() => scrollMessagesToBottom("smooth")}
                    className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1 text-muted-foreground text-xs shadow-sm transition-colors hover:border-border hover:text-foreground hover:cursor-pointer"
                  >
                    <ChevronDownIcon className="size-3.5" />
                    Scroll to bottom
                  </button>
                </div>
              )}
            </div>

            {/* Input bar */}
            <div className={cn("px-3 pt-1.5 sm:px-5 sm:pt-2", isGitRepo ? "pb-1" : "pb-3 sm:pb-4")}>
              <form
                ref={composerFormRef}
                onSubmit={onSend}
                className="mx-auto w-full min-w-0 max-w-7xl"
                data-chat-composer-form="true"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onFileInputChange}
                  tabIndex={-1}
                />
                <div
                  className={cn(
                    "group relative rounded-[22px] p-px transition-colors duration-200",
                    composerProviderState.composerFrameClassName,
                  )}
                  onDragEnter={onComposerDragEnter}
                  onDragOver={onComposerDragOver}
                  onDragLeave={onComposerDragLeave}
                  onDrop={onComposerDrop}
                >
                  {isDragOverComposer && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[22px] border-2 border-dashed border-primary/60 bg-primary/5">
                      <div className="flex items-center gap-2 rounded-lg bg-background/90 px-4 py-2 text-sm font-medium text-primary shadow-sm">
                        {dragOverType === "tree-path" ? (
                          <>
                            <AtSignIcon className="size-4" />
                            Drop to add as context
                          </>
                        ) : (
                          <>
                            <PaperclipIcon className="size-4" />
                            Drop files to attach
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-[20px] border bg-card transition-colors duration-200 focus-within:border-ring/45",
                      isDragOverComposer ? "border-primary/70 bg-accent/30" : "border-border",
                      composerProviderState.composerSurfaceClassName,
                    )}
                  >
                    {activePendingApproval ? (
                      <div className="rounded-t-[19px] border-b border-border/65 bg-muted/20">
                        <ComposerPendingApprovalPanel
                          approval={activePendingApproval}
                          pendingCount={pendingApprovals.length}
                        />
                      </div>
                    ) : pendingUserInputs.length > 0 ? (
                      <div className="rounded-t-[19px] border-b border-border/65 bg-muted/20">
                        <ComposerPendingUserInputPanel
                          pendingUserInputs={pendingUserInputs}
                          respondingRequestIds={respondingRequestIds}
                          answers={activePendingDraftAnswers}
                          questionIndex={activePendingQuestionIndex}
                          onSelectOption={onSelectActivePendingUserInputOption}
                          onAdvance={onAdvanceActivePendingUserInput}
                        />
                      </div>
                    ) : showPlanFollowUpPrompt && activeProposedPlan ? (
                      <div className="rounded-t-[19px] border-b border-border/65 bg-muted/20">
                        <ComposerPlanFollowUpBanner
                          key={activeProposedPlan.id}
                          planTitle={proposedPlanTitle(activeProposedPlan.planMarkdown) ?? null}
                        />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "relative px-3 pb-2 sm:px-4",
                        hasComposerHeader ? "pt-2.5 sm:pt-3" : "pt-3.5 sm:pt-4",
                      )}
                    >
                      {composerMenuOpen && !isComposerApprovalState && (
                        <div className="absolute inset-x-0 bottom-full z-20 mb-2 px-1">
                          <ComposerCommandMenu
                            items={composerMenuItems}
                            resolvedTheme={resolvedTheme}
                            isLoading={isComposerMenuLoading}
                            triggerKind={composerTriggerKind}
                            activeItemId={activeComposerMenuItem?.id ?? null}
                            onHighlightedItemChange={onComposerMenuItemHighlighted}
                            onSelect={onSelectComposerItem}
                          />
                        </div>
                      )}

                      {!isComposerApprovalState &&
                        pendingUserInputs.length === 0 &&
                        composerAttachments.length > 0 && (
                          <div className="mb-3 space-y-2">
                            {composerImageAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {composerImageAttachments.map((image) => (
                                  <div
                                    key={image.id}
                                    className="relative h-16 w-16 overflow-hidden rounded-lg border border-border/80 bg-background"
                                  >
                                    {image.previewUrl ? (
                                      <button
                                        type="button"
                                        className="h-full w-full cursor-zoom-in"
                                        aria-label={`Preview ${image.name}`}
                                        onClick={() => {
                                          const preview = buildExpandedImagePreview(
                                            composerImageAttachments,
                                            image.id,
                                          );
                                          if (!preview) return;
                                          setExpandedImage(preview);
                                        }}
                                      >
                                        <img
                                          src={image.previewUrl}
                                          alt={image.name}
                                          className="h-full w-full object-cover"
                                        />
                                      </button>
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground/70">
                                        {image.name}
                                      </div>
                                    )}
                                    {nonPersistedComposerAttachmentIdSet.has(image.id) && (
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <span
                                              role="img"
                                              aria-label="Draft attachment may not persist"
                                              className="absolute left-1 top-1 inline-flex items-center justify-center rounded bg-background/85 p-0.5 text-amber-600"
                                            >
                                              <CircleAlertIcon className="size-3" />
                                            </span>
                                          }
                                        />
                                        <TooltipPopup
                                          side="top"
                                          className="max-w-64 whitespace-normal leading-tight"
                                        >
                                          Draft attachment could not be saved locally and may be
                                          lost on navigation.
                                        </TooltipPopup>
                                      </Tooltip>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="absolute right-1 top-1 bg-background/80 hover:bg-background/90"
                                      onClick={() => removeComposerAttachment(image.id)}
                                      aria-label={`Remove ${image.name}`}
                                    >
                                      <XIcon />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {composerFileAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {composerFileAttachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="relative flex min-w-0 max-w-[280px] items-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 pr-9"
                                  >
                                    <PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-medium">
                                        {attachment.name}
                                      </div>
                                      <div className="truncate text-[11px] text-muted-foreground">
                                        {attachment.mimeType}
                                      </div>
                                    </div>
                                    {nonPersistedComposerAttachmentIdSet.has(attachment.id) && (
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <span
                                              role="img"
                                              aria-label="Draft attachment may not persist"
                                              className="absolute left-1 top-1 inline-flex items-center justify-center rounded bg-background/85 p-0.5 text-amber-600"
                                            >
                                              <CircleAlertIcon className="size-3" />
                                            </span>
                                          }
                                        />
                                        <TooltipPopup
                                          side="top"
                                          className="max-w-64 whitespace-normal leading-tight"
                                        >
                                          Draft attachment could not be saved locally and may be
                                          lost on navigation.
                                        </TooltipPopup>
                                      </Tooltip>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon-xs"
                                      className="absolute right-1 top-1 bg-background/80 hover:bg-background/90"
                                      onClick={() => removeComposerAttachment(attachment.id)}
                                      aria-label={`Remove ${attachment.name}`}
                                    >
                                      <XIcon />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      <ComposerPromptEditor
                        ref={composerEditorRef}
                        value={
                          isComposerApprovalState
                            ? ""
                            : activePendingProgress
                              ? activePendingProgress.customAnswer
                              : prompt
                        }
                        cursor={composerCursor}
                        terminalContexts={
                          !isComposerApprovalState && pendingUserInputs.length === 0
                            ? composerTerminalContexts
                            : []
                        }
                        onRemoveTerminalContext={removeComposerTerminalContextFromDraft}
                        onChange={onPromptChange}
                        onCommandKeyDown={onComposerCommandKey}
                        onPaste={onComposerPaste}
                        placeholder={
                          isComposerApprovalState
                            ? "Resolve this approval request to continue"
                            : activePendingProgress
                              ? "Type your own answer, or leave this blank to use the selected option"
                              : showPlanFollowUpPrompt && activeProposedPlan
                                ? "Add feedback to refine the plan, or leave this blank to implement it"
                                : phase === "disconnected"
                                  ? "Ask for follow-up changes or attach files"
                                  : "Ask anything, @tag files/folders, or use / to show available commands"
                        }
                        disabled={isConnecting || isComposerApprovalState || isRemoteActionBlocked}
                      />
                    </div>

                    {/* Bottom toolbar */}
                    {activePendingApproval ? (
                      <div className="flex items-center justify-end gap-2 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
                        <ComposerPendingApprovalActions
                          requestId={activePendingApproval.requestId}
                          isResponding={respondingRequestIds.includes(
                            activePendingApproval.requestId,
                          )}
                          onRespondToApproval={onRespondToApproval}
                        />
                      </div>
                    ) : (
                      <div
                        data-chat-composer-footer="true"
                        ref={composerFooterRef}
                        className={cn(
                          "flex items-center justify-between px-2.5 pb-2.5 sm:px-3 sm:pb-3",
                          isComposerFooterCompact
                            ? "gap-1.5"
                            : "flex-wrap gap-2 sm:flex-nowrap sm:gap-0",
                        )}
                      >
                        <div
                          ref={composerFooterLeadingRef}
                          className={cn(
                            "flex min-w-0 flex-1 items-center",
                            isComposerFooterCompact
                              ? "gap-1 overflow-hidden"
                              : "gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:min-w-max sm:overflow-visible",
                          )}
                        >
                          {/* Provider/model picker */}
                          <ProviderModelPicker
                            compact={isComposerFooterCompact}
                            provider={selectedProvider}
                            model={selectedModelForPickerWithCustomFallback}
                            lockedProvider={lockedProvider}
                            modelOptionsByProvider={modelOptionsByProvider}
                            {...(composerProviderState.modelPickerIconClassName
                              ? {
                                  activeProviderIconClassName:
                                    composerProviderState.modelPickerIconClassName,
                                }
                              : {})}
                            onProviderModelChange={onProviderModelSelect}
                          />

                          {isComposerFooterCompact ? (
                            <CompactComposerControlsMenu
                              activePlan={Boolean(
                                activePlan || sidebarProposedPlan || planSidebarOpen,
                              )}
                              interactionMode={interactionMode}
                              planSidebarOpen={planSidebarOpen}
                              runtimeMode={runtimeMode}
                              traitsMenuContent={providerTraitsMenuContent}
                              onInteractionModeChange={handleInteractionModeChange}
                              onTogglePlanSidebar={togglePlanSidebar}
                              onToggleRuntimeMode={toggleRuntimeMode}
                            />
                          ) : (
                            <>
                              {providerTraitsPicker ? (
                                <>
                                  <Separator
                                    orientation="vertical"
                                    className="mx-0.5 hidden h-4 sm:block"
                                  />
                                  {providerTraitsPicker}
                                </>
                              ) : null}

                              <Separator
                                orientation="vertical"
                                className="mx-0.5 hidden h-4 sm:block"
                              />

                              <Button
                                variant="ghost"
                                className="shrink-0 whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 sm:px-3"
                                size="sm"
                                type="button"
                                onClick={toggleInteractionMode}
                                title="Cycle interaction mode: Chat → Code → Plan"
                              >
                                <BotIcon />
                                <span className="sr-only sm:not-sr-only">
                                  {interactionMode === "plan"
                                    ? "Plan"
                                    : interactionMode === "code"
                                      ? "Code"
                                      : "Chat"}
                                </span>
                              </Button>

                              <Separator
                                orientation="vertical"
                                className="mx-0.5 hidden h-4 sm:block"
                              />

                              <Button
                                variant="ghost"
                                className="shrink-0 whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 sm:px-3"
                                size="sm"
                                type="button"
                                onClick={() =>
                                  void handleRuntimeModeChange(
                                    runtimeMode === "full-access"
                                      ? "approval-required"
                                      : "full-access",
                                  )
                                }
                                title={
                                  runtimeMode === "full-access"
                                    ? "Full access — click to require approvals"
                                    : "Approval required — click for full access"
                                }
                              >
                                {runtimeMode === "full-access" ? <LockOpenIcon /> : <LockIcon />}
                                <span className="sr-only sm:not-sr-only">
                                  {runtimeMode === "full-access" ? "Full access" : "Supervised"}
                                </span>
                              </Button>

                              {activePlan || sidebarProposedPlan || planSidebarOpen ? (
                                <>
                                  <Separator
                                    orientation="vertical"
                                    className="mx-0.5 hidden h-4 sm:block"
                                  />
                                  <Button
                                    variant="ghost"
                                    className={cn(
                                      "shrink-0 whitespace-nowrap px-2 sm:px-3",
                                      planSidebarOpen
                                        ? "text-blue-400 hover:text-blue-300"
                                        : "text-muted-foreground/70 hover:text-foreground/80",
                                    )}
                                    size="sm"
                                    type="button"
                                    onClick={togglePlanSidebar}
                                    title={
                                      planSidebarOpen ? "Hide plan sidebar" : "Show plan sidebar"
                                    }
                                  >
                                    <ListTodoIcon />
                                    <span className="sr-only sm:not-sr-only">Plan</span>
                                  </Button>
                                </>
                              ) : null}
                            </>
                          )}
                        </div>

                        {/* Right side: send / stop button */}
                        <div
                          data-chat-composer-actions="right"
                          ref={composerFooterActionsRef}
                          className="flex shrink-0 items-center gap-2"
                        >
                          {pendingUserInputs.length === 0 && (
                            <>
                              <PromptEnhancer
                                prompt={prompt}
                                value={composerPromptEnhancement}
                                onChange={onPromptEnhancementChange}
                                isEnhancing={isEnhancingPrompt}
                              />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                type="button"
                                className="text-muted-foreground/70 hover:text-foreground/80"
                                onClick={openFilePicker}
                                title="Attach files"
                                aria-label="Attach files"
                              >
                                <PaperclipIcon className="size-4" />
                              </Button>
                            </>
                          )}
                          {activeContextWindow ? (
                            <ContextWindowMeter usage={activeContextWindow} />
                          ) : null}
                          {isPreparingWorktree ? (
                            <span className="text-muted-foreground/70 text-xs">
                              Preparing worktree...
                            </span>
                          ) : null}
                          {queuedMessages.length > 0 && phase === "running" ? (
                            <button
                              type="button"
                              className="flex items-center gap-1 text-muted-foreground/60 text-xs transition-colors hover:text-destructive"
                              onClick={onClearQueue}
                              title="Clear queued messages"
                              aria-label="Clear queued messages"
                            >
                              {queuedMessages.length} queued
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 10 10"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path
                                  d="M2 2l6 6M8 2l-6 6"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  fill="none"
                                />
                              </svg>
                            </button>
                          ) : null}
                          {activePendingProgress ? (
                            <div className="flex items-center gap-2">
                              {activePendingProgress.questionIndex > 0 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  onClick={onPreviousActivePendingUserInputQuestion}
                                  disabled={activePendingIsResponding}
                                >
                                  Previous
                                </Button>
                              ) : null}
                              <Button
                                type="submit"
                                size="sm"
                                className="rounded-full px-4"
                                disabled={
                                  activePendingIsResponding ||
                                  (activePendingProgress.isLastQuestion
                                    ? !activePendingResolvedAnswers
                                    : !activePendingProgress.canAdvance)
                                }
                              >
                                {activePendingIsResponding
                                  ? "Submitting..."
                                  : activePendingProgress.isLastQuestion
                                    ? "Submit answers"
                                    : "Next question"}
                              </Button>
                            </div>
                          ) : phase === "running" ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-rose-500/90 text-white transition-all duration-150 hover:bg-rose-500 hover:scale-105 sm:h-8 sm:w-8"
                                onClick={() => void onInterrupt()}
                                aria-label="Stop generation"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 12 12"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <rect x="2" y="2" width="8" height="8" rx="1.5" />
                                </svg>
                              </button>
                              <Button
                                type="submit"
                                size="icon"
                                className="h-9 w-9 rounded-full hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 sm:h-8 sm:w-8"
                                disabled={
                                  isSendBusy ||
                                  isConnecting ||
                                  isRemoteActionBlocked ||
                                  !composerSendState.hasSendableContent
                                }
                                aria-label="Queue message"
                                title="Queue message (will send after current turn completes)"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                  aria-hidden="true"
                                >
                                  <path
                                    d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </Button>
                            </div>
                          ) : pendingUserInputs.length === 0 ? (
                            showPlanFollowUpPrompt ? (
                              prompt.trim().length > 0 ? (
                                <Button
                                  type="submit"
                                  size="sm"
                                  className="h-9 rounded-full px-4 sm:h-8"
                                  disabled={isSendBusy || isConnecting || isRemoteActionBlocked}
                                >
                                  {isConnecting || isSendBusy
                                    ? "Sending..."
                                    : isRemoteActionBlocked
                                      ? "Offline"
                                      : "Refine"}
                                </Button>
                              ) : (
                                <div className="flex items-center">
                                  <Button
                                    type="submit"
                                    size="sm"
                                    className="h-9 rounded-l-full rounded-r-none px-4 sm:h-8"
                                    disabled={isSendBusy || isConnecting || isRemoteActionBlocked}
                                  >
                                    {isConnecting || isSendBusy
                                      ? "Sending..."
                                      : isRemoteActionBlocked
                                        ? "Offline"
                                        : "Implement"}
                                  </Button>
                                  <Menu>
                                    <MenuTrigger
                                      render={
                                        <Button
                                          size="sm"
                                          variant="default"
                                          className="h-9 rounded-l-none rounded-r-full border-l-white/12 px-2 sm:h-8"
                                          aria-label="Implementation actions"
                                          disabled={
                                            isSendBusy || isConnecting || isRemoteActionBlocked
                                          }
                                        />
                                      }
                                    >
                                      <ChevronDownIcon className="size-3.5" />
                                    </MenuTrigger>
                                    <MenuPopup align="end" side="top">
                                      <MenuItem
                                        disabled={
                                          isSendBusy || isConnecting || isRemoteActionBlocked
                                        }
                                        onClick={() => void onImplementPlanInNewThread()}
                                      >
                                        Implement in a new thread
                                      </MenuItem>
                                    </MenuPopup>
                                  </Menu>
                                </div>
                              )
                            ) : (
                              <Button
                                type="submit"
                                size="icon"
                                className="h-9 w-9 rounded-full hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 sm:h-8 sm:w-8"
                                disabled={
                                  isSendBusy ||
                                  isConnecting ||
                                  isRemoteActionBlocked ||
                                  !composerSendState.hasSendableContent
                                }
                                aria-label={
                                  isConnecting
                                    ? "Connecting"
                                    : isRemoteActionBlocked
                                      ? "Disconnected"
                                      : isPreparingWorktree
                                        ? "Preparing worktree"
                                        : isSendBusy
                                          ? "Sending"
                                          : "Send message"
                                }
                              >
                                {isConnecting || isSendBusy ? (
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 14 14"
                                    fill="none"
                                    className="animate-spin"
                                    aria-hidden="true"
                                  >
                                    <circle
                                      cx="7"
                                      cy="7"
                                      r="5.5"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeDasharray="20 12"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 14 14"
                                    fill="none"
                                    aria-hidden="true"
                                  >
                                    <path
                                      d="M7 11.5V2.5M7 2.5L3 6.5M7 2.5L11 6.5"
                                      stroke="currentColor"
                                      strokeWidth="1.8"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {isGitRepo && (
              <BranchToolbar
                threadId={activeThread.id}
                onEnvModeChange={onEnvModeChange}
                envLocked={envLocked}
                onComposerFocusRequest={scheduleComposerFocus}
                {...(canCheckoutPullRequestIntoThread
                  ? { onCheckoutPullRequestRequest: openPullRequestDialog }
                  : {})}
              />
            )}
            {pullRequestDialogState ? (
              <PullRequestThreadDialog
                key={pullRequestDialogState.key}
                open
                cwd={activeProject?.cwd ?? null}
                initialReference={pullRequestDialogState.initialReference}
                onOpenChange={(open) => {
                  if (!open) {
                    closePullRequestDialog();
                  }
                }}
                onPrepared={handlePreparedPullRequestThread}
              />
            ) : null}
          </div>
          {/* end chat column */}

          {previewOpen && activeProject && (previewDock === "right" || previewDock === "bottom") ? (
            <>
              <div
                className={cn(
                  "relative z-10 shrink-0 bg-transparent touch-none select-none after:absolute after:bg-border/35 after:transition-colors hover:after:bg-border/55",
                  previewStacked
                    ? "h-4 cursor-row-resize after:inset-x-0 after:top-1/2 after:h-px after:-translate-y-1/2"
                    : "w-4 cursor-col-resize after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2",
                )}
                onPointerDown={handlePreviewResizePointerDown}
                onPointerMove={handlePreviewResizePointerMove}
                onPointerUp={handlePreviewResizePointerEnd}
                onPointerCancel={handlePreviewResizePointerEnd}
                role="separator"
                aria-label="Resize preview panel"
                aria-orientation={previewStacked ? "horizontal" : "vertical"}
              />
              <div
                className="min-h-0 min-w-0 flex-none overflow-hidden bg-background"
                style={
                  previewStacked ? { height: `${previewSize}px` } : { width: `${previewSize}px` }
                }
              >
                <PreviewPanel
                  key={previewPanelKey ?? undefined}
                  projectId={activeProject!.id}
                  threadId={threadId}
                  onClose={() => setPreviewOpen(activeProject!.id, false)}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Plan sidebar */}
        {planSidebarOpen ? (
          <PlanSidebar
            activePlan={activePlan}
            activePendingIsResponding={activePendingIsResponding}
            activePendingProgress={activePendingProgress}
            activePendingUserInput={activePendingUserInput}
            activeProposedPlan={sidebarProposedPlan}
            markdownCwd={gitCwd ?? undefined}
            onAdvancePendingUserInput={onAdvanceActivePendingUserInput}
            workspaceRoot={activeProject?.cwd ?? undefined}
            onFocusComposer={scheduleComposerFocus}
            timestampFormat={timestampFormat}
            onSelectPendingUserInputOption={onSelectActivePendingUserInputOption}
            onClose={() => {
              setPlanSidebarOpen(false);
              // Track that the user explicitly dismissed for this turn so auto-open won't fight them.
              const turnKey =
                activePlan?.turnId ??
                sidebarProposedPlan?.turnId ??
                activeLatestTurn?.turnId ??
                null;
              if (turnKey) {
                planSidebarDismissedForTurnRef.current = turnKey;
              }
            }}
          />
        ) : null}
      </div>
      {/* end horizontal flex container */}

      {(() => {
        if (!terminalState.terminalOpen || !activeProject) {
          return null;
        }
        return (
          <ThreadTerminalDrawer
            key={activeThread.id}
            threadId={activeThread.id}
            cwd={gitCwd ?? activeProject.cwd}
            runtimeEnv={threadTerminalRuntimeEnv}
            height={terminalState.terminalHeight}
            terminalIds={terminalState.terminalIds}
            activeTerminalId={terminalState.activeTerminalId}
            terminalGroups={terminalState.terminalGroups}
            activeTerminalGroupId={terminalState.activeTerminalGroupId}
            focusRequestId={terminalFocusRequestId}
            onSplitTerminal={splitTerminal}
            onNewTerminal={createNewTerminal}
            splitShortcutLabel={splitTerminalShortcutLabel ?? undefined}
            newShortcutLabel={newTerminalShortcutLabel ?? undefined}
            closeShortcutLabel={closeTerminalShortcutLabel ?? undefined}
            onActiveTerminalChange={activateTerminal}
            onCloseTerminal={closeTerminal}
            onCollapseTerminal={toggleTerminalVisibility}
            onHeightChange={setTerminalHeight}
            onAddTerminalContext={addTerminalContextToDraft}
            onSendTerminalContext={sendSelectedTerminalContext}
            onPreviewUrl={onPreviewUrl}
          />
        );
      })()}

      <Dialog
        open={pendingProjectScriptRun !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPendingProjectScriptRun(null);
          }
        }}
      >
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>
              {pendingProjectScriptRun
                ? `Run ${pendingProjectScriptRun.script.name}`
                : "Run action"}
            </DialogTitle>
            <DialogDescription>
              Fill in the template values for this action. Values are inserted directly into the
              command before it runs.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {pendingProjectScriptRun ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitPendingProjectScriptRun();
                }}
              >
                {pendingProjectScriptRun.inputIds.map((inputId) => (
                  <div key={inputId} className="space-y-1.5">
                    <Label htmlFor={`project-script-input-${inputId}`}>
                      {projectScriptTemplateInputLabel(inputId)}
                    </Label>
                    <Input
                      id={`project-script-input-${inputId}`}
                      value={pendingProjectScriptRun.values[inputId] ?? ""}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setPendingProjectScriptRun((current) =>
                          current
                            ? {
                                ...current,
                                error: null,
                                values: {
                                  ...current.values,
                                  [inputId]: nextValue,
                                },
                              }
                            : current,
                        );
                      }}
                    />
                  </div>
                ))}
                {pendingProjectScriptRun.error ? (
                  <p className="text-sm text-destructive">{pendingProjectScriptRun.error}</p>
                ) : null}
              </form>
            ) : null}
          </DialogPanel>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingProjectScriptRun(null)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void submitPendingProjectScriptRun()}>
              Run action
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {expandedImage && expandedImageItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 [-webkit-app-region:no-drag]"
          role="dialog"
          aria-modal="true"
          aria-label="Expanded image preview"
        >
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-zoom-out"
            aria-label="Close image preview"
            onClick={closeExpandedImage}
          />
          {expandedImage.images.length > 1 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 text-white/90 hover:bg-white/10 hover:text-white sm:left-6"
              aria-label="Previous image"
              onClick={() => {
                navigateExpandedImage(-1);
              }}
            >
              <ChevronLeftIcon className="size-5" />
            </Button>
          )}
          <div className="relative isolate z-10 max-h-[92vh] max-w-[92vw]">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="absolute right-2 top-2"
              onClick={closeExpandedImage}
              aria-label="Close image preview"
            >
              <XIcon />
            </Button>
            <img
              src={expandedImageItem.src}
              alt={expandedImageItem.name}
              className="max-h-[86vh] max-w-[92vw] select-none rounded-lg border border-border/70 bg-background object-contain shadow-2xl"
              draggable={false}
            />
            <p className="mt-2 max-w-[92vw] truncate text-center text-xs text-muted-foreground/80">
              {expandedImageItem.name}
              {expandedImage.images.length > 1
                ? ` (${expandedImage.index + 1}/${expandedImage.images.length})`
                : ""}
            </p>
          </div>
          {expandedImage.images.length > 1 && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 text-white/90 hover:bg-white/10 hover:text-white sm:right-6"
              aria-label="Next image"
              onClick={() => {
                navigateExpandedImage(1);
              }}
            >
              <ChevronRightIcon className="size-5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
