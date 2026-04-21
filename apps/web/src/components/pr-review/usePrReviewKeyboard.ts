import { useEffect, useRef } from "react";
import { usePrReviewStore } from "~/prReviewStore";

interface UsePrReviewKeyboardOptions {
  enabled: boolean;
  fileCount: number;
  filePaths: string[];
  reviewComposerRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function usePrReviewKeyboard({
  enabled,
  fileCount,
  filePaths,
  reviewComposerRef,
}: UsePrReviewKeyboardOptions): void {
  // Use refs to keep the handler stable while always reading fresh values.
  const optionsRef = useRef<UsePrReviewKeyboardOptions>({
    enabled,
    fileCount,
    filePaths,
    reviewComposerRef,
  });
  optionsRef.current = { enabled, fileCount, filePaths, reviewComposerRef };

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const opts = optionsRef.current;
      if (!opts.enabled) return;

      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Allow Shift+A but otherwise bail on modifier combos.
      if (event.ctrlKey || event.metaKey) return;

      const {
        selectedFilePath,
        reviewedFiles,
        toggleLeftRail,
        toggleInspector,
        selectFile,
        toggleFileReviewed,
        setShortcutOverlayOpen,
      } = usePrReviewStore.getState();

      switch (event.key) {
        // ── Panels ───────────────────────────────────────────────
        case "[": {
          event.preventDefault();
          toggleLeftRail();
          break;
        }
        case "]": {
          event.preventDefault();
          toggleInspector();
          break;
        }

        // ── File navigation ──────────────────────────────────────
        case "j": {
          event.preventDefault();
          const paths = opts.filePaths;
          if (paths.length === 0) break;
          const currentIndex = selectedFilePath ? paths.indexOf(selectedFilePath) : -1;
          const nextIndex = currentIndex < paths.length - 1 ? currentIndex + 1 : 0;
          selectFile(paths[nextIndex] ?? null);
          break;
        }
        case "k": {
          event.preventDefault();
          const paths = opts.filePaths;
          if (paths.length === 0) break;
          const currentIndex = selectedFilePath ? paths.indexOf(selectedFilePath) : paths.length;
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : paths.length - 1;
          selectFile(paths[prevIndex] ?? null);
          break;
        }
        case "n": {
          event.preventDefault();
          const paths = opts.filePaths;
          if (paths.length === 0) break;
          const reviewedSet = new Set(reviewedFiles);
          const currentIndex = selectedFilePath ? paths.indexOf(selectedFilePath) : -1;
          // Search forward from the current position, wrapping around.
          for (let offset = 1; offset <= paths.length; offset++) {
            const candidateIndex = (currentIndex + offset) % paths.length;
            const candidatePath = paths[candidateIndex];
            if (candidatePath && !reviewedSet.has(candidatePath)) {
              selectFile(candidatePath);
              break;
            }
          }
          break;
        }

        // ── Review actions ───────────────────────────────────────
        case "e": {
          event.preventDefault();
          if (selectedFilePath) {
            toggleFileReviewed(selectedFilePath);
          }
          break;
        }
        case "r": {
          event.preventDefault();
          opts.reviewComposerRef.current?.focus();
          break;
        }
        case "?": {
          event.preventDefault();
          setShortcutOverlayOpen(true);
          break;
        }

        default:
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
