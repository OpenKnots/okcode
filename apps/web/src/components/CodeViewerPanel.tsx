import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  FileCodeIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppSettings } from "~/appSettings";
import {
  makeCodeViewerTabId,
  useCodeViewerStore,
  type CodeViewerTab,
  type CodeViewerMode,
} from "~/codeViewerStore";
import { useTheme } from "~/hooks/useTheme";
import { isElectron } from "~/env";
import { projectQueryKeys, projectReadFileQueryOptions } from "~/lib/projectReactQuery";
import { cn, isMacPlatform } from "~/lib/utils";
import { isMarkdownPreviewFilePath } from "~/markdownPreview";
import { readNativeApi } from "~/nativeApi";
import { type CodeContextSelection, CodeMirrorViewer } from "./CodeMirrorViewer";
import { MarkdownPreview } from "./MarkdownPreview";
import { Button } from "./ui/button";
import { toastManager } from "./ui/toast";

const AUTOSAVE_DELAY_MS = 750;
const MANUAL_SAVE_SUCCESS_FLASH_MS = 2200;

function hasTextContentsFromQuery(
  data: { contents?: string | null } | undefined,
): data is { contents: string } {
  return typeof data?.contents === "string";
}

function isEnvFile(filePath: string): boolean {
  const basename = filePath.split("/").pop() ?? filePath;
  return /^\.env(\..*)?$/.test(basename);
}

function isEditableTextFile(input: {
  hasContents: boolean;
  hasImage: boolean;
  truncated: boolean;
  envFile: boolean;
  envValuesRevealed: boolean;
}): boolean {
  if (!input.hasContents || input.hasImage || input.truncated) {
    return false;
  }
  if (input.envFile && !input.envValuesRevealed) {
    return false;
  }
  return true;
}

async function confirmUnsavedChanges(message: string): Promise<boolean> {
  const api = readNativeApi();
  if (api) {
    return api.dialogs.confirm(message);
  }
  return window.confirm(message);
}

export function CodeViewerTabStrip(props: {
  tabs: CodeViewerTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void | Promise<void>;
  onCloseAll: () => void | Promise<void>;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-webkit-app-region:no-drag]">
      {props.tabs.map((tab) => {
        const isActive = tab.tabId === props.activeTabId;
        return (
          <div
            key={tab.tabId}
            className={cn(
              "group flex max-w-[200px] shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
              isActive
                ? "border-border bg-accent text-accent-foreground"
                : "border-transparent text-muted-foreground/70 hover:border-border/60 hover:text-foreground/80",
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left font-mono"
              onClick={() => props.onSelectTab(tab.tabId)}
              title={tab.relativePath}
            >
              <span className="truncate">{tab.label}</span>
              {tab.isDirty ? (
                <span className="ml-1 text-amber-600 dark:text-amber-300">•</span>
              ) : null}
            </button>
            <button
              type="button"
              className="shrink-0 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-accent/80 group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                void props.onCloseTab(tab.tabId);
              }}
              aria-label={`Close ${tab.label}`}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

type CodeViewerFileContentProps = {
  cwd: string;
  relativePath: string;
  resolvedTheme: "light" | "dark";
  onAddContext: (ctx: CodeContextSelection) => void;
};

export const CodeViewerFileContent = memo(function CodeViewerFileContent(
  props: CodeViewerFileContentProps,
) {
  const tabId = useMemo(
    () => makeCodeViewerTabId(props.cwd, props.relativePath),
    [props.cwd, props.relativePath],
  );
  const { settings } = useAppSettings();
  const queryClient = useQueryClient();
  const envFile = isEnvFile(props.relativePath);
  const [envValuesRevealed, setEnvValuesRevealed] = useState(false);
  const [isSavingManually, setIsSavingManually] = useState(false);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const saveRequestVersionRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualSaveConfirmationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tab = useCodeViewerStore(
    (state) => state.tabs.find((item) => item.tabId === tabId) ?? null,
  );
  const initializeTabContents = useCodeViewerStore((state) => state.initializeTabContents);
  const updateDraftContents = useCodeViewerStore((state) => state.updateDraftContents);
  const revertDraftContents = useCodeViewerStore((state) => state.revertDraftContents);
  const setTabMode = useCodeViewerStore((state) => state.setTabMode);
  const markTabSaving = useCodeViewerStore((state) => state.markTabSaving);
  const completeTabSave = useCodeViewerStore((state) => state.completeTabSave);
  const failTabSave = useCodeViewerStore((state) => state.failTabSave);

  const query = useQuery(
    projectReadFileQueryOptions({
      cwd: props.cwd,
      relativePath: props.relativePath,
    }),
  );
  const fileContents = hasTextContentsFromQuery(query.data) ? query.data.contents : "";

  const hasTextContents = hasTextContentsFromQuery(query.data);
  const hasImage = Boolean(query.data?.imageDataUrl);
  const editable = isEditableTextFile({
    hasContents: hasTextContents,
    hasImage,
    truncated: Boolean(query.data?.truncated),
    envFile,
    envValuesRevealed,
  });
  const draftContents = tab?.draftContents ?? fileContents;
  const mode: CodeViewerMode =
    tab?.mode ?? (isMarkdownPreviewFilePath(props.relativePath) ? "view" : "edit");
  const showMarkdownPreview = isMarkdownPreviewFilePath(props.relativePath) && mode === "view";
  const isSaving = Boolean(tab?.isSaving);

  const performSave = useCallback(
    async (reason: "manual" | "autosave") => {
      if (!tab || !editable || !tab.isDirty || typeof tab.draftContents !== "string") {
        return true;
      }
      const api = readNativeApi();
      if (!api) {
        const message = "File saving is unavailable.";
        failTabSave(tab.tabId, message);
        toastManager.add({ type: "error", title: "Save failed", description: message });
        return false;
      }

      const nextVersion = saveRequestVersionRef.current + 1;
      saveRequestVersionRef.current = nextVersion;
      markTabSaving(tab.tabId);
      if (reason === "manual") {
        setIsSavingManually(true);
      }

      try {
        const contents = tab.draftContents;
        await api.projects.writeFile({
          cwd: props.cwd,
          relativePath: props.relativePath,
          contents,
        });

        if (saveRequestVersionRef.current !== nextVersion) {
          return false;
        }

        completeTabSave(tab.tabId, contents);
        queryClient.setQueryData(
          projectQueryKeys.readFile(props.cwd, props.relativePath),
          (previous) =>
            previous && typeof previous === "object"
              ? {
                  ...previous,
                  contents,
                  truncated: false,
                }
              : previous,
        );
        await queryClient.invalidateQueries({
          queryKey: projectQueryKeys.readFile(props.cwd, props.relativePath),
        });
        if (reason === "manual") {
          setShowSavedConfirmation(true);
          if (manualSaveConfirmationTimerRef.current) {
            clearTimeout(manualSaveConfirmationTimerRef.current);
          }
          manualSaveConfirmationTimerRef.current = setTimeout(() => {
            setShowSavedConfirmation(false);
            manualSaveConfirmationTimerRef.current = null;
          }, MANUAL_SAVE_SUCCESS_FLASH_MS);
          toastManager.add({ type: "success", title: "File saved" });
        }
        return true;
      } catch (error) {
        if (saveRequestVersionRef.current === nextVersion) {
          const message = error instanceof Error ? error.message : "Unable to save file.";
          failTabSave(tab.tabId, message);
          toastManager.add({ type: "error", title: "Save failed", description: message });
        }
        return false;
      } finally {
        if (reason === "manual") {
          setIsSavingManually(false);
        }
      }
    },
    [
      completeTabSave,
      editable,
      failTabSave,
      markTabSaving,
      props.cwd,
      props.relativePath,
      queryClient,
      tab,
    ],
  );

  const tabExists = tab != null;
  useEffect(() => {
    if (!hasTextContents || !tabExists) {
      return;
    }
    initializeTabContents(tabId, fileContents);
  }, [fileContents, hasTextContents, initializeTabContents, tabId, tabExists]);

  useEffect(() => {
    const api = readNativeApi();
    if (!api?.projects.onFileTreeChanged) {
      return;
    }
    return api.projects.onFileTreeChanged((payload) => {
      if (payload.cwd !== props.cwd) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: projectQueryKeys.readFile(props.cwd, props.relativePath),
      });
    });
  }, [props.cwd, props.relativePath, queryClient]);

  useEffect(() => {
    if (!settings.codeViewerAutosave || !tab?.isDirty || !editable || isSaving) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }

    autosaveTimerRef.current = setTimeout(() => {
      void performSave("autosave");
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    editable,
    isSaving,
    performSave,
    settings.codeViewerAutosave,
    tab?.isDirty,
    tab?.draftContents,
  ]);

  useEffect(() => {
    if (tab?.isDirty && showSavedConfirmation) {
      setShowSavedConfirmation(false);
      if (manualSaveConfirmationTimerRef.current) {
        clearTimeout(manualSaveConfirmationTimerRef.current);
        manualSaveConfirmationTimerRef.current = null;
      }
    }
  }, [showSavedConfirmation, tab?.isDirty]);

  useEffect(
    () => () => {
      if (manualSaveConfirmationTimerRef.current) {
        clearTimeout(manualSaveConfirmationTimerRef.current);
      }
    },
    [],
  );

  const handleDiscardChanges = useCallback(() => {
    if (!tab) {
      return;
    }
    revertDraftContents(tab.tabId);
    if (isMarkdownPreviewFilePath(props.relativePath)) {
      setTabMode(tab.tabId, "view");
    }
  }, [props.relativePath, revertDraftContents, setTabMode, tab]);

  const handleEdit = useCallback(() => {
    if (tab) {
      setTabMode(tab.tabId, "edit");
    }
  }, [setTabMode, tab]);

  const handleSave = useCallback(() => {
    void performSave("manual");
  }, [performSave]);

  const saveButtonState =
    isSaving || isSavingManually
      ? "saving"
      : tab?.isDirty
        ? "dirty"
        : showSavedConfirmation
          ? "saved"
          : "clean";
  const saveButtonLabel =
    saveButtonState === "saving" ? "Saving..." : saveButtonState === "dirty" ? "Save" : "Saved";

  if (query.isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/60">
        <Loader2Icon className="size-5 animate-spin" />
        <span className="text-xs">Loading file...</span>
      </div>
    );
  }

  if (query.isError) {
    const message = query.error instanceof Error ? query.error.message : "Failed to load file.";
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-destructive/80">
        {message}
      </div>
    );
  }

  if (!hasTextContents && !hasImage) {
    return (
      <div className="flex flex-1 items-center justify-center px-5 text-center text-xs text-muted-foreground/70">
        No content available.
      </div>
    );
  }

  if (hasImage && query.data?.imageDataUrl) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
          Images are view-only in the code preview.
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <img
            src={query.data.imageDataUrl}
            alt={props.relativePath}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        </div>
      </div>
    );
  }

  const toolbarMessage = query.data?.truncated
    ? "Large files are view-only."
    : envFile && !envValuesRevealed
      ? "Reveal values to edit this file."
      : tab?.hasExternalChange
        ? "File changed on disk; saving will overwrite external changes."
        : null;

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      {query.data?.truncated ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-700 dark:text-amber-300/90">
          File is larger than 1MB. Showing truncated content.
        </div>
      ) : null}

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        {envFile ? (
          <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300/90">
              Sensitive file — values are hidden by default
            </span>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="gap-1.5 text-[11px] text-amber-700 hover:text-amber-900 dark:text-amber-300/90 dark:hover:text-amber-100"
              onClick={() => setEnvValuesRevealed((prev) => !prev)}
            >
              {envValuesRevealed ? (
                <>
                  <EyeOffIcon className="size-3.5" />
                  Hide values
                </>
              ) : (
                <>
                  <EyeIcon className="size-3.5" />
                  Show values
                </>
              )}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="text-[11px] text-muted-foreground">
            {isSaving ? "Saving..." : tab?.isDirty ? "Unsaved changes" : "Saved"}
            {settings.codeViewerAutosave ? " • Autosave on" : null}
            {toolbarMessage ? (
              <span className="ml-2 text-amber-700 dark:text-amber-300">{toolbarMessage}</span>
            ) : null}
            {tab?.lastSaveError ? (
              <span className="ml-2 text-destructive">{tab.lastSaveError}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {showMarkdownPreview ? (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleEdit}
                disabled={!editable}
              >
                <PencilIcon className="size-3.5" />
                Edit
              </Button>
            ) : null}
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handleDiscardChanges}
              disabled={!tab?.isDirty || isSaving}
            >
              <RotateCcwIcon className="size-3.5" />
              Discard
            </Button>
            <Button
              type="button"
              size="xs"
              onClick={handleSave}
              disabled={!editable || isSaving}
              aria-live="polite"
              className={cn(
                "min-w-[7rem] justify-center overflow-hidden transition-[color,background-color,border-color,box-shadow] duration-200",
                saveButtonState === "dirty" &&
                  "border border-primary/25 bg-linear-to-b from-primary to-[hsl(223_82%_62%)] text-button-primary-foreground shadow-[0_14px_30px_-22px_color-mix(in_srgb,var(--primary)_65%,transparent)] hover:brightness-105",
                saveButtonState === "saved" &&
                  "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 shadow-none hover:bg-emerald-500/10 dark:text-emerald-200",
                saveButtonState === "clean" &&
                  "border border-border/80 bg-card text-muted-foreground shadow-none hover:border-border/80 hover:bg-card hover:text-muted-foreground",
              )}
              title={
                saveButtonState === "dirty"
                  ? "Save changes"
                  : saveButtonState === "saving"
                    ? "Saving changes"
                    : "All changes saved"
              }
            >
              {saveButtonState === "saving" ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : saveButtonState === "saved" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}
              {saveButtonLabel}
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          envFile &&
            !envValuesRevealed &&
            "select-none blur-[6px] transition-[filter] duration-200",
        )}
      >
        {showMarkdownPreview ? (
          <MarkdownPreview contents={fileContents} />
        ) : (
          <CodeMirrorViewer
            contents={draftContents}
            editable={editable}
            filePath={props.relativePath}
            resolvedTheme={props.resolvedTheme}
            onAddContext={props.onAddContext}
            onChange={(contents) => {
              if (tab) {
                updateDraftContents(tab.tabId, contents);
              }
            }}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
});

export default function CodeViewerPanel() {
  const { resolvedTheme } = useTheme();
  const tabs = useCodeViewerStore((state) => state.tabs);
  const activeTabId = useCodeViewerStore((state) => state.activeTabId);
  const setActiveTab = useCodeViewerStore((state) => state.setActiveTab);
  const closeTab = useCodeViewerStore((state) => state.closeTab);
  const closeViewer = useCodeViewerStore((state) => state.close);
  const setPendingContext = useCodeViewerStore((state) => state.setPendingContext);
  const { settings } = useAppSettings();

  const activeTab = tabs.find((tab) => tab.tabId === activeTabId) ?? null;

  const onSelectTab = useCallback((tabId: string) => setActiveTab(tabId), [setActiveTab]);

  const onCloseTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((item) => item.tabId === tabId);
      if (!tab) {
        return;
      }
      if (tab.isDirty && !settings.codeViewerAutosave) {
        const confirmed = await confirmUnsavedChanges(`Discard unsaved changes in "${tab.label}"?`);
        if (!confirmed) {
          return;
        }
      }
      closeTab(tabId);
    },
    [closeTab, settings.codeViewerAutosave, tabs],
  );

  const onCloseAll = useCallback(async () => {
    if (tabs.some((tab) => tab.isDirty) && !settings.codeViewerAutosave) {
      const confirmed = await confirmUnsavedChanges("Discard unsaved changes in all open files?");
      if (!confirmed) {
        return;
      }
    }
    closeViewer();
  }, [closeViewer, settings.codeViewerAutosave, tabs]);

  const onAddContext = useCallback(
    (ctx: CodeContextSelection) => {
      setPendingContext({
        filePath: ctx.filePath,
        fromLine: ctx.fromLine,
        toLine: ctx.toLine,
      });
    },
    [setPendingContext],
  );

  const modKey = isMacPlatform(navigator.platform) ? "\u2318" : "Ctrl+";

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-b border-border px-4",
          isElectron ? "drag-region h-[52px]" : "h-12",
        )}
      >
        <CodeViewerTabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
          onCloseAll={onCloseAll}
        />
        <div className="flex shrink-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="hidden text-[10px] text-muted-foreground/50 sm:inline">
            Select code + {modKey}L to add context
          </span>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={() => void onCloseAll()}
            aria-label="Close all open files"
            title="Close all open files"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto">
        <div className="h-full w-full max-w-5xl">
          {!activeTab ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground/60">
              <FileCodeIcon className="size-8 opacity-40" />
              <p className="text-xs">Click a file in the sidebar to view it here.</p>
            </div>
          ) : (
            <CodeViewerFileContent
              key={activeTab.tabId}
              cwd={activeTab.cwd}
              relativePath={activeTab.relativePath}
              resolvedTheme={resolvedTheme}
              onAddContext={onAddContext}
            />
          )}
        </div>
      </div>
    </div>
  );
}
