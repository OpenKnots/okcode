import { FileDiff } from "@pierre/diffs/react";
import { TurnId } from "@okcode/contracts";
import { ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ChatFileAttachment } from "../../types";
import {
  buildAttachmentPreviewModel,
  buildAttachmentPreviewTreeFiles,
  type AttachmentPreviewModel,
} from "../../lib/attachmentPreview";
import { resolveDiffThemeName } from "../../lib/diffRendering";
import { ChangedFilesTree } from "./ChangedFilesTree";
import { PR_REVIEW_DIFF_UNSAFE_CSS, resolveFileDiffPath } from "../pr-review/pr-review-utils";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";

interface AttachmentPreviewDialogProps {
  attachment: ChatFileAttachment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resolvedTheme: "light" | "dark";
}

interface AttachmentPreviewState {
  status: "idle" | "loading" | "ready" | "error";
  preview: AttachmentPreviewModel | null;
  error: string | null;
}

function emptyPreviewState(): AttachmentPreviewState {
  return {
    status: "idle",
    preview: null,
    error: null,
  };
}

export function AttachmentPreviewDialog({
  attachment,
  open,
  onOpenChange,
  resolvedTheme,
}: AttachmentPreviewDialogProps) {
  const [state, setState] = useState<AttachmentPreviewState>(() => emptyPreviewState());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setState(emptyPreviewState());
      setSelectedFilePath(null);
      return;
    }
    if (!attachment.url) {
      setState({
        status: "error",
        preview: null,
        error: "This attachment does not have a preview URL.",
      });
      return;
    }

    const controller = new AbortController();
    setState({
      status: "loading",
      preview: null,
      error: null,
    });

    void fetch(attachment.url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load attachment (${response.status}).`);
        }
        const text = await response.text();
        if (controller.signal.aborted) return;
        const preview = buildAttachmentPreviewModel({
          name: attachment.name,
          mimeType: attachment.mimeType,
          text,
        });
        const firstDiffFilePath =
          preview.kind === "diff" && preview.files[0]
            ? resolveFileDiffPath(preview.files[0])
            : null;
        setState({
          status: "ready",
          preview,
          error: null,
        });
        setSelectedFilePath(firstDiffFilePath);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          preview: null,
          error: error instanceof Error ? error.message : "Failed to load attachment preview.",
        });
      });

    return () => {
      controller.abort();
    };
  }, [attachment.mimeType, attachment.name, attachment.url, open]);

  const diffFiles = useMemo(
    () =>
      state.preview?.kind === "diff" ? buildAttachmentPreviewTreeFiles(state.preview.files) : [],
    [state.preview],
  );
  const selectedDiffFile = useMemo(() => {
    if (state.preview?.kind !== "diff") {
      return null;
    }
    if (state.preview.files.length === 0) {
      return null;
    }
    return (
      state.preview.files.find((fileDiff) => resolveFileDiffPath(fileDiff) === selectedFilePath) ??
      state.preview.files[0] ??
      null
    );
  }, [selectedFilePath, state.preview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{attachment.name}</DialogTitle>
          <DialogDescription>
            {attachment.mimeType} · {new Intl.NumberFormat().format(attachment.sizeBytes)} bytes
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="min-h-[28rem]">
          {state.status === "loading" && (
            <div className="flex h-full min-h-[22rem] items-center justify-center gap-2 text-sm text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin" />
              Loading attachment preview…
            </div>
          )}

          {state.status === "error" && (
            <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center">
              <p className="max-w-md text-sm text-muted-foreground">{state.error}</p>
              {attachment.url && (
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-foreground/12 bg-card px-3 text-xs font-medium text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)] transition-all duration-200 hover:border-primary/35 hover:bg-accent/80"
                >
                  <ExternalLinkIcon className="size-3.5" />
                  Open raw attachment
                </a>
              )}
            </div>
          )}

          {state.status === "ready" && state.preview?.kind === "text" && (
            <div className="rounded-xl border border-border/70 bg-background/70">
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-[12px] leading-5 text-foreground/85">
                {state.preview.text}
              </pre>
            </div>
          )}

          {state.status === "ready" && state.preview?.kind === "diff" && selectedDiffFile && (
            <div className="grid min-h-[28rem] gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
              <div className="rounded-xl border border-border/70 bg-background/70 p-2">
                <ChangedFilesTree
                  turnId={TurnId.makeUnsafe(`attachment-${attachment.id}`)}
                  files={diffFiles}
                  allDirectoriesExpanded
                  resolvedTheme={resolvedTheme}
                  cwd={undefined}
                  onSelectFile={setSelectedFilePath}
                  selectedFilePath={resolveFileDiffPath(selectedDiffFile)}
                />
              </div>
              <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
                <div className="border-b border-border/70 px-4 py-3">
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {resolveFileDiffPath(selectedDiffFile)}
                  </p>
                </div>
                <div className="max-h-[70vh] overflow-auto p-2">
                  <FileDiff
                    fileDiff={selectedDiffFile}
                    options={{
                      diffStyle: "unified",
                      lineDiffType: "none",
                      overflow: "wrap",
                      theme: resolveDiffThemeName(resolvedTheme),
                      themeType: resolvedTheme,
                      unsafeCSS: PR_REVIEW_DIFF_UNSAFE_CSS,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogPanel>
        <DialogFooter variant="bare" className="justify-end gap-2">
          {attachment.url && (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-foreground/12 bg-card px-3 text-xs font-medium text-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)] transition-all duration-200 hover:border-primary/35 hover:bg-accent/80"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open raw attachment
            </a>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
