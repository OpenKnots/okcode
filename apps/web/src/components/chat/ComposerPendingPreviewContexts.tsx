import { cn } from "~/lib/utils";
import { type PreviewContextDraft, formatPreviewContextLabel } from "~/lib/previewContext";
import { PreviewContextInlineChip } from "./PreviewContextInlineChip";

interface ComposerPendingPreviewContextsProps {
  contexts: ReadonlyArray<PreviewContextDraft>;
  onRemoveContext: (contextId: string) => void;
  className?: string;
}

interface ComposerPendingPreviewContextChipProps {
  context: PreviewContextDraft;
  onRemove: () => void;
}

export function ComposerPendingPreviewContextChip({
  context,
  onRemove,
}: ComposerPendingPreviewContextChipProps) {
  const label = formatPreviewContextLabel(context);
  const tooltipText = [
    label,
    context.pageTitle ? `page: ${context.pageTitle}` : null,
    `url: ${context.pageUrl}`,
    `selector: ${context.selector}`,
    context.text.length > 0 ? `text: ${context.text}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return <PreviewContextInlineChip label={label} tooltipText={tooltipText} onRemove={onRemove} />;
}

export function ComposerPendingPreviewContexts(props: ComposerPendingPreviewContextsProps) {
  const { contexts, onRemoveContext, className } = props;

  if (contexts.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {contexts.map((context) => (
        <ComposerPendingPreviewContextChip
          key={context.id}
          context={context}
          onRemove={() => onRemoveContext(context.id)}
        />
      ))}
    </div>
  );
}
