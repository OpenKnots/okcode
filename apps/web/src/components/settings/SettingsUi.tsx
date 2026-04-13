import { type ReactNode, useCallback } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../../lib/utils";
import { Undo2Icon } from "lucide-react";

export function SettingsSection({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  description,
  status,
  resetAction,
  control,
  children,
  onClick,
}: {
  title: string;
  description: string;
  status?: ReactNode;
  resetAction?: ReactNode;
  control?: ReactNode;
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5"
      data-slot="settings-row"
    >
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          onClick && "cursor-pointer",
        )}
        onClick={onClick}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-h-5 items-center gap-1.5">
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {resetAction}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
          {status ? <div className="pt-1 text-[11px] text-muted-foreground">{status}</div> : null}
        </div>
        {control ? (
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:justify-end">
            {control}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function SettingResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Reset ${label} to default`}
            className="size-5 rounded-sm p-0 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            <Undo2Icon className="size-3" />
          </Button>
        }
      />
      <TooltipPopup side="top">Reset to default</TooltipPopup>
    </Tooltip>
  );
}

export function BackgroundImageSettings({
  backgroundImageUrl,
  backgroundImageOpacity,
  defaultBackgroundImageUrl,
  defaultBackgroundImageOpacity,
  updateSettings,
}: {
  backgroundImageUrl: string;
  backgroundImageOpacity: number;
  defaultBackgroundImageUrl: string;
  defaultBackgroundImageOpacity: number;
  updateSettings: (patch: { backgroundImageOpacity?: number; backgroundImageUrl?: string }) => void;
}) {
  const hasBackground = backgroundImageUrl.trim().length > 0;

  const handleUrlChange = useCallback(
    (value: string) => {
      updateSettings({
        backgroundImageUrl: value,
      });
    },
    [updateSettings],
  );

  const handleOpacityChange = useCallback(
    (value: number) => {
      updateSettings({ backgroundImageOpacity: value });
    },
    [updateSettings],
  );

  const handleReset = useCallback(() => {
    updateSettings({
      backgroundImageUrl: defaultBackgroundImageUrl,
      backgroundImageOpacity: defaultBackgroundImageOpacity,
    });
  }, [defaultBackgroundImageOpacity, defaultBackgroundImageUrl, updateSettings]);

  return (
    <>
      <SettingsRow
        title="Background image"
        description="Set a custom background image URL. Supports any image URL."
        resetAction={
          hasBackground ? (
            <SettingResetButton label="background image" onClick={handleReset} />
          ) : null
        }
        control={
          <Input
            value={backgroundImageUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full sm:w-56"
            aria-label="Background image URL"
          />
        }
      />
      {hasBackground && (
        <SettingsRow
          title="Background opacity"
          description="Adjust the visibility of the custom background image."
          control={
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(backgroundImageOpacity * 100)}
                onChange={(e) => {
                  const value = Number(e.target.value) / 100;
                  handleOpacityChange(value);
                }}
                className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-foreground sm:w-28"
                aria-label="Background opacity"
              />
              <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(backgroundImageOpacity * 100)}%
              </span>
            </div>
          }
        />
      )}
    </>
  );
}
