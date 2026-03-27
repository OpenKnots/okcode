import { memo } from "react";
import { FileCodeIcon } from "lucide-react";
import { Button } from "../ui/button";

export const OpenInPicker = memo(function OpenInPicker({
  onToggleCodeViewer,
}: {
  onToggleCodeViewer: () => void;
}) {
  return (
    <Button
      size="xs"
      variant="outline"
      onClick={onToggleCodeViewer}
      aria-label="Toggle code viewer"
    >
      <FileCodeIcon aria-hidden="true" className="size-3.5" />
      <span className="sr-only @sm/header-actions:not-sr-only @sm/header-actions:ml-0.5">Open</span>
    </Button>
  );
});
