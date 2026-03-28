import type { PrReviewParticipant } from "@okcode/contracts";
import { useEffect, useState } from "react";
import { MessageSquareIcon } from "lucide-react";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { PrMentionComposer } from "./PrMentionComposer";
import { TEXT_DRAFT_SCHEMA } from "./pr-review-utils";

export function PrFileCommentComposer({
  cwd,
  participants,
  path,
  defaultLine,
  onSubmit,
  disabled = false,
}: {
  cwd: string | null;
  participants: readonly PrReviewParticipant[];
  path: string;
  defaultLine: number;
  onSubmit: (input: { line: number; body: string }) => Promise<void>;
  disabled?: boolean;
}) {
  const [line, setLine] = useState(String(defaultLine));
  const draftKey = `okcode:pr-review:file-draft:${cwd ?? "unknown"}:${path}:${line}`;
  const [body, setBody] = useLocalStorage(draftKey, "", TEXT_DRAFT_SCHEMA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLine(String(defaultLine));
  }, [defaultLine]);

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/90 p-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Line
          <Input
            className="h-8 w-24"
            disabled={disabled || isSubmitting}
            inputMode="numeric"
            min={1}
            type="number"
            value={line}
            onChange={(event) => setLine(event.target.value)}
          />
        </label>
        <span className="text-xs text-muted-foreground">Creates a review thread on {path}</span>
      </div>
      <PrMentionComposer
        cwd={cwd}
        disabled={disabled || isSubmitting}
        participants={participants}
        placeholder="Add a review comment. Use @ to mention collaborators."
        value={body}
        onChange={setBody}
      />
      <div className="flex items-center justify-end gap-2">
        <Button
          disabled={disabled || isSubmitting || body.trim().length === 0}
          onClick={() => {
            const nextLine = Number.parseInt(line, 10);
            if (!Number.isFinite(nextLine) || nextLine < 1) return;
            setIsSubmitting(true);
            void onSubmit({ body: body.trim(), line: nextLine }).then(
              () => {
                setBody("");
                setIsSubmitting(false);
              },
              () => {
                setIsSubmitting(false);
              },
            );
          }}
          size="sm"
        >
          {isSubmitting ? (
            <Spinner className="size-3.5" />
          ) : (
            <MessageSquareIcon className="size-3.5" />
          )}
          Add comment
        </Button>
      </div>
    </div>
  );
}
