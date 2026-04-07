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
    <div className="flex w-72 shrink-0 flex-col border-l border-border bg-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">Knowledge Base</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>

      {/* Upload button */}
      <div className="px-3 py-2">
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
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
        >
          <UploadIcon className="size-3.5" />
          <span>{uploading ? "Uploading..." : "Upload Document"}</span>
        </button>
        <p className="mt-1 text-center text-[10px] text-muted-foreground/60">
          .txt, .md, .json, .csv, .yaml, .html, .xml
        </p>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto px-2">
        {documents.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            No documents uploaded yet.
            <br />
            Upload reference docs to give your SME context.
          </p>
        ) : (
          <div className="space-y-1 py-1">
            {documents.map((doc) => (
              <div
                key={doc.documentId}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
              >
                <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">{doc.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {doc.fileName} &middot; {formatBytes(doc.sizeBytes)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(doc.documentId)}
                  className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
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
