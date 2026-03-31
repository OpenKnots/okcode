import { MaximizeIcon } from "lucide-react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "~/lib/utils";
import { Sheet, SheetPopup, SheetPanel } from "~/components/ui/sheet";

/**
 * Wraps plain-text or markdown AI summaries with an expand button
 * that opens a clean, Notion-like full-height preview sheet.
 *
 * Usage:
 *   <ExpandableSummary text={recommendation.detail} title="Resolution guidance" />
 *
 * The inline render is plain text (default children or the `text` prop).
 * The expanded view renders the text as GitHub-flavored Markdown in a
 * minimal, readable layout.
 */

interface ExpandableSummaryProps {
  /** The raw text / markdown content to render */
  text: string;
  /** Title shown at the top of the expanded sheet */
  title?: string;
  /** Optional subtitle / context line below the title */
  subtitle?: string;
  /** Additional className for the inline wrapper */
  className?: string;
  /** Inline text element — defaults to rendering `text` in a <p> */
  children?: React.ReactNode;
}

export const ExpandableSummary = memo(function ExpandableSummary({
  text,
  title,
  subtitle,
  className,
  children,
}: ExpandableSummaryProps) {
  const [open, setOpen] = useState(false);

  // Don't render the expand affordance for very short text
  const isExpandable = text.trim().length > 40;

  return (
    <>
      <div className={cn("group/expand relative", className)}>
        {children ?? <p className="text-sm opacity-85">{text}</p>}

        {isExpandable ? (
          <button
            aria-label="Expand summary"
            className="absolute -top-1 -end-1 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground/50 opacity-0 backdrop-blur-sm transition-all duration-150 hover:bg-muted hover:text-foreground group-hover/expand:opacity-100"
            onClick={() => setOpen(true)}
            type="button"
          >
            <MaximizeIcon className="size-3" />
          </button>
        ) : null}
      </div>

      {isExpandable ? (
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetPopup className="max-w-2xl" showCloseButton side="right" variant="inset">
            <SheetPanel scrollFade>
              <article className="summary-preview mx-auto max-w-prose px-2 py-6">
                {title ? (
                  <header className="mb-8 border-b border-border/50 pb-6">
                    <h1 className="font-heading text-xl font-semibold leading-tight text-foreground">
                      {title}
                    </h1>
                    {subtitle ? (
                      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
                    ) : null}
                  </header>
                ) : null}

                <div className="summary-preview-body text-[15px] leading-relaxed text-foreground/88">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                </div>
              </article>
            </SheetPanel>
          </SheetPopup>
        </Sheet>
      ) : null}
    </>
  );
});
