import { memo } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";

export const MessageCopyButton = memo(function MessageCopyButton({
  text,
  label = "message",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const title = isCopied ? "Copied" : `Copy ${label}`;

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      className={cn("gap-1.5", className)}
      onClick={() => copyToClipboard(text)}
      title={title}
      aria-label={title}
    >
      {isCopied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
    </Button>
  );
});
