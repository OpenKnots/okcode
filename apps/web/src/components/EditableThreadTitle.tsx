import { PencilIcon } from "lucide-react";
import {
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "~/lib/utils";
import { Button } from "./ui/button";

interface EditableThreadTitleProps {
  title: string;
  isEditing: boolean;
  draftTitle: string;
  onStartEditing: () => void;
  onDraftTitleChange: (title: string) => void;
  onCommit: () => void | Promise<void>;
  onCancel: () => void;
  inputRef?: (node: HTMLInputElement | null) => void;
  containerClassName?: string;
  titleClassName?: string;
  inputClassName?: string;
  showEditButton?: boolean;
  editButtonClassName?: string;
  editButtonLabel?: string;
}

const DOUBLE_TAP_WINDOW_MS = 320;

export function EditableThreadTitle({
  title,
  isEditing,
  draftTitle,
  onStartEditing,
  onDraftTitleChange,
  onCommit,
  onCancel,
  inputRef,
  containerClassName,
  titleClassName,
  inputClassName,
  showEditButton = false,
  editButtonClassName,
  editButtonLabel = "Rename thread",
}: EditableThreadTitleProps) {
  const ignoreNextBlurRef = useRef(false);
  const lastTouchEndAtRef = useRef<number | null>(null);

  const triggerEditing = useCallback(() => {
    ignoreNextBlurRef.current = false;
    onStartEditing();
  }, [onStartEditing]);

  const handleTitleDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
      triggerEditing();
    },
    [triggerEditing],
  );

  const handleTitlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (event.pointerType !== "touch") {
        return;
      }
      const lastTouchEndAt = lastTouchEndAtRef.current;
      lastTouchEndAtRef.current = event.timeStamp;
      if (lastTouchEndAt !== null && event.timeStamp - lastTouchEndAt <= DOUBLE_TAP_WINDOW_MS) {
        lastTouchEndAtRef.current = null;
        triggerEditing();
      }
    },
    [triggerEditing],
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", containerClassName)}>
      {isEditing ? (
        <input
          type="text"
          ref={inputRef}
          value={draftTitle}
          aria-label={editButtonLabel}
          className={cn(
            "min-w-0 flex-1 truncate rounded-md border border-input bg-accent/30 px-2 py-1 text-sm shadow-none ring-1 ring-ring/40 transition-[box-shadow] duration-150 focus:ring-ring/70 sm:text-xs",
            inputClassName,
          )}
          onChange={(event) => onDraftTitleChange(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.preventDefault();
              ignoreNextBlurRef.current = true;
              void onCommit();
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              ignoreNextBlurRef.current = true;
              onCancel();
            }
          }}
          onBlur={() => {
            if (ignoreNextBlurRef.current) {
              ignoreNextBlurRef.current = false;
              return;
            }
            void onCommit();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <>
          <span
            className={cn("min-w-0 truncate", titleClassName)}
            title={title}
            onDoubleClick={handleTitleDoubleClick}
            onPointerUp={handleTitlePointerUp}
          >
            {title}
          </span>
          {showEditButton ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={editButtonLabel}
              className={cn(
                "shrink-0 text-muted-foreground/45 hover:text-foreground",
                editButtonClassName,
              )}
              onClick={(event) => {
                event.stopPropagation();
                triggerEditing();
              }}
            >
              <PencilIcon className="size-3" />
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
