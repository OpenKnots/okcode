import { CheckIcon, CircleIcon, CopyIcon } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import type { StreamingCodePreviewMeta } from "~/lib/chatCodePreview";
import { cn } from "~/lib/utils";

function formatLineCount(lineCount: number): string {
  return `${lineCount} line${lineCount === 1 ? "" : "s"}`;
}

export const ChatCodePreviewCard = memo(function ChatCodePreviewCard(props: {
  code: string;
  meta: StreamingCodePreviewMeta;
  isStreaming: boolean;
  children: ReactNode;
}) {
  const { code, meta, isStreaming, children } = props;
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    if (typeof navigator === "undefined" || navigator.clipboard == null) {
      return;
    }
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        if (copiedTimerRef.current != null) {
          clearTimeout(copiedTimerRef.current);
        }
        setCopied(true);
        copiedTimerRef.current = setTimeout(() => {
          setCopied(false);
          copiedTimerRef.current = null;
        }, 1200);
      })
      .catch(() => undefined);
  }, [code]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current != null) {
        clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    },
    [],
  );

  const statusText = meta.isHighlightFallback
    ? "Preview unavailable, showing plain code"
    : isStreaming && !meta.isCompleteFence
      ? "Preparing code preview"
      : isStreaming
        ? "Streaming code preview"
        : "Code preview";

  return (
    <div
      className={cn(
        "chat-code-preview",
        isStreaming && "chat-code-preview-streaming",
        meta.isHighlightFallback && "chat-code-preview-fallback",
      )}
      data-streaming={isStreaming ? "true" : "false"}
      data-highlight-fallback={meta.isHighlightFallback ? "true" : "false"}
    >
      <div className="chat-code-preview-header">
        <div className="chat-code-preview-title-row">
          <span className="chat-code-preview-title">{meta.displayLanguage}</span>
          {isStreaming ? (
            <span className="chat-code-preview-badge">
              <CircleIcon className="chat-code-preview-live-dot size-2.5 fill-current stroke-none" />
              Live
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="chat-markdown-copy-button chat-code-preview-copy-button"
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy code"}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
        </button>
      </div>
      <div className="chat-code-preview-body">{children}</div>
      <div className="chat-code-preview-footer">
        <span className="chat-code-preview-status">{statusText}</span>
        <span className="chat-code-preview-meta">
          <span>{meta.displayLanguage}</span>
          <span>{formatLineCount(meta.lineCount)}</span>
          <span>{isStreaming ? "Live" : "Updated just now"}</span>
        </span>
      </div>
    </div>
  );
});
