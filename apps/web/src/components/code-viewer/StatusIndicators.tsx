import { memo } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";

interface StatusIndicatorsProps {
  diagnosticCount?: number;
  lspStatus?: "connected" | "initializing" | "disconnected";
}

export const StatusIndicators = memo(function StatusIndicators({
  diagnosticCount = 0,
  lspStatus = "disconnected",
}: StatusIndicatorsProps) {
  const lspDotColor =
    lspStatus === "connected"
      ? "bg-emerald-500"
      : lspStatus === "initializing"
        ? "bg-amber-500"
        : "bg-muted-foreground/30";

  const lspLabel =
    lspStatus === "connected"
      ? "LSP: Connected"
      : lspStatus === "initializing"
        ? "LSP: Initializing"
        : "LSP: Disconnected";

  return (
    <div className="flex shrink-0 items-center gap-2">
      {diagnosticCount > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge variant="warning" size="sm" className="gap-1 tabular-nums">
                <TriangleAlertIcon className="size-3" />
                {diagnosticCount}
              </Badge>
            }
          />
          <TooltipPopup side="bottom">
            {diagnosticCount} diagnostic{diagnosticCount !== 1 ? "s" : ""}
          </TooltipPopup>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground" aria-label={lspLabel}>
              <span className={`size-2 rounded-full ${lspDotColor}`} />
              <span>LSP</span>
            </div>
          }
        />
        <TooltipPopup side="bottom">{lspLabel}</TooltipPopup>
      </Tooltip>
    </div>
  );
});
