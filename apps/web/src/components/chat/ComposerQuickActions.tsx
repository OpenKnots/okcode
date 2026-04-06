import { memo } from "react";
import { Button } from "~/components/ui/button";

interface ComposerQuickActionsProps {
  visible: boolean;
  onPlanMode: () => void;
  onOpenEditor: () => void;
}

export const ComposerQuickActions = memo(function ComposerQuickActions({
  visible,
  onPlanMode,
  onOpenEditor,
}: ComposerQuickActionsProps) {
  return (
    <div
      data-visible={visible}
      className="flex items-center gap-2 pt-2 transition-[opacity,transform] duration-[120ms] ease-out data-[visible=false]:pointer-events-none data-[visible=false]:opacity-0 data-[visible=false]:translate-y-1 data-[visible=true]:opacity-100 data-[visible=true]:translate-y-0"
      aria-hidden={!visible}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full px-3 text-xs border-border/50 text-muted-foreground hover:text-foreground"
        onClick={onPlanMode}
        tabIndex={visible ? 0 : -1}
      >
        Plan New Idea
        <kbd className="ml-1.5 text-[10px] text-muted-foreground/60 font-mono">⇧Tab</kbd>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full px-3 text-xs border-border/50 text-muted-foreground hover:text-foreground"
        onClick={onOpenEditor}
        tabIndex={visible ? 0 : -1}
      >
        Open Editor Window
      </Button>
    </div>
  );
});
