import { RefreshCwIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

interface ProviderStatusRefreshButtonProps {
  refreshing: boolean;
  onRefresh: () => void;
}

export function ProviderStatusRefreshButton({
  refreshing,
  onRefresh,
}: ProviderStatusRefreshButtonProps) {
  return (
    <Button size="sm" variant="outline" type="button" aria-busy={refreshing} onClick={onRefresh}>
      <RefreshCwIcon
        className={cn("size-3.5 transition-transform duration-500", refreshing && "animate-spin")}
      />
      {refreshing ? "Refreshing status" : "Refresh status"}
    </Button>
  );
}
