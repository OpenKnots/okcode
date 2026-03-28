import { MousePointerClickIcon, XIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import {
  COMPOSER_INLINE_CHIP_CLASS_NAME,
  COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_ICON_CLASS_NAME,
  COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME,
} from "../composerInlineChip";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

interface PreviewContextInlineChipProps {
  label: string;
  tooltipText: string;
  onRemove?: () => void;
}

export function PreviewContextInlineChip(props: PreviewContextInlineChipProps) {
  const { label, tooltipText, onRemove } = props;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className={COMPOSER_INLINE_CHIP_CLASS_NAME}>
            <MousePointerClickIcon className={cn(COMPOSER_INLINE_CHIP_ICON_CLASS_NAME, "size-3")} />
            <span className={COMPOSER_INLINE_CHIP_LABEL_CLASS_NAME}>{label}</span>
            {onRemove ? (
              <button
                type="button"
                className={COMPOSER_INLINE_CHIP_DISMISS_BUTTON_CLASS_NAME}
                aria-label={`Remove ${label}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove();
                }}
              >
                <XIcon className="size-3" />
              </button>
            ) : null}
          </span>
        }
      />
      <TooltipPopup side="top" className="max-w-80 whitespace-pre-wrap leading-tight">
        {tooltipText}
      </TooltipPopup>
    </Tooltip>
  );
}
