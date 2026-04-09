import { useCallback, useRef, useState } from "react";
import { FileTextIcon, TrashIcon, UploadIcon, XIcon } from "lucide-react";
import { SME_MAX_DOCUMENT_SIZE_BYTES, type SmeDocumentId } from "@okcode/contracts";

import type { Project } from "~/types";
import { ensureNativeApi } from "~/nativeApi";
import { useSmeStore } from "~/smeStore";

interface SmeKnowledgePanelProps {
  project: Project;
  onClose: () => void;
}

const ACCEPTED_EXTENSIONS = ".txt,.md,.json,.csv,.yaml,.yml,.html,.xml";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SmeKnowledgePanel({ project, onClose }: SmeKnowledgePanelProps) {
  const documents = useSmeStore((s) => s.documents);
  const addDocument = useSmeStore((s) => s.addDocument);
  const removeDocument = useSmeStore((s) => s.removeDocument);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      if (file.size > SME_MAX_DOCUMENT_SIZE_BYTES) {
        alert(`File too large. Maximum size is ${formatBytes(SME_MAX_DOCUMENT_SIZE_BYTES)}.`);
        return;
      }

      setUploading(true);
      try {
        const api = ensureNativeApi();
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), ""),
        );

        const doc = await api.sme.uploadDocument({
          projectId: project.id,
          title: file.name.replace(/\.[^.]+$/, ""),
          fileName: file.name,
          mimeType: file.type || "text/plain",
          contentBase64: base64,
        });
        addDocument(doc);
      } catch (err) {
        console.error("Failed to upload document:", err);
      } finally {
        setUploading(false);
      }
    },
    [project.id, addDocument],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleUpload(file);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleUpload],
  );

  const handleDelete = useCallback(
    async (documentId: string) => {
      try {
        const api = ensureNativeApi();
        await api.sme.deleteDocument({ documentId: documentId as SmeDocumentId });
        removeDocument(documentId);
      } catch (err) {
        console.error("Failed to delete document:", err);
      }
    },
    [removeDocument],
  );

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Knowledge Base</span>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Upload button */}
      <div className="px-3 pb-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
        >
          <UploadIcon className="size-4" />
          <span>{uploading ? "Uploading..." : "Upload Document"}</span>
        </button>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
          .txt, .md, .json, .csv, .yaml, .html, .xml
        </p>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-2">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <FileTextIcon className="size-5 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              No documents uploaded yet.
              <br />
              Upload reference docs to give your SME context.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5 py-1">
            {documents.map((doc) => (
              <div
                key={doc.documentId}
                className="group flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60"
              >
                <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{doc.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {doc.fileName} &middot; {formatBytes(doc.sizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(doc.documentId)}
                  className="mt-0.5 shrink-0 rounded-md p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                >
                  <TrashIcon className="size-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
