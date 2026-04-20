import {
  Children,
  useDeferredValue,
  isValidElement,
  memo,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatCodePreviewCard } from "./ChatCodePreviewCard";
import { useAppSettings } from "../appSettings";
import { openFileReference } from "../fileOpen";
import { useFileViewNavigation } from "~/hooks/useFileViewNavigation";
import { resolveDiffThemeName, type DiffThemeName } from "../lib/diffRendering";
import {
  getCachedHighlightedHtml,
  getHighlighterPromise,
  renderHighlightedCodeHtml,
  setCachedHighlightedHtml,
} from "../lib/syntaxHighlighting";
import { buildStreamingCodePreviewMeta } from "../lib/chatCodePreview";
import { useTheme } from "../hooks/useTheme";
import { resolveMarkdownFileLinkTarget } from "../markdown-links";
import { readNativeApi } from "../nativeApi";
import { toastManager } from "./ui/toast";

interface ChatMarkdownProps {
  text: string;
  cwd: string | undefined;
  isStreaming?: boolean;
}

function nodeToPlainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map((child) => nodeToPlainText(child)).join("");
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeToPlainText(node.props.children);
  }
  return "";
}

function extractCodeBlock(
  children: ReactNode,
): { className: string | undefined; code: string } | null {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) {
    return null;
  }

  const onlyChild = childNodes[0];
  if (
    !isValidElement<{ className?: string; children?: ReactNode }>(onlyChild) ||
    onlyChild.type !== "code"
  ) {
    return null;
  }

  return {
    className: onlyChild.props.className,
    code: nodeToPlainText(onlyChild.props.children),
  };
}

interface HighlightedCodeBlockProps {
  className: string | undefined;
  code: string;
  themeName: DiffThemeName;
  isStreaming: boolean;
  fallback: ReactNode;
}

function HighlightedCodeBlock({
  className,
  code,
  themeName,
  isStreaming,
  fallback,
}: HighlightedCodeBlockProps) {
  const deferredCode = useDeferredValue(code);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [highlightFailed, setHighlightFailed] = useState(false);
  const meta = useMemo(
    () =>
      buildStreamingCodePreviewMeta({
        className,
        code,
        isStreaming,
        highlightFailed,
      }),
    [className, code, highlightFailed, isStreaming],
  );
  const effectiveCode = isStreaming ? deferredCode : code;

  useEffect(() => {
    let cancelled = false;
    const cachedHighlightedHtml = !isStreaming
      ? getCachedHighlightedHtml(code, meta.language, themeName, "chat-markdown")
      : null;

    if (cachedHighlightedHtml != null) {
      setHighlightFailed(false);
      setHighlightedHtml(cachedHighlightedHtml);
      return () => {
        cancelled = true;
      };
    }

    setHighlightedHtml((current) => (isStreaming ? current : null));
    setHighlightFailed(false);

    void getHighlighterPromise(meta.language)
      .then((highlighter) => {
        if (cancelled) return;
        const nextHtml = renderHighlightedCodeHtml(
          highlighter,
          effectiveCode,
          meta.language,
          themeName,
        );
        if (cancelled) return;
        setHighlightedHtml(nextHtml);
        if (!isStreaming) {
          setCachedHighlightedHtml(code, meta.language, themeName, "chat-markdown", nextHtml);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setHighlightFailed(true);
        setHighlightedHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, effectiveCode, isStreaming, meta.language, themeName]);

  return (
    <ChatCodePreviewCard code={code} meta={meta} isStreaming={isStreaming}>
      {highlightedHtml ? (
        <div
          className="chat-markdown-shiki"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        fallback
      )}
    </ChatCodePreviewCard>
  );
}

function ChatMarkdown({ text, cwd, isStreaming = false }: ChatMarkdownProps) {
  const { settings } = useAppSettings();
  const openFileInViewer = useFileViewNavigation();
  const { resolvedTheme } = useTheme();
  const diffThemeName = resolveDiffThemeName(resolvedTheme);
  const openLinksExternally = settings.openLinksExternally;
  const markdownComponents = useMemo<Components>(
    () => ({
      a({ node: _node, href, ...props }) {
        const targetPath = resolveMarkdownFileLinkTarget(href, cwd);
        if (!targetPath) {
          return <a {...props} href={href} target="_blank" rel="noreferrer" />;
        }

        return (
          <a
            {...props}
            href={href}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const api = readNativeApi();
              if (api) {
                void openFileReference({
                  api,
                  cwd,
                  targetPath,
                  preferExternal: openLinksExternally,
                  openInViewer: openFileInViewer,
                }).catch((error) => {
                  toastManager.add({
                    type: "error",
                    title: "Unable to open file",
                    description: error instanceof Error ? error.message : "An error occurred.",
                  });
                });
              } else {
                console.warn("Native API not found. Unable to open file.");
              }
            }}
          />
        );
      },
      pre({ node: _node, children, ...props }) {
        const codeBlock = extractCodeBlock(children);
        if (!codeBlock) {
          return <pre {...props}>{children}</pre>;
        }

        const fallback = <pre {...props}>{children}</pre>;
        return (
          <HighlightedCodeBlock
            className={codeBlock.className}
            code={codeBlock.code}
            themeName={diffThemeName}
            isStreaming={isStreaming}
            fallback={fallback}
          />
        );
      },
    }),
    [cwd, diffThemeName, isStreaming, openFileInViewer, openLinksExternally],
  );

  return (
    <div className="chat-markdown w-full min-w-0 text-sm leading-relaxed text-foreground/80">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default memo(ChatMarkdown);
