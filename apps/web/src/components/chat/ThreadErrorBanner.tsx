import { memo } from "react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { CircleAlertIcon, XIcon } from "lucide-react";
import { humanizeThreadError } from "./threadError";

export const ThreadErrorBanner = memo(function ThreadErrorBanner({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss?: () => void;
}) {
  if (!error) return null;
  const presentation = humanizeThreadError(error);
  return (
    <div className="pt-3 mx-auto max-w-7xl">
      <Alert variant="error">
        <CircleAlertIcon />
        {presentation.title ? <AlertTitle>{presentation.title}</AlertTitle> : null}
        <AlertDescription>
          <p className="line-clamp-3" title={presentation.description}>
            {presentation.description}
          </p>
          {presentation.technicalDetails ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none text-muted-foreground/80 hover:text-foreground">
                Technical details
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-words text-muted-foreground/80">
                {presentation.technicalDetails}
              </pre>
            </details>
          ) : null}
        </AlertDescription>
        {onDismiss && (
          <AlertAction>
            <button
              type="button"
              aria-label="Dismiss error"
              className="inline-flex size-6 items-center justify-center rounded-md text-destructive/60 transition-colors hover:text-destructive"
              onClick={onDismiss}
            >
              <XIcon className="size-3.5" />
            </button>
          </AlertAction>
        )}
      </Alert>
    </div>
  );
});
