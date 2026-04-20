import { TriangleAlertIcon } from "lucide-react";

import { Badge } from "./ui/badge";
import { cn } from "~/lib/utils";

export function MissingOnDiskBadge({ path, className }: { path: string; className?: string }) {
  return (
    <Badge
      variant="warning"
      size="sm"
      title={`Path no longer exists on disk: ${path}`}
      className={cn("gap-1.5 px-1.5", className)}
    >
      <TriangleAlertIcon className="size-3" />
      Missing on disk
    </Badge>
  );
}
