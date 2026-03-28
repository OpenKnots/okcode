import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLinkIcon } from "lucide-react";
import { prReviewUserPreviewQueryOptions } from "~/lib/prReviewReactQuery";
import { cn } from "~/lib/utils";
import { ensureNativeApi } from "~/nativeApi";
import { Button } from "~/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "~/components/ui/popover";
import { Spinner } from "~/components/ui/spinner";

export function PrUserHoverCard({
  cwd,
  login,
  className,
  children,
}: {
  cwd: string | null;
  login: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const previewQuery = useQuery(
    prReviewUserPreviewQueryOptions({
      cwd: open ? cwd : null,
      login: open ? login : null,
    }),
  );

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 120);
  };

  useEffect(() => () => clearCloseTimeout(), []);

  const preview = previewQuery.data;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        className={cn(
          "rounded-sm text-amber-700 underline decoration-amber-500/30 underline-offset-2 transition-colors hover:text-amber-600 dark:text-amber-300 dark:hover:text-amber-200",
          className,
        )}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => {
          clearCloseTimeout();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        render={<button type="button" />}
      >
        {children ?? `@${login}`}
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        className="w-72"
        onMouseEnter={clearCloseTimeout}
        onMouseLeave={scheduleClose}
      >
        {previewQuery.isLoading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Spinner className="size-3.5" />
            Loading GitHub profile...
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <img
                alt={preview?.login ?? login}
                className="size-11 rounded-full border border-border/70 object-cover"
                src={preview?.avatarUrl ?? `https://github.com/${login}.png`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-sm text-foreground">
                  {preview?.name ?? login}
                </p>
                <p className="truncate text-xs text-muted-foreground">@{preview?.login ?? login}</p>
              </div>
            </div>
            {preview?.bio ? <p className="text-sm text-foreground/85">{preview.bio}</p> : null}
            <div className="grid gap-1 text-xs text-muted-foreground">
              {preview?.company ? <span>{preview.company}</span> : null}
              {preview?.location ? <span>{preview.location}</span> : null}
            </div>
            <Button
              className="w-full justify-center"
              onClick={() => {
                void ensureNativeApi().shell.openExternal(
                  preview?.url ?? `https://github.com/${preview?.login ?? login}`,
                );
              }}
              size="sm"
              variant="outline"
            >
              <ExternalLinkIcon className="size-3.5" />
              Open GitHub profile
            </Button>
          </div>
        )}
      </PopoverPopup>
    </Popover>
  );
}
