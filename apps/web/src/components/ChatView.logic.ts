import { type MessageId, ProjectId } from "@okcode/contracts";
import { type ChatMessage } from "../types";
import { randomUUID } from "~/lib/utils";
import { type ComposerAttachment } from "../composerDraftStore";
import { Schema } from "effect";
import {
  filterTerminalContextsWithText,
  stripInlineTerminalContextPlaceholders,
  type TerminalContextDraft,
} from "../lib/terminalContext";
export { readFileAsDataUrl } from "~/lib/fileData";
import { type PromptEnhancementId } from "../promptEnhancement";
export { buildLocalDraftThread } from "../draftThreads";

export const LAST_INVOKED_SCRIPT_BY_PROJECT_KEY = "okcode:last-invoked-script-by-project";
const WORKTREE_BRANCH_PREFIX = "okcode";

export const LastInvokedScriptByProjectSchema = Schema.Record(ProjectId, Schema.String);

export function revokeBlobPreviewUrl(previewUrl: string | undefined): void {
  if (!previewUrl || typeof URL === "undefined" || !previewUrl.startsWith("blob:")) {
    return;
  }
  URL.revokeObjectURL(previewUrl);
}

export function revokeUserMessagePreviewUrls(message: ChatMessage): void {
  if (message.role !== "user" || !message.attachments) {
    return;
  }
  for (const attachment of message.attachments) {
    if (attachment.type !== "image") {
      continue;
    }
    revokeBlobPreviewUrl(attachment.previewUrl);
  }
}

export function collectUserMessageBlobPreviewUrls(message: ChatMessage): string[] {
  if (message.role !== "user" || !message.attachments) {
    return [];
  }
  const previewUrls: string[] = [];
  for (const attachment of message.attachments) {
    if (attachment.type !== "image") continue;
    if (!attachment.previewUrl || !attachment.previewUrl.startsWith("blob:")) continue;
    previewUrls.push(attachment.previewUrl);
  }
  return previewUrls;
}

export type SendPhase = "idle" | "preparing-worktree" | "sending-turn";

/** A message queued locally while the agent is busy processing a turn. */
export interface QueuedMessage {
  id: MessageId;
  text: string;
  attachments: ComposerAttachment[];
  terminalContexts: TerminalContextDraft[];
  providerInput?: string;
  createdAt: string;
}

export interface PullRequestDialogState {
  initialReference: string | null;
  key: number;
}

export interface IssueDialogState {
  initialReference: string | null;
  key: number;
}

export function buildTemporaryWorktreeBranchName(): string {
  // Keep the 8-hex suffix shape for backend temporary-branch detection.
  const token = randomUUID().slice(0, 8).toLowerCase();
  return `${WORKTREE_BRANCH_PREFIX}/${token}`;
}

export function cloneComposerAttachmentForRetry(
  attachment: ComposerAttachment,
): ComposerAttachment {
  if (
    attachment.type !== "image" ||
    typeof URL === "undefined" ||
    !attachment.previewUrl.startsWith("blob:")
  ) {
    return attachment;
  }
  try {
    return {
      ...attachment,
      previewUrl: URL.createObjectURL(attachment.file),
    };
  } catch {
    return attachment;
  }
}

export function deriveComposerSendState(options: {
  prompt: string;
  attachmentCount: number;
  terminalContexts: ReadonlyArray<TerminalContextDraft>;
}): {
  trimmedPrompt: string;
  sendableTerminalContexts: TerminalContextDraft[];
  expiredTerminalContextCount: number;
  hasSendableContent: boolean;
} {
  const trimmedPrompt = stripInlineTerminalContextPlaceholders(options.prompt).trim();
  const sendableTerminalContexts = filterTerminalContextsWithText(options.terminalContexts);
  const expiredTerminalContextCount =
    options.terminalContexts.length - sendableTerminalContexts.length;
  return {
    trimmedPrompt,
    sendableTerminalContexts,
    expiredTerminalContextCount,
    hasSendableContent:
      trimmedPrompt.length > 0 ||
      options.attachmentCount > 0 ||
      sendableTerminalContexts.length > 0,
  };
}

export function findLatestRevertableUserMessageId(
  timelineEntries: ReadonlyArray<{
    kind: string;
    message?: {
      id: MessageId;
      role?: string;
    };
  }>,
  revertTurnCountByUserMessageId: ReadonlyMap<MessageId, number>,
): MessageId | null {
  for (let index = timelineEntries.length - 1; index >= 0; index -= 1) {
    const entry = timelineEntries[index];
    if (!entry || entry.kind !== "message" || entry.message?.role !== "user") {
      continue;
    }

    if (revertTurnCountByUserMessageId.has(entry.message.id)) {
      return entry.message.id;
    }
  }

  return null;
}

export function buildHiddenProviderInput(options: {
  prompt: string;
  terminalContexts: ReadonlyArray<TerminalContextDraft>;
  promptEnhancement: PromptEnhancementId | null | undefined;
}): string | undefined {
  void options.prompt;
  void options.terminalContexts;
  void options.promptEnhancement;
  return undefined;
}

export function buildExpiredTerminalContextToastCopy(
  expiredTerminalContextCount: number,
  variant: "omitted" | "empty",
): { title: string; description: string } {
  const count = Math.max(1, Math.floor(expiredTerminalContextCount));
  const noun = count === 1 ? "Expired terminal context" : "Expired terminal contexts";
  if (variant === "empty") {
    return {
      title: `${noun} won't be sent`,
      description: "Remove it or re-add it to include terminal output.",
    };
  }
  return {
    title: `${noun} omitted from message`,
    description: "Re-add it if you want that terminal output included.",
  };
}

export function buildAutoSelectedWorktreeBaseBranchToastCopy(input: {
  requestedBranch: string;
  selectedBranch: string;
}): {
  title: string;
  description: string;
} {
  return {
    title: `Using ${input.selectedBranch} instead of ${input.requestedBranch}`,
    description: `The requested base branch ${input.requestedBranch} was unavailable, so OK Code created this worktree from ${input.selectedBranch}.`,
  };
}
