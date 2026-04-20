import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "./ui/badge";
import { cn } from "~/lib/utils";

export function MissingOnDiskBadge({
  path,
  className,
  compact = false,
}: {
  path: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Badge
      variant="warning"
      size="sm"
      title={`Path no longer exists on disk: ${path}`}
      className={cn("gap-1.5 px-1.5", className)}
    >
      <TriangleAlertIcon className="size-3" />
      {compact ? "Missing" : "Missing on disk"}
    </Badge>
  );
}
